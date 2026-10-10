import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { prepararEnvioLayout } from "@/lib/layout-fatura.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookmarkMinus,
  BookmarkPlus,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import {
  RESPONSAVEIS_EXTRA,
  useBancos,
  useCartoes,
  useCategorias,
  useDespesas,
  useProfilesList,
} from "@/hooks/useFinance";
import { formatBRL, monthLabelLong } from "@/lib/format";
import { mesmaPessoa } from "@/lib/fatura-fluxo";
import {
  AvisoCorrespondenciaFixa,
  type AcaoFixa,
} from "@/components/AvisosImportacao";
import { DuplicidadeDialog } from "@/components/DuplicidadeDialog";
import {
  classificacaoAnterior,
  encontrarCandidatas,
  type AcaoDuplicata,
  type Candidata,
  type DespesaExistente,
} from "@/lib/duplicidade-importacao";
import { cn } from "@/lib/utils";
import { encontrarCorrespondenciaFixa, type FixaCandidata } from "@/lib/correspondencia-fixa";
import { mesesEntreCompetencias, somarMeses, vencimentoDaCompetencia } from "@/lib/recorrencia";
import {
  CONFIANCA_LABEL,
  chaveEstabelecimento,
  classificar,
  detectarTipoLancamento,
  type RegraUsuario,
} from "@/lib/categorizacao";
import { PrimeiraCategoriaGuia } from "@/components/PrimeiraCategoriaGuia";
import { PrimeiraFaturaAviso } from "@/components/PrimeiraFaturaAviso";
import { useCategoriasPadrao } from "@/hooks/useCategoriasPadrao";
import { interpretarBloco } from "@/lib/lancamento-texto";
import { lancamentosDeOcr, ocrImagem, hashTexto as hashTextoOcr } from "@/lib/ocr";
import {
  BANCO_LABEL,
  conferirTotal,
  dedupKey,
  ErroLeituraPdf,
  processarFatura,
  vencimentoParcela,
  type BancoFatura,
  type FaturaExtraida,
  type LancamentoExtraido,
} from "@/lib/faturas";
import { lerPlanilhaImportacao, modeloCsvPlanilha } from "@/lib/importacao-planilha";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar Lançamentos — Control ALL" },
      {
        name: "description",
        content:
          "Importe faturas em PDF ou cole lançamentos de texto, revise tudo linha a linha com categorização automática e confirme para lançar nas despesas.",
      },
      { property: "og:title", content: "Importar Lançamentos — Control ALL" },
      {
        property: "og:description",
        content:
          "Faturas em PDF e texto colado com prévia totalmente editável e de-para de categorias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportarPage,
});

const BANCOS: BancoFatura[] = [
  "itau",
  "nubank",
  "pernambucanas",
  "santander",
  "xp",
  "riachuelo",
  "desconhecido",
];

type FaturaItem = FaturaExtraida & {
  arquivo: File | null;
  duplicada?: boolean;
  destino?: string;
  total_declarado_edicao?: string;
};


/** Normaliza nomes para comparar "Itaú" com "itau", "Banco Santander" com "santander" etc. */
function chaveNome(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function hashTexto(texto: string) {
  const buf = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ImportarPage() {
  const { subcategoriasDe: subDaCategoria } = useCategoriasPadrao();
  const qc = useQueryClient();
  const { user } = useSession();
  const { can, canImportar, exclusaoBloqueada } = usePermissoes();
  const { data: profiles = [] } = useProfilesList();
  const { data: categorias = [] } = useCategorias("despesa");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const { data: despesasTodas = [] } = useDespesas();
  // Despesas fixas já cadastradas (de importações/telas anteriores) — usadas
  // pra avisar quando um lançamento desta importação parece ser a mesma
  // despesa fixa aparecendo de novo (ex.: assinatura recorrente que chegou
  // numa fatura de mês seguinte), já que essas agora são projetadas
  // automaticamente pra frente e não precisam ser reimportadas.
  const despesasFixas = useMemo(
    () => (despesasTodas as FixaCandidata[]).filter((d) => d.tipo === "fixa"),
    [despesasTodas],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const layoutRef = useRef<HTMLInputElement>(null);
  const prepararLayout = useServerFn(prepararEnvioLayout);
  const [enviandoLayout, setEnviandoLayout] = useState(false);
  const [modalAnaliseOpen, setModalAnaliseOpen] = useState(false);

  const { data: solicitacoesAnalise = [] } = useQuery({
    queryKey: ["layout_solicitacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("layout_solicitacoes")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  async function enviarParaModelagem(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo pode ter no máximo 10 MB.");
      return;
    }
    setEnviandoLayout(true);
    try {
      const envio = await prepararLayout({ data: { nome: file.name } });
      const { error } = await supabase.storage
        .from("layouts_analise")
        .uploadToSignedUrl(envio.path, envio.token, file);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["layout_solicitacoes"] });
      toast.success(
        `Fatura enviada para análise. Protocolo: ${envio.protocolo}. Usaremos apenas o layout e o arquivo será descartado em até 30 dias.`,
      );
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível enviar.");
    } finally {
      setEnviandoLayout(false);
      if (layoutRef.current) layoutRef.current.value = "";
    }
  }
  const imgInputRef = useRef<HTMLInputElement>(null);
  const planilhaInputRef = useRef<HTMLInputElement>(null);
  const classificacoesEditadas = useRef(new Set<string>());
  // Etapa F (plano-importacao-v2.md): "linha de base" de cada lançamento
  // (valor já extraído/corrigido automaticamente, antes de qualquer edição
  // manual nesta sessão) — usada só para saber quando mostrar o botão
  // "Ensinar" (a edição do usuário diverge da base) e o que gravar nela.
  const baseCorrecao = useRef(
    new Map<string, { data_compra: string; descricao: string; valor: number }>(),
  );

  const [lendo, setLendo] = useState(false);
  const [lendoImagens, setLendoImagens] = useState(false);
  const [lendoPlanilha, setLendoPlanilha] = useState(false);
  const [faturas, setFaturas] = useState<FaturaItem[]>([]);
  const [acoesDuplicata, setAcoesDuplicata] = useState<
    Record<string, { acao: AcaoDuplicata; alvoId: string | null }>
  >({});
  const [duplicataAberta, setDuplicataAberta] = useState<{
    faturaIdx: number;
    lancamentoId: string;
  } | null>(null);
  const [acoesFixas, setAcoesFixas] = useState<Record<string, { acao: AcaoFixa; fixaId: string }>>(
    {},
  );
  const [colado, setColado] = useState("");
  const [cadastroDestino, setCadastroDestino] = useState<{
    arquivoHash: string;
    tipo: "banco" | "cartao";
  } | null>(null);
  const [nomeBancoNovo, setNomeBancoNovo] = useState("");
  const [cartaoNovo, setCartaoNovo] = useState({
    apelido: "",
    final: "",
    titular: "",
    bancoId: "",
  });
  const [pdfsComSenha, setPdfsComSenha] = useState<
    { file: File; senha: string; erro: string | null; tentando: boolean }[]
  >([]);

  const { data: regras = [] } = useQuery({
    queryKey: ["categoria-regras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categoria_regras").select("*");
      if (error) throw error;
      // De-para padrão do admin entra com prioridade baixa: as regras do usuário vencem.
      const { data: padrao } = await (supabase as any)
        .from("depara_padrao")
        .select("texto,categoria,subcategoria")
        .eq("ativo", true);
      const padraoRegras: RegraUsuario[] = ((padrao ?? []) as any[]).map((p) => ({
        estabelecimento_normalizado: p.texto,
        padroes: [p.texto],
        tipo_regra: "de_para",
        categoria: p.categoria,
        subcategoria: p.subcategoria ?? null,
        prioridade: 1,
        ativo: true,
      }));
      return [...((data ?? []) as RegraUsuario[]), ...padraoRegras];
    },
  });

  /**
   * Escolhas que o usuário já fez para cada estabelecimento em importações
   * anteriores (ex.: "esta linha substitui o valor daquela despesa fixa").
   * São aplicadas sozinhas na próxima fatura.
   */
  const { data: preferenciasImportacao = [] } = useQuery({
    queryKey: ["importacao-preferencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("importacao_preferencias")
        .select("chave, escopo, acao, despesa_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvarPreferenciaImportacao = useMutation({
    mutationFn: async (p: {
      descricao: string;
      escopo: "fixa" | "duplicata";
      acao: string;
      despesaId: string | null;
    }) => {
      const chave = chaveEstabelecimento(p.descricao);
      if (!chave || !user?.id) return;
      const { data: perfil } = await supabase
        .from("profiles")
        .select("grupo_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!perfil?.grupo_id) return;
      const { error } = await supabase.from("importacao_preferencias").upsert(
        {
          grupo_id: perfil.grupo_id,
          chave,
          escopo: p.escopo,
          acao: p.acao,
          despesa_id: p.despesaId,
          criado_por: user.id,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "grupo_id,chave,escopo" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["importacao-preferencias"] }),
  });

  /**
   * Categoria e tipo que o usuário corrigiu à mão para este estabelecimento
   * (gravado ao salvar a despesa em /despesas). Vale mais que a classificação
   * automática, inclusive numa reimportação da mesma fatura.
   */
  function classificacaoCorrigida(
    descricao: string,
  ): { categoria: string; subcategoria: string | null; tipo: "fixa" | "variavel" } | null {
    const chave = chaveEstabelecimento(descricao);
    if (!chave) return null;
    const salva = (preferenciasImportacao as any[]).find(
      (p) => p.chave === chave && p.escopo === "classificacao",
    );
    if (!salva?.acao) return null;
    try {
      const v = JSON.parse(salva.acao) as {
        categoria?: string;
        subcategoria?: string | null;
        tipo?: string;
      };
      if (!v.categoria) return null;
      return {
        categoria: v.categoria,
        subcategoria: v.subcategoria ?? null,
        tipo: v.tipo === "fixa" ? "fixa" : "variavel",
      };
    } catch {
      return null;
    }
  }

  /** Preferência salva para o estabelecimento desta linha. */
  function preferenciaDe(descricao: string, escopo: "fixa" | "duplicata") {
    const chave = chaveEstabelecimento(descricao);
    if (!chave) return null;
    return (
      (preferenciasImportacao as any[]).find((p) => p.chave === chave && p.escopo === escopo) ?? null
    );
  }

  const responsaveis = useMemo(
    () => [...(profiles as any[]).map((p) => p.nome as string), RESPONSAVEIS_EXTRA],
    [profiles],
  );

  const listaCategorias = useMemo(() => {
    const nomes = new Set<string>((categorias as any[]).map((c) => c.nome as string));
    faturas.forEach((f) => f.lancamentos.forEach((l) => l.categoria && nomes.add(l.categoria)));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categorias, faturas]);

  /** Aplica o de-para e as palavras-chave em cada lançamento lido. */
  function categorizar(lancamentos: LancamentoExtraido[]): LancamentoExtraido[] {
    return lancamentos.map((l) => {
      const c = classificar(l.descricao, { regras, valor: l.valor });
      // Repete a classificação que este mesmo estabelecimento já recebeu antes
      // (ex.: "Plano Nu Cel 25,00" marcado como despesa fixa no mês passado).
      // O de-para do usuário continua mandando quando tem confiança alta.
      // 1º) o que o usuário corrigiu à mão para este estabelecimento (salvo ao
      // editar a despesa); 2º) como ele já estava classificado antes; 3º) o
      // de-para e as palavras-chave.
      const corrigida = classificacaoCorrigida(l.descricao);
      const anterior = classificacaoAnterior(l, despesasTodas as DespesaExistente[]);
      const usarAnterior = !corrigida && !!anterior && c.confianca !== "alta";
      return {
        ...l,
        categoria: corrigida?.categoria ?? (usarAnterior ? anterior!.categoria : c.categoria),
        subcategoria:
          corrigida?.subcategoria ?? (usarAnterior ? anterior!.subcategoria : c.subcategoria),
        categoria_sugerida: c.categoria,
        confianca_categoria: corrigida || usarAnterior ? "alta" : c.confianca,
        tipo: l.tipo ?? corrigida?.tipo ?? anterior?.tipo ?? "variavel",
      };
    });
  }

  const chaveDup = (hash: string, lancamentoId: string) => `${hash}:${lancamentoId}`;

  /** Lançamentos já salvos que podem ser o mesmo gasto desta linha da fatura. */
  function candidatasDe(f: FaturaItem, l: LancamentoExtraido): Candidata[] {
    return encontrarCandidatas(l, despesasTodas as DespesaExistente[]);
  }

  function acaoDuplicataDe(f: FaturaItem, l: LancamentoExtraido): AcaoDuplicata {
    const escolhida = acoesDuplicata[chaveDup(f.arquivo_hash, l.id)]?.acao;
    if (escolhida) return escolhida;
    const salva = preferenciaDe(l.descricao, "duplicata");
    return (salva?.acao as AcaoDuplicata) ?? "decidir";
  }

  /**
   * Repete, nesta fatura, as escolhas já feitas antes para os mesmos
   * estabelecimentos (ex.: "substituir o valor da despesa fixa"). O usuário
   * continua podendo trocar linha a linha.
   */
  function aplicarPreferenciasSalvas(f: FaturaItem) {
    const fixas: Record<string, { acao: AcaoFixa; fixaId: string }> = {};
    const duplicatas: Record<string, { acao: AcaoDuplicata; alvoId: string | null }> = {};
    for (const l of f.lancamentos) {
      const salvaFixa = preferenciaDe(l.descricao, "fixa");
      if (salvaFixa?.despesa_id) {
        fixas[`${f.arquivo_hash}:${l.id}`] = {
          acao: salvaFixa.acao as AcaoFixa,
          fixaId: salvaFixa.despesa_id,
        };
      }
      const salvaDup = preferenciaDe(l.descricao, "duplicata");
      if (salvaDup) {
        const c = candidatasDe(f, l);
        if (c.length)
          duplicatas[chaveDup(f.arquivo_hash, l.id)] = {
            acao: salvaDup.acao as AcaoDuplicata,
            alvoId: c[0]!.despesa.id,
          };
      }
    }
    if (Object.keys(fixas).length) setAcoesFixas((atual) => ({ ...fixas, ...atual }));
    if (Object.keys(duplicatas).length)
      setAcoesDuplicata((atual) => ({ ...duplicatas, ...atual }));
    const total = Object.keys(fixas).length + Object.keys(duplicatas).length;
    if (total) toast.info(`${total} escolha(s) de importações anteriores foram repetidas.`);
  }

  function definirAcaoDuplicata(
    f: FaturaItem,
    l: LancamentoExtraido,
    acao: AcaoDuplicata,
    alvoId: string | null,
  ) {
    setAcoesDuplicata((atual) => ({ ...atual, [chaveDup(f.arquivo_hash, l.id)]: { acao, alvoId } }));
    // Repete esta escolha na próxima fatura do mesmo estabelecimento.
    if (acao !== "decidir")
      salvarPreferenciaImportacao.mutate({
        descricao: l.descricao,
        escopo: "duplicata",
        acao,
        despesaId: null,
      });
    const idx = faturas.findIndex((x) => x.arquivo_hash === f.arquivo_hash);
    if (idx >= 0) atualizarLancamento(idx, l.id, { incluir: acao !== "manter_existente" });
  }

  /**
   * Marca todas as linhas com duplicata para substituir o lançamento já
   * cadastrado. Cada lançamento existente só pode ser usado por UMA linha: duas
   * compras iguais na mesma fatura (ex.: "Sem Parar 150,00" em dois dias) não
   * podem substituir o mesmo registro, senão uma delas se perde.
   */
  function substituirTodasDuplicatas(f: FaturaItem) {
    const novas: Record<string, { acao: AcaoDuplicata; alvoId: string | null }> = {};
    const usados = new Set<string>();
    let total = 0;
    let semAlvo = 0;
    for (const l of f.lancamentos) {
      const c = candidatasDe(f, l).filter((x) => !usados.has(x.despesa.id));
      if (!c.length) {
        // Já existia parecido, mas o único candidato foi usado por outra linha:
        // esta entra como lançamento novo, para não sumir da importação.
        if (candidatasDe(f, l).length) {
          novas[chaveDup(f.arquivo_hash, l.id)] = { acao: "novo", alvoId: null };
          semAlvo++;
        }
        continue;
      }
      usados.add(c[0]!.despesa.id);
      novas[chaveDup(f.arquivo_hash, l.id)] = { acao: "substituir", alvoId: c[0]!.despesa.id };
      total++;
    }
    if (!total) {
      toast.info("Nenhum lançamento desta fatura tem parecido já cadastrado.");
      return;
    }
    setAcoesDuplicata((atual) => ({ ...atual, ...novas }));
    toast.success(
      `${total} lançamento(s) vão substituir o que já estava cadastrado.` +
        (semAlvo ? ` ${semAlvo} entram como lançamento novo (o parecido já foi usado).` : ""),
    );
  }

  /** Cartão cadastrado com o final informado (preferindo o mesmo banco da fatura). */
  function acharCartao(banco: BancoFatura, final: string | null) {
    if (!final) return null;
    const doBanco = (cartoes as any[]).filter(
      (c) =>
        c.final === final &&
        (!c.bancos?.nome || chaveNome(c.bancos.nome) === chaveNome(BANCO_LABEL[banco])),
    );
    const qualquer = (cartoes as any[]).filter((c) => c.final === final);
    return doBanco[0] ?? qualquer[0] ?? null;
  }

  /** Destino padrão da fatura: cartão do banco (por final) ou conta bancária de mesmo nome. */
  function destinoPadrao(f: FaturaExtraida): string {
    const nome = chaveNome(BANCO_LABEL[f.banco]);
    for (const final of f.finais) {
      const c = acharCartao(f.banco, final);
      if (c) return `cartao:${c.id}`;
    }
    const cartaoBanco = (cartoes as any[]).find(
      (c) => c.bancos?.nome && chaveNome(c.bancos.nome) === nome,
    );
    if (cartaoBanco) return `cartao:${cartaoBanco.id}`;
    const banco = (bancos as any[]).find((b) => chaveNome(b.nome) === nome);
    return banco ? `banco:${banco.id}` : "";
  }

  /** Usuários do grupo + nomes de portadores lidos nas faturas (titular/adicionais). */
  const opcoesResponsavel = useMemo(() => {
    const nomes = new Set<string>(responsaveis);
    for (const f of faturas)
      for (const l of f.lancamentos) if (l.responsavel) nomes.add(l.responsavel);
    return Array.from(nomes);
  }, [responsaveis, faturas]);

  const totais = useMemo(() => {
    const lanc = faturas.flatMap((f) => f.lancamentos.filter((l) => l.incluir));
    return {
      arquivos: faturas.length,
      linhas: lanc.length,
      valor: lanc.reduce((s, l) => s + (l.direcao === "credito" ? -l.valor : l.valor), 0),
    };
  }, [faturas]);

  /** Processa um único PDF (com senha opcional) até virar um FaturaItem pronto pra revisão. */
  async function processarArquivoUnico(file: File, senha?: string): Promise<FaturaItem> {
    let extraida = await processarFatura(file, undefined, senha);
    // Se já aprendemos o padrão deste emissor, tenta a leitura guiada.
    if (
      extraida.assinatura &&
      extraida.leitura !== "fluxo" &&
      (!extraida.conferencia?.ok || !extraida.lancamentos.length)
    ) {
      const { data: perfil } = await supabase
        .from("fatura_layouts")
        .select("assinatura, banco, colunas, ancora_inicio, ancora_fim")
        .eq("assinatura", extraida.assinatura)
        .maybeSingle();
      if (perfil) {
        const alt = await processarFatura(
          file,
          {
            assinatura: perfil.assinatura,
            banco: perfil.banco,
            colunas: (perfil.colunas as any) ?? {},
            ancora_inicio: perfil.ancora_inicio,
            ancora_fim: perfil.ancora_fim,
          },
          senha,
        );
        if (
          alt.lancamentos.length &&
          (alt.conferencia?.ok || alt.lancamentos.length > extraida.lancamentos.length)
        ) {
          extraida = alt;
        }
      }
    }
    // Etapa F (plano-importacao-v2.md): aplica correções manuais já
    // ensinadas para este layout (mesma assinatura) antes de mostrar a
    // prévia — ver botão "Ensinar" na tabela de revisão, mais abaixo.
    if (extraida.assinatura) {
      const { data: aprendidas } = await supabase
        .from("fatura_correcoes_usuario")
        .select("campo, valor_original, valor_corrigido")
        .eq("assinatura", extraida.assinatura);
      if (aprendidas?.length) {
        const porCampo = {
          data_compra: new Map<string, string>(),
          descricao: new Map<string, string>(),
          valor: new Map<string, string>(),
        } as const;
        for (const a of aprendidas) {
          const mapa = (porCampo as Record<string, Map<string, string>>)[a.campo];
          mapa?.set(a.valor_original, a.valor_corrigido);
        }
        let aplicadas = 0;
        extraida = {
          ...extraida,
          lancamentos: extraida.lancamentos.map((l) => {
            let novo = l;
            const dataCorrigida = porCampo.data_compra.get(l.data_compra);
            if (dataCorrigida != null && dataCorrigida !== l.data_compra) {
              novo = { ...novo, data_compra: dataCorrigida };
              aplicadas++;
            }
            const descCorrigida = porCampo.descricao.get(l.descricao);
            if (descCorrigida != null && descCorrigida !== l.descricao) {
              novo = {
                ...novo,
                descricao: descCorrigida,
                descricao_normalizada: chaveEstabelecimento(descCorrigida),
              };
              aplicadas++;
            }
            const valorCorrigido = porCampo.valor.get(l.valor.toFixed(2));
            if (valorCorrigido != null) {
              const num = Number(valorCorrigido);
              if (Number.isFinite(num) && num !== l.valor) {
                novo = { ...novo, valor: num };
                aplicadas++;
              }
            }
            return novo;
          }),
        };
        if (aplicadas) toast.info(`${aplicadas} correção(ões) já ensinada(s) aplicada(s) de novo.`);
      }
    }
    const { data: jaExiste } = await supabase
      .from("import_faturas")
      .select("id")
      .eq("arquivo_hash", extraida.arquivo_hash)
      .maybeSingle();
    // Responsável: o nome impresso na fatura (titular/adicional) vira o
    // usuário do grupo com mesmo primeiro e último nome; sem correspondência,
    // fica o nome da fatura (aparece como opção na lista).
    const categorizados = categorizar(extraida.lancamentos).map((l) => {
      if (!l.responsavel) return l;
      const casado = responsaveis.find((r) => mesmaPessoa(r, l.responsavel));
      return casado ? { ...l, responsavel: casado } : l;
    });
    if (extraida.assinatura) {
      for (const l of categorizados) {
        baseCorrecao.current.set(l.id, {
          data_compra: l.data_compra,
          descricao: l.descricao,
          valor: l.valor,
        });
      }
    }
    return {
      ...extraida,
      lancamentos: categorizados,
      arquivo: file,
      duplicada: !!jaExiste,
      destino: destinoPadrao(extraida),
    };
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setLendo(true);
    try {
      const novos: FaturaItem[] = [];
      for (const file of Array.from(files)) {
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
          toast.error(`${file.name}: apenas PDF é aceito.`);
          continue;
        }
        try {
          novos.push(await processarArquivoUnico(file));
        } catch (erro) {
          if (erro instanceof ErroLeituraPdf && erro.codigo === "senha_necessaria") {
            setPdfsComSenha((prev) => [...prev, { file, senha: "", erro: null, tentando: false }]);
          } else if (erro instanceof ErroLeituraPdf) {
            toast.error(`${file.name}: ${erro.message}`);
          } else {
            toast.error(`${file.name}: ocorreu um erro ao ler o PDF.`);
          }
        }
      }
      setFaturas((prev) => [...prev, ...novos]);
      for (const n of novos) aplicarPreferenciasSalvas(n);
      if (novos.length) toast.success(`${novos.length} fatura(s) lida(s).`);
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /** Tenta de novo um PDF protegido, agora com a senha informada pelo usuário. */
  async function tentarComSenha(file: File) {
    const alvo = pdfsComSenha.find((p) => p.file === file);
    if (!alvo || !alvo.senha) return;
    setPdfsComSenha((prev) =>
      prev.map((p) => (p.file === file ? { ...p, tentando: true, erro: null } : p)),
    );
    try {
      const item = await processarArquivoUnico(file, alvo.senha);
      setFaturas((prev) => [...prev, item]);
    aplicarPreferenciasSalvas(item);
      aplicarPreferenciasSalvas(item);
      setPdfsComSenha((prev) => prev.filter((p) => p.file !== file));
      toast.success(`${file.name}: fatura lida.`);
    } catch (erro) {
      const mensagem =
        erro instanceof ErroLeituraPdf
          ? erro.message
          : "Não foi possível ler o PDF com essa senha.";
      setPdfsComSenha((prev) =>
        prev.map((p) => (p.file === file ? { ...p, tentando: false, erro: mensagem } : p)),
      );
    }
  }

  /** Interpreta o bloco colado (extrato, planilha, mensagens) e cria um lote editável. */
  async function importarColado() {
    const linhas = interpretarBloco(colado, {
      perfis: (profiles as any[]).map((p) => p.nome),
      cartoes: (cartoes as any[]).map((c) => ({ final: c.final, banco: c.bancos?.nome ?? null })),
    });
    if (!linhas.length) {
      toast.error("Não encontrei linhas com data, descrição e valor.");
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const lancamentos: LancamentoExtraido[] = linhas.map((l, i) => ({
      id: `colado-${i}-${Math.random().toString(36).slice(2, 8)}`,
      data_compra: l.data ?? hoje,
      descricao: l.descricao,
      descricao_normalizada: chaveEstabelecimento(l.descricao),
      valor: l.valor,
      moeda: "BRL",
      direcao: "debito",
      parcela_numero: 1,
      parcela_total: 1,
      cartao_final: null,
      responsavel: null,
      categoria: "Outros",
      confianca_data: l.data ? "alta" : "baixa",
      valor_estimado: false,
      incluir: true,
    }));
    const hash = await hashTexto(colado);
    const item: FaturaItem = {
      banco: "desconhecido",
      arquivo_nome: `Colado em ${new Date().toLocaleString("pt-BR")}`,
      arquivo_hash: hash,
      paginas: 0,
      vencimento: null,
      competencia: null,
      total_declarado: null,
      limite_total: null,
      limite_utilizado: null,
      limite_disponivel: null,
      finais: [],
      lancamentos: categorizar(lancamentos),
      texto: colado,
      arquivo: null,
      destino: "",
    };
    setFaturas((prev) => [...prev, item]);
    aplicarPreferenciasSalvas(item);
    setColado("");
    toast.success(`${linhas.length} lançamento(s) interpretado(s).`);
  }

  /** Processa prints (JPG/PNG/WEBP) por OCR no navegador e cria um lote editável por imagem. */
  async function onImages(files: FileList | null) {
    if (!files?.length) return;
    const imgs = Array.from(files).filter(
      (f) => /image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name),
    );
    if (!imgs.length) {
      toast.error("Selecione imagens (PNG, JPG ou WEBP).");
      return;
    }
    const lote = imgs.slice(0, 10);
    if (imgs.length > 10) toast.info(`Limite de 10 imagens por lote. ${lote.length} processadas.`);
    setLendoImagens(true);
    try {
      const novos: FaturaItem[] = [];
      for (const [i, file] of lote.entries()) {
        try {
          const texto = await ocrImagem(file);
          const { lancamentos, banco, finais } = lancamentosDeOcr(texto);
          const linhas = lancamentos.length
            ? lancamentos
            : [
                {
                  id: `vazio-${i}`,
                  data_compra: "",
                  descricao: "",
                  descricao_normalizada: "",
                  valor: 0,
                  moeda: "BRL",
                  direcao: "debito",
                  parcela_numero: 1,
                  parcela_total: 1,
                  cartao_final: null,
                  responsavel: null,
                  categoria: "outros",
                  confianca_data: "baixa",
                  valor_estimado: false,
                  incluir: true,
                } as (typeof lancamentos)[number],
              ];
          const arquivo_hash = await hashTextoOcr(`${file.name}-${texto}`);
          const { data: jaExiste } = await supabase
            .from("import_faturas")
            .select("id")
            .eq("arquivo_hash", arquivo_hash)
            .maybeSingle();
          const extraida = {
            banco,
            arquivo_nome: file.name,
            arquivo_hash,
            paginas: 1,
            vencimento: null,
            competencia: null,
            total_declarado: null,
            limite_total: null,
            limite_utilizado: null,
            limite_disponivel: null,
            finais,
            lancamentos: categorizar(linhas),
            texto,
          };
          novos.push({
            ...extraida,
            arquivo: null,
            duplicada: !!jaExiste,
            destino: destinoPadrao(extraida),
          });
          if (lancamentos.length)
            toast.success(`${file.name}: ${lancamentos.length} linha(s) reconhecida(s).`);
          else
            toast.warning(
              `${file.name}: não reconheci lançamentos. Deixei uma linha em branco para preencher.`,
            );
        } catch {
          toast.error(`${file.name}: não consegui ler a imagem.`);
        }
      }
      if (novos.length) {
        setFaturas((prev) => [...prev, ...novos]);
        for (const n of novos) aplicarPreferenciasSalvas(n);
      }
    } finally {
      setLendoImagens(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  }

  /** Etapa E (plano-importacao-v2.md): planilha Excel/CSV de qualquer
   * banco, com auto-detecção de colunas (ver `importacao-planilha.ts`). */
  async function importarPlanilha(files: FileList | null) {
    if (!files?.length) return;
    const lote = Array.from(files).filter((f) => /\.(xlsx|csv)$/i.test(f.name));
    if (!lote.length) {
      toast.error("Selecione um arquivo .xlsx ou .csv.");
      return;
    }
    setLendoPlanilha(true);
    try {
      const novos: FaturaItem[] = [];
      for (const file of lote) {
        try {
          const { linhas, colunas } = await lerPlanilhaImportacao(file);
          if (!linhas.length) {
            toast.error(
              !colunas.descricao || !colunas.valor
                ? `${file.name}: não encontrei colunas de descrição e valor na planilha.`
                : `${file.name}: nenhuma linha com descrição e valor válidos.`,
            );
            continue;
          }
          const hoje = new Date().toISOString().slice(0, 10);
          const lancamentos: LancamentoExtraido[] = linhas.map((l, i) => ({
            id: `planilha-${i}-${Math.random().toString(36).slice(2, 8)}`,
            data_compra: l.data ?? hoje,
            descricao: l.descricao,
            descricao_normalizada: chaveEstabelecimento(l.descricao),
            valor: l.valor,
            moeda: "BRL",
            direcao: l.direcao,
            parcela_numero: l.parcela_numero,
            parcela_total: l.parcela_total,
            cartao_final: null,
            responsavel: null,
            categoria: "Outros",
            confianca_data: l.data ? "alta" : "baixa",
            valor_estimado: false,
            incluir: true,
          }));
          const arquivo_hash = await hashTexto(`${file.name}-${file.size}-${file.lastModified}`);
          const { data: jaExiste } = await supabase
            .from("import_faturas")
            .select("id")
            .eq("arquivo_hash", arquivo_hash)
            .maybeSingle();
          const extraida = {
            banco: "desconhecido" as BancoFatura,
            arquivo_nome: file.name,
            arquivo_hash,
            paginas: 0,
            vencimento: null,
            competencia: null,
            total_declarado: null,
            limite_total: null,
            limite_utilizado: null,
            limite_disponivel: null,
            finais: [],
            lancamentos: categorizar(lancamentos),
            texto: "",
          };
          novos.push({
            ...extraida,
            arquivo: null,
            duplicada: !!jaExiste,
            destino: destinoPadrao(extraida),
          });
          toast.success(`${file.name}: ${linhas.length} lançamento(s) interpretado(s).`);
        } catch (erro) {
          toast.error(
            erro instanceof Error
              ? `${file.name}: ${erro.message}`
              : `${file.name}: não consegui ler a planilha.`,
          );
        }
      }
      if (novos.length) {
        setFaturas((prev) => [...prev, ...novos]);
        for (const n of novos) aplicarPreferenciasSalvas(n);
      }
    } finally {
      setLendoPlanilha(false);
      if (planilhaInputRef.current) planilhaInputRef.current.value = "";
    }
  }

  function atualizarFatura(idx: number, patch: Partial<FaturaItem>) {
    setFaturas((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  const cadastrarDestino = useMutation({
    mutationFn: async () => {
      if (!cadastroDestino) throw new Error("Escolha uma fatura.");
      if (cadastroDestino.tipo === "banco") {
        const nome = nomeBancoNovo.trim();
        if (nome.length < 2) throw new Error("Informe o nome do banco ou conta.");
        const { data, error } = await supabase
          .from("bancos")
          .insert({ nome, tipo_conta: "outros", titular: profiles[0]?.nome ?? null })
          .select("*")
          .single();
        if (error) throw error;
        qc.setQueryData(["bancos"], (anterior: typeof bancos | undefined) => [
          ...(anterior ?? []),
          data,
        ]);
        return `banco:${data.id}`;
      }
      const final = cartaoNovo.final.trim();
      if (!/^\d{4}$/.test(final)) throw new Error("Informe os quatro últimos dígitos do cartão.");
      if (!cartaoNovo.titular.trim()) throw new Error("Informe o titular do cartão.");
      const { data, error } = await supabase
        .from("cartoes")
        .insert({
          apelido: cartaoNovo.apelido.trim() || `Cartão •${final}`,
          final,
          titular: cartaoNovo.titular.trim(),
          banco_id: cartaoNovo.bancoId || null,
          bandeira: "Não informada",
          tipo: "credito",
        })
        .select("*, bancos(nome)")
        .single();
      if (error) throw error;
      qc.setQueryData(["cartoes"], (anterior: typeof cartoes | undefined) => [
        ...(anterior ?? []),
        data,
      ]);
      return `cartao:${data.id}`;
    },
    onSuccess: (destino) => {
      setFaturas((atuais) =>
        atuais.map((f) =>
          f.arquivo_hash === cadastroDestino?.arquivoHash ? { ...f, destino } : f,
        ),
      );
      setCadastroDestino(null);
      toast.success("Cadastro concluído. Continue a importação normalmente.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  function atualizarLancamento(idx: number, id: string, patch: Partial<LancamentoExtraido>) {
    if ("categoria" in patch || "subcategoria" in patch) {
      classificacoesEditadas.current.add(`${faturas[idx]?.arquivo_hash}:${id}`);
    }
    setFaturas((prev) =>
      prev.map((f, i) =>
        i === idx
          ? { ...f, lancamentos: f.lancamentos.map((l) => (l.id === id ? { ...l, ...patch } : l)) }
          : f,
      ),
    );
  }

  async function gravarRegra(l: LancamentoExtraido) {
    const chave = chaveEstabelecimento(l.descricao);
    const item = {
      texto_original: l.descricao,
      estabelecimento_normalizado: chave,
      tipo_regra: "de_para",
      categoria: l.categoria,
      subcategoria: l.subcategoria ?? null,
      prioridade: 300,
      ativo: true,
      created_by: user?.id ?? null,
    };
    const { data: existente } = await supabase
      .from("categoria_regras")
      .select("id")
      .eq("estabelecimento_normalizado", chave)
      .eq("tipo_regra", "de_para")
      .maybeSingle();
    if (existente) {
      const { error } = await supabase.from("categoria_regras").update(item).eq("id", existente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("categoria_regras").insert(item);
      if (error) throw error;
    }
    const { data: categoriaExistente, error: buscaCategoriaErro } = await supabase
      .from("categorias")
      .select("id")
      .eq("tipo", "despesa")
      .ilike("nome", l.categoria)
      .limit(1)
      .maybeSingle();
    if (buscaCategoriaErro) throw buscaCategoriaErro;
    if (!categoriaExistente) {
      const { error } = await supabase
        .from("categorias")
        .insert({ nome: l.categoria, tipo: "despesa" });
      if (error) throw error;
    }
  }

  /** Etapa F: grava a(s) diferença(s) entre o valor atual do lançamento e
   * sua linha de base (`baseCorrecao`) como correção aprendida para esta
   * assinatura de layout — e passa a ser a nova linha de base, pra não
   * reoferecer "Ensinar" de novo sem uma edição nova. */
  const ensinarCorrecao = useMutation({
    mutationFn: async ({ assinatura, l }: { assinatura: string; l: LancamentoExtraido }) => {
      const base = baseCorrecao.current.get(l.id);
      if (!base) return 0;
      const diffs: {
        campo: "data_compra" | "descricao" | "valor";
        original: string;
        corrigido: string;
      }[] = [];
      if (base.data_compra !== l.data_compra) {
        diffs.push({ campo: "data_compra", original: base.data_compra, corrigido: l.data_compra });
      }
      if (base.descricao !== l.descricao) {
        diffs.push({ campo: "descricao", original: base.descricao, corrigido: l.descricao });
      }
      if (base.valor !== l.valor) {
        diffs.push({
          campo: "valor",
          original: base.valor.toFixed(2),
          corrigido: l.valor.toFixed(2),
        });
      }
      if (!diffs.length) return 0;
      for (const d of diffs) {
        const { error } = await supabase.from("fatura_correcoes_usuario").upsert(
          {
            assinatura,
            campo: d.campo,
            valor_original: d.original,
            valor_corrigido: d.corrigido,
            created_by: user?.id ?? null,
          },
          { onConflict: "assinatura,campo,valor_original" },
        );
        if (error) throw error;
      }
      baseCorrecao.current.set(l.id, {
        data_compra: l.data_compra,
        descricao: l.descricao,
        valor: l.valor,
      });
      return diffs.length;
    },
    onSuccess: (n: number) => {
      if (n > 0)
        toast.success("Correção ensinada — as próximas faturas deste layout já virão certas.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a correção."),
  });

  const salvarRegra = useMutation({
    mutationFn: async (l: LancamentoExtraido) => {
      const chave = chaveEstabelecimento(l.descricao);
      const { data: existente, error } = await supabase
        .from("categoria_regras")
        .select("id, categoria, subcategoria")
        .eq("estabelecimento_normalizado", chave)
        .eq("tipo_regra", "de_para")
        .maybeSingle();
      if (error) throw error;
      if (
        existente &&
        existente.categoria === l.categoria &&
        (existente.subcategoria ?? null) === (l.subcategoria ?? null)
      ) {
        if (exclusaoBloqueada)
          throw new Error("Seu perfil não possui permissão para remover regras.");
        const { error: removerErro } = await supabase
          .from("categoria_regras")
          .delete()
          .eq("id", existente.id);
        if (removerErro) throw removerErro;
        return "removida" as const;
      }
      await gravarRegra(l);
      return "salva" as const;
    },
    onSuccess: (acao) => {
      qc.invalidateQueries({ queryKey: ["categoria-regras"] });
      qc.invalidateQueries({ queryKey: ["categorias", "despesa"] });
      toast.success(acao === "removida" ? "Regra de de-para removida." : "Regra de de-para salva.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar a regra."),
  });

  /**
   * "Ajustar a fixa a partir desta competência": encerra a recorrência antiga
   * no mês anterior e cria a continuação com o novo valor, levando junto as
   * ocorrências já geradas (e pagas) deste mês em diante. Os meses anteriores
   * não mudam. Se a competência é o próprio início da fixa, só troca o valor.
   */
  async function ajustarFixaAPartirDe(p: {
    fixaId: string;
    grupoId: string;
    competencia: string;
    valor: number;
    faturaId: string;
  }) {
    const { data: fixa, error } = await supabase
      .from("despesas")
      .select("*")
      .eq("id", p.fixaId)
      .eq("grupo_id", p.grupoId)
      .single();
    if (error || !fixa) throw new Error("A despesa fixa escolhida não está disponível neste grupo.");
    const f = fixa as any;
    const inicio: string = f.recorrencia_inicio ?? f.data_primeira_parcela;
    const decorridos = mesesEntreCompetencias(inicio, p.competencia);
    const deData = `${p.competencia}-01`;
    const centavos = Math.round(p.valor * 100);
    let alvoId: string = f.id;
    if (decorridos <= 0) {
      const { error: e1 } = await supabase
        .from("despesas")
        .update({ valor_total: p.valor, valor_total_centavos: centavos } as any)
        .eq("id", f.id);
      if (e1) throw e1;
    } else {
      const restantes = f.recorrencia_sem_prazo
        ? null
        : Math.max(1, Number(f.recorrencia_meses ?? decorridos + 1) - decorridos);
      const { error: e1 } = await supabase
        .from("despesas")
        .update({ recorrencia_sem_prazo: false, recorrencia_meses: decorridos } as any)
        .eq("id", f.id);
      if (e1) throw e1;
      const { id: _id, created_at: _c, updated_at: _u, parcelas: _p, ...resto } = f;
      const inicioNovo = vencimentoDaCompetencia(inicio, p.competencia);
      const { data: nova, error: e2 } = await supabase
        .from("despesas")
        .insert({
          ...resto,
          valor_total: p.valor,
          valor_total_centavos: centavos,
          data_compra: inicioNovo,
          data_primeira_parcela: inicioNovo,
          recorrencia_inicio: inicioNovo,
          recorrencia_sem_prazo: !!f.recorrencia_sem_prazo,
          recorrencia_meses: restantes,
          created_by: user?.id ?? f.created_by ?? null,
        } as any)
        .select("id")
        .single();
      if (e2 || !nova) throw e2 ?? new Error("Não foi possível criar a continuação da fixa.");
      alvoId = nova.id;
      const { error: e3 } = await supabase
        .from("parcelas")
        .update({ despesa_id: alvoId } as any)
        .eq("despesa_id", f.id)
        .gte("vencimento", deData);
      if (e3) throw e3;
    }
    const { error: e4 } = await supabase
      .from("parcelas")
      .update({ valor: p.valor } as any)
      .eq("despesa_id", alvoId)
      .gte("vencimento", deData)
      .eq("paga", false);
    if (e4) throw e4;
    const { data: doMes } = await supabase
      .from("parcelas")
      .select("id")
      .eq("despesa_id", alvoId)
      .gte("vencimento", deData)
      .lt("vencimento", `${somarMeses(p.competencia, 1)}-01`)
      .maybeSingle();
    if (doMes) {
      const { error: e5 } = await supabase
        .from("parcelas")
        .update({ fatura_id: p.faturaId, origem: "importacao_vinculo" } as any)
        .eq("id", doMes.id);
      if (e5) throw e5;
    }
  }

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Entre na sua conta para importar faturas.");
      const { data: perfil, error: perfilErr } = await supabase
        .from("profiles")
        .select("grupo_id")
        .eq("id", user.id)
        .single();
      if (perfilErr) throw perfilErr;
      if (!perfil.grupo_id) throw new Error("Não foi possível identificar o seu grupo.");
      const grupoId = perfil.grupo_id;
      const totaisPendentes: string[] = [];
      for (const f of faturas) {
        const [tipoDestino, idDestino] = String(f.destino ?? "").split(":");
        const ids = new Set<string>();
        if (tipoDestino === "cartao" && idDestino) ids.add(idDestino);
        f.lancamentos.forEach((l) => {
          const c = acharCartao(f.banco, l.cartao_final);
          if (c?.id) ids.add(c.id);
        });
        const comp = f.competencia ?? f.vencimento?.slice(0, 7);
        if (!comp || !ids.size) continue;
        const { data } = await supabase
          .from("fatura_mes")
          .select("id,cartao_id,competencia")
          .in("cartao_id", [...ids])
          .eq("competencia", comp)
          .eq("modo_calculo", "somente_total")
          .eq("status", "aberta");
        if (data?.length) totaisPendentes.push(`${f.arquivo_nome} (${comp})`);
      }
      if (
        totaisPendentes.length &&
        !window.confirm(
          `Há um total manual para:\n\n${totaisPendentes.join("\n")}\n\nDeseja concluir esse lançamento e usar os itens desta importação? O total manual continuará no histórico, tachado.`,
        )
      )
        throw new Error("Importação cancelada para preservar o total manual.");
      const regrasAprendidas = new Map<string, LancamentoExtraido>();
      faturas.forEach((f) =>
        f.lancamentos.forEach((l) => {
          if (l.incluir && classificacoesEditadas.current.has(`${f.arquivo_hash}:${l.id}`)) {
            regrasAprendidas.set(chaveEstabelecimento(l.descricao), l);
          }
        }),
      );

      const { data: lote, error: loteErr } = await supabase
        .from("import_lotes")
        .insert({ created_by: user?.id ?? null, status: "confirmado" })
        .select("id")
        .single();
      if (loteErr) throw loteErr;

      let inseridos = 0;
      let ignorados = 0;
      // Um lançamento já cadastrado só pode ser substituído por UMA linha.
      const alvosUsados = new Set<string>();
      let fechadas = 0;
      // Parcelas do mês anterior quitadas por causa do pagamento que veio na fatura.
      let quitadas = 0;

      // Etapa D: ponto final e autoritativo de aplicação das permissões de
      // importação — mesmo que algum estado de UI escapasse do bloqueio nos
      // controles (ex.: fatura adicionada por outro fluxo), nada entra no
      // banco fora do que o usuário tem permissão de importar.
      const permitido = (l: LancamentoExtraido) =>
        l.incluir && (l.parcela_total > 1 ? podeImportarParcelamentos : podeImportarLancamentos);

      for (const f of faturas) {
        const cartoesTocados = new Set<string>();
        const [tipoDestinoFatura, idDestinoFatura] = String(f.destino ?? "").split(":");
        const cartaoPrincipal =
          tipoDestinoFatura === "cartao"
            ? idDestinoFatura
            : (f.lancamentos.map((l) => acharCartao(f.banco, l.cartao_final)?.id).find(Boolean) ??
              null);
        // Etapa C (plano-importacao-v2, 2026-10-02): o arquivo em si nunca é
        // mais enviado ao Storage — só hash + metadados do lote (lidos
        // acima, antes deste loop) seguem gravados, pra evitar reimportar o
        // mesmo arquivo sem querer. `storage_path` fica sempre nulo agora;
        // a coluna continua existindo só por histórico de faturas já
        // importadas antes desta mudança.
        const path: string | null = null;

        const { data: fatura, error: fatErr } = await supabase
          .from("import_faturas")
          .upsert(
            {
              lote_id: lote.id,
              grupo_id: grupoId,
              banco: f.banco,
              arquivo_nome: f.arquivo_nome,
              arquivo_hash: f.arquivo_hash,
              storage_path: path,
              vencimento: f.vencimento,
              competencia: f.competencia,
              total_declarado: f.total_declarado,
              limite_total: podeImportarLimite ? f.limite_total : null,
              limite_utilizado: podeImportarLimite ? f.limite_utilizado : null,
              limite_disponivel: podeImportarLimite ? f.limite_disponivel : null,
              cartao_id: cartaoPrincipal || null,
              total_extraido: f.lancamentos
                .filter(permitido)
                .reduce((s, l) => s + (l.direcao === "credito" ? -l.valor : l.valor), 0),
              paginas: f.paginas,
              status: "importada",
            },
            { onConflict: "grupo_id,arquivo_hash" },
          )
          .select("id")
          .single();
        if (fatErr) throw fatErr;

        for (const l of f.lancamentos.filter(permitido)) {
          const dup = acoesDuplicata[chaveDup(f.arquivo_hash, l.id)];
          // "Criar um novo" ganha uma chave própria: são dois gastos iguais de
          // verdade, então não podem colidir na chave de deduplicação.
          const chave =
            dup?.acao === "novo" ? `${dedupKey(l)}#novo-${Date.now()}-${l.id}` : dedupKey(l);
          const { data: existente } = await supabase
            .from("despesas")
            .select("id")
            .eq("grupo_id", grupoId)
            .eq("dedup_key", chave)
            .maybeSingle();
          // Linha idêntica já importada antes: pula, a não ser que o usuário
          // tenha escolhido no popup o que fazer com ela.
          if (existente && !dup) {
            ignorados++;
            continue;
          }
          if (existente && dup?.acao === "substituir" && !dup.alvoId) {
            dup.alvoId = existente.id;
          }

          const venc = f.vencimento ?? l.data_compra;
          const primeira = vencimentoParcela(venc, l.parcela_numero, 1);

          // Vincula ao cartão pelo final; senão usa o destino escolhido para a fatura.
          const cartaoLinha = acharCartao(f.banco, l.cartao_final);
          const [tipoDestino, idDestino] = String(f.destino ?? "").split(":");
          const cartaoId =
            cartaoLinha?.id ?? (tipoDestino === "cartao" ? (idDestino ?? null) : null);
          const bancoId = cartaoId ? null : tipoDestino === "banco" ? (idDestino ?? null) : null;
          const cartaoDestino = cartaoId
            ? ((cartoes as any[]).find((c) => c.id === cartaoId) ?? null)
            : null;

          // Escolha feita no popup de duplicidade (ver DuplicidadeDialog).
          if (dup?.acao === "manter_existente") {
            ignorados++;
            continue;
          }
          if (dup?.acao === "substituir" && dup.alvoId && !alvosUsados.has(dup.alvoId)) {
            alvosUsados.add(dup.alvoId);
            const { error: subErro } = await supabase
              .from("despesas")
              .update({
                descricao: l.descricao,
                descricao_normalizada: l.descricao_normalizada,
                valor_total: Number((l.valor * l.parcela_total).toFixed(2)),
                moeda: l.moeda,
                categoria: l.categoria,
                subcategoria: l.subcategoria ?? null,
                categoria_confirmada: true,
                estabelecimento_normalizado: chaveEstabelecimento(l.descricao),
                tipo: l.tipo ?? "variavel",
                data_compra: l.data_compra,
                total_parcelas: l.parcela_total,
                data_primeira_parcela: primeira,
                responsavel: l.responsavel,
                cartao_id: cartaoId,
                banco_id: bancoId,
                cartao_final: l.cartao_final ?? cartaoDestino?.final ?? null,
                direcao: l.direcao,
                origem: "importacao_substituicao",
                fatura_id: fatura.id,
                dedup_key: chave,
              } as any)
              .eq("id", dup.alvoId)
              .eq("grupo_id", grupoId);
            if (subErro) throw subErro;
            // Refaz TODAS as parcelas com os dados da fatura, guardando o que
            // já estava pago. Antes só as não pagas eram refeitas, e a parcela
            // paga ficava com o vencimento antigo — o lançamento sumia do mês
            // da fatura e a soma da tela de Despesas não batia com a fatura.
            const { data: antigas } = await supabase
              .from("parcelas")
              .select("numero, paga, data_pagamento")
              .eq("despesa_id", dup.alvoId);
            const pagamentoPorNumero = new Map<number, string | null>(
              (antigas ?? [])
                .filter((x: any) => x.paga)
                .map((x: any) => [Number(x.numero), x.data_pagamento ?? null]),
            );
            const { error: delParc } = await supabase
              .from("parcelas")
              .delete()
              .eq("despesa_id", dup.alvoId);
            if (delParc) throw delParc;
            const novas = Array.from({ length: l.parcela_total }, (_, i) => i + 1).map((numero) => {
              const paga = pagamentoPorNumero.has(numero) || numero < l.parcela_numero;
              return {
                despesa_id: dup.alvoId,
                numero,
                total: l.parcela_total,
                valor: l.valor,
                moeda: l.moeda,
                vencimento: vencimentoParcela(venc, l.parcela_numero, numero),
                paga,
                data_pagamento: pagamentoPorNumero.get(numero) ?? null,
                origem: "importacao_substituicao",
                valor_estimado: numero !== l.parcela_numero,
                confianca_data: l.confianca_data,
                fatura_id: fatura.id,
                dedup_key: `${chave}#${numero}`,
                grupo_id: grupoId,
              };
            });
            const { error: insParc } = await supabase.from("parcelas").insert(novas as any);
            if (insParc) throw insParc;
            if (cartaoId) cartoesTocados.add(cartaoId);
            inseridos++;
            continue;
          }

          const acaoFixa = acoesFixas[`${f.arquivo_hash}:${l.id}`];
          if (acaoFixa?.acao === "ignorar") {
            ignorados++;
            continue;
          }
          if (
            acaoFixa &&
            (acaoFixa.acao === "substituir" ||
              acaoFixa.acao === "vincular" ||
              acaoFixa.acao === "ajustar")
          ) {
            const { data: fixa, error: fixaErro } = await supabase
              .from("despesas")
              .select(
                "id, descricao, valor_total, tipo, direcao, cartao_id, cartao_final, banco_id, recorrencia_inicio, recorrencia_meses, data_primeira_parcela, total_parcelas",
              )
              .eq("id", acaoFixa.fixaId)
              .eq("grupo_id", grupoId)
              .single();
            if (fixaErro || !fixa)
              throw new Error("A despesa fixa escolhida não está disponível neste grupo.");
            const correspondencia = encontrarCorrespondenciaFixa([fixa], {
              descricao: l.descricao,
              valor: l.valor,
              direcao: l.direcao,
              data_compra: l.data_compra,
              parcela_total: l.parcela_total,
              cartao_final: l.cartao_final,
              cartao_id: cartaoId,
              banco_id: bancoId,
              competencia: f.competencia,
            });
            if (!correspondencia)
              throw new Error("A correspondência com a despesa fixa mudou. Revise esta linha.");
            const competencia = (f.competencia ?? l.data_compra).slice(0, 7);
            if (acaoFixa.acao === "ajustar") {
              await ajustarFixaAPartirDe({
                fixaId: fixa.id,
                grupoId,
                competencia,
                valor: l.valor,
                faturaId: fatura.id,
              });
              inseridos++;
              continue;
            }
            const { data: parcelaExistente, error: parcelaErro } = await supabase
              .from("parcelas")
              .select("id, fatura_id")
              .eq("despesa_id", fixa.id)
              .gte("vencimento", `${competencia}-01`)
              .lt("vencimento", `${somarMeses(competencia, 1)}-01`)
              .maybeSingle();
            if (parcelaErro) throw parcelaErro;
            if (parcelaExistente?.fatura_id && parcelaExistente.fatura_id !== fatura.id) {
              throw new Error(
                "Esta ocorrência já está vinculada a outra fatura. Revise antes de substituir.",
              );
            }
            const inicio = fixa.recorrencia_inicio ?? fixa.data_primeira_parcela;
            const numero = mesesEntreCompetencias(inicio, competencia) + 1;
            const valores = {
              fatura_id: fatura.id,
              origem:
                acaoFixa.acao === "substituir" ? "importacao_substituicao" : "importacao_vinculo",
              ...(acaoFixa.acao === "substituir" ? { valor: l.valor, valor_estimado: false } : {}),
            };
            if (parcelaExistente) {
              const { error } = await supabase
                .from("parcelas")
                .update(valores)
                .eq("id", parcelaExistente.id);
              if (error) throw error;
            } else {
              const { error } = await supabase.from("parcelas").insert({
                despesa_id: fixa.id,
                grupo_id: grupoId,
                numero,
                total: fixa.recorrencia_meses ?? Math.max(numero, 1),
                valor: acaoFixa.acao === "substituir" ? l.valor : Number(fixa.valor_total),
                moeda: l.moeda,
                vencimento: vencimentoDaCompetencia(inicio, competencia),
                paga: false,
                ...valores,
              });
              if (error) throw error;
            }
            inseridos++;
            continue;
          }

          // Importar faturas de meses anteriores (histórico): a MESMA compra
          // parcelada aparece em várias faturas, só mudando o número da
          // parcela (3/12, 4/12...). Como a chave de deduplicação inclui esse
          // número, sem este passo cada fatura criaria um parcelamento novo e a
          // dívida apareceria dobrada. Aqui o parcelamento é reconhecido pela
          // compra em si (estabelecimento + data da compra + total de parcelas
          // + cartão) e só a parcela daquele mês é completada.
          if (l.parcela_total > 1) {
            const { data: mesmoParcelamento } = await supabase
              .from("despesas")
              .select("id, valor_total")
              .eq("grupo_id", grupoId)
              .eq("estabelecimento_normalizado", chaveEstabelecimento(l.descricao))
              .eq("data_compra", l.data_compra)
              .eq("total_parcelas", l.parcela_total)
              .limit(1)
              .maybeSingle();
            if (mesmoParcelamento) {
              const vencimentoDaParcela = vencimentoParcela(venc, l.parcela_numero, l.parcela_numero);
              const { data: parcelaExistente } = await supabase
                .from("parcelas")
                .select("id")
                .eq("despesa_id", mesmoParcelamento.id)
                .eq("numero", l.parcela_numero)
                .maybeSingle();
              if (parcelaExistente) {
                const { error: eAtual } = await supabase
                  .from("parcelas")
                  .update({
                    valor: l.valor,
                    valor_estimado: false,
                    vencimento: vencimentoDaParcela,
                    fatura_id: fatura.id,
                  } as any)
                  .eq("id", parcelaExistente.id);
                if (eAtual) throw eAtual;
              } else {
                const { error: eNova } = await supabase.from("parcelas").insert({
                  despesa_id: mesmoParcelamento.id,
                  numero: l.parcela_numero,
                  total: l.parcela_total,
                  valor: l.valor,
                  moeda: l.moeda,
                  vencimento: vencimentoDaParcela,
                  paga: false,
                  origem: "importacao",
                  valor_estimado: false,
                  confianca_data: l.confianca_data,
                  fatura_id: fatura.id,
                  grupo_id: grupoId,
                } as any);
                if (eNova) throw eNova;
              }
              if (cartaoId) cartoesTocados.add(cartaoId);
              inseridos++;
              continue;
            }
          }

          const { data: despesa, error: despErr } = await supabase
            .from("despesas")
            .insert({
              descricao: l.descricao,
              descricao_normalizada: l.descricao_normalizada,
              valor_total: Number((l.valor * l.parcela_total).toFixed(2)),
              moeda: l.moeda,
              categoria: l.categoria,
              subcategoria: l.subcategoria ?? null,
              categoria_sugerida: l.categoria_sugerida ?? null,
              confianca_categoria: l.confianca_categoria ?? null,
              categoria_confirmada: true,
              estabelecimento_normalizado: chaveEstabelecimento(l.descricao),
              tipo: l.tipo ?? "variavel",
              data_compra: l.data_compra,
              total_parcelas: l.parcela_total,
              data_primeira_parcela: primeira,
              // Marcar "Fixa" na importação já registra a recorrência (sem
              // prazo, mensal, sem reajuste) a partir deste mês — assim ela
              // passa a aparecer sozinha em todos os meses futuros, do
              // mesmo jeito que uma despesa fixa cadastrada em /despesas.
              // Só faz sentido pra lançamento não parcelado (parcela 1/1):
              // um item parcelado marcado como fixa por engano não deveria
              // virar recorrência sem prazo pelo valor total das parcelas.
              ...(l.tipo === "fixa" && l.parcela_total <= 1
                ? { recorrencia_inicio: primeira, recorrencia_sem_prazo: true }
                : {}),
              responsavel: l.responsavel,
              cartao_id: cartaoId,
              banco_id: bancoId,
              banco_nome: cartaoDestino?.bancos?.nome ?? BANCO_LABEL[f.banco],
              cartao_final: l.cartao_final ?? cartaoDestino?.final ?? null,
              direcao: l.direcao,
              origem: "importacao",
              fatura_id: fatura.id,
              dedup_key: chave,
              grupo_id: grupoId,
              created_by: user?.id ?? null,
            })
            .select("id")
            .single();
          if (despErr) throw despErr;

          const parcelas = Array.from({ length: l.parcela_total }, (_, i) => {
            const numero = i + 1;
            return {
              despesa_id: despesa.id,
              numero,
              total: l.parcela_total,
              valor: l.valor,
              moeda: l.moeda,
              vencimento: vencimentoParcela(venc, l.parcela_numero, numero),
              paga: numero <= l.parcela_numero,
              situacao_temporal:
                numero < l.parcela_numero
                  ? "passada"
                  : numero === l.parcela_numero
                    ? "atual"
                    : "futura",
              origem: "importacao",
              valor_estimado: numero !== l.parcela_numero,
              confianca_data: l.confianca_data,
              fatura_id: fatura.id,
              dedup_key: `${chave}#${numero}`,
              grupo_id: grupoId,
            };
          });
          const { error: parcErr } = await supabase.from("parcelas").insert(parcelas);
          if (parcErr) throw parcErr;
          if (cartaoId) cartoesTocados.add(cartaoId);
          inseridos++;
        }

        // Fatura real chegou: encerra a competência e remove a estimativa do mês.
        const comp = f.competencia ?? (f.vencimento ? f.vencimento.slice(0, 7) : null);
        if (comp && cartoesTocados.size) {
          for (const cartaoId of cartoesTocados) {
            const { data: rapida } = await supabase
              .from("fatura_mes")
              .select("id, despesa_avulsa_id, modo_calculo")
              .eq("cartao_id", cartaoId)
              .eq("competencia", comp)
              .maybeSingle();
            if (!rapida) continue;
            if (rapida.despesa_avulsa_id && rapida.modo_calculo === "somente_total") {
              await supabase
                .from("despesas")
                .update({ origem: "fatura_total_concluida" })
                .eq("id", rapida.despesa_avulsa_id);
            } else if (rapida.despesa_avulsa_id) {
              await supabase.from("parcelas").delete().eq("despesa_id", rapida.despesa_avulsa_id);
              await supabase.from("despesas").delete().eq("id", rapida.despesa_avulsa_id);
            }
            await supabase
              .from("fatura_mes")
              .update({
                status: "fechada",
                fechada_em: new Date().toISOString(),
                despesa_avulsa_id:
                  rapida.modo_calculo === "somente_total" ? rapida.despesa_avulsa_id : null,
                concluida_por_importacao_em: new Date().toISOString(),
                total_real: f.total_declarado ?? null,
              })
              .eq("id", rapida.id);
            fechadas++;
          }
          await supabase
            .from("import_faturas")
            .update({ status: "fechada", fechada_em: new Date().toISOString() })
            .eq("id", fatura.id);
        }

        // A fatura traz o pagamento do mês anterior ("PAGAMENTO DE FATURA",
        // "Pagamento via conta"): isso é a prova de que a fatura passada foi
        // paga. Se as parcelas daquele mês ainda estiverem em aberto, marca
        // como pagas agora, para o mês anterior parar de aparecer como devendo.
        const pagouAnterior = f.lancamentos.some(
          (l) => l.direcao === "credito" && detectarTipoLancamento(l.descricao, -l.valor) === "pagamento",
        );
        if (pagouAnterior && comp) {
          const anterior = somarMeses(comp, -1);
          const inicio = `${anterior}-01`;
          const fim = `${somarMeses(anterior, 1)}-01`;
          const cartoesParaQuitar = cartoesTocados.size
            ? [...cartoesTocados]
            : cartaoPrincipal
              ? [cartaoPrincipal]
              : [];
          for (const cartaoId of cartoesParaQuitar) {
            const { data: despesasDoCartao } = await supabase
              .from("despesas")
              .select("id")
              .eq("grupo_id", grupoId)
              .eq("cartao_id", cartaoId);
            const ids = (despesasDoCartao ?? []).map((d: { id: string }) => d.id);
            if (!ids.length) continue;
            const { data: emAberto } = await supabase
              .from("parcelas")
              .select("id")
              .in("despesa_id", ids)
              .eq("paga", false)
              .gte("vencimento", inicio)
              .lt("vencimento", fim);
            if (!emAberto?.length) continue;
            const { error: erroQuitar } = await supabase
              .from("parcelas")
              .update({ paga: true, data_pagamento: inicio } as never)
              .in(
                "id",
                emAberto.map((x: { id: string }) => x.id),
              );
            if (erroQuitar) throw erroQuitar;
            quitadas += emAberto.length;
          }
          if (quitadas) {
            await supabase
              .from("fatura_mes")
              .update({ status: "paga" } as never)
              .eq("grupo_id", grupoId)
              .eq("competencia", anterior)
              .in("cartao_id", cartoesParaQuitar);
          }
        }

        // Memoriza o padrão deste emissor para as próximas faturas iguais.
        if (f.assinatura && f.lancamentos.some((l) => l.incluir)) {
          const { data: perfilAtual } = await supabase
            .from("fatura_layouts")
            .select("id, acertos")
            .eq("assinatura", f.assinatura)
            .maybeSingle();
          if (perfilAtual) {
            await supabase
              .from("fatura_layouts")
              .update({
                acertos: (perfilAtual.acertos ?? 1) + 1,
                ultimo_uso: new Date().toISOString(),
                banco: f.banco,
                ...(f.colunas && Object.keys(f.colunas).length ? { colunas: f.colunas } : {}),
              })
              .eq("id", perfilAtual.id);
          } else {
            await supabase.from("fatura_layouts").insert({
              assinatura: f.assinatura,
              banco: f.banco,
              emissor: BANCO_LABEL[f.banco],
              colunas: f.colunas ?? {},
              formato_data: "auto",
              formato_valor: "pt-BR",
            });
          }
        }
      }

      let falhasDePara = 0;
      for (const regra of regrasAprendidas.values()) {
        try {
          await gravarRegra(regra);
        } catch {
          falhasDePara++;
        }
      }
      return {
        inseridos,
        ignorados,
        fechadas,
        quitadas,
        falhasDePara,
        regrasSalvas: regrasAprendidas.size - falhasDePara,
      };
    },
    onSuccess: ({ inseridos, ignorados, fechadas, quitadas, falhasDePara, regrasSalvas }) => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["fatura-mes"] });
      qc.invalidateQueries({ queryKey: ["import-faturas"] });
      qc.invalidateQueries({ queryKey: ["categoria-regras"] });
      setFaturas([]);
      setAcoesFixas({});
      classificacoesEditadas.current.clear();
      toast.success(
        `${inseridos} lançamento(s) importado(s). ${ignorados} duplicado(s) ignorado(s).` +
          (fechadas ? ` ${fechadas} competência(s) fechada(s).` : ""),
      );
      if (quitadas)
        toast.success(
          `A fatura traz o pagamento do mês anterior: ${quitadas} parcela(s) daquele mês foram marcadas como pagas.`,
          { duration: 8000 },
        );
      toast.info(
        "O arquivo enviado foi processado e descartado — nada além dos lançamentos foi armazenado.",
      );
      if (regrasSalvas)
        toast.info(`${regrasSalvas} classificação(ões) aprendida(s) para próximas importações.`);
      if (falhasDePara)
        toast.warning(`${falhasDePara} regra(s) de de-para não puderam ser salvas.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao importar."),
  });

  // Etapa D (plano-importacao-v2.md): permissão granular de importação por
  // usuário. "Ver" bloqueia a tela inteira; as outras três controlam,
  // dentro da tela, o que pode efetivamente ser enviado.
  const podeVerImportar = can("importar", "ver");
  const podeImportarLancamentos = canImportar("lancamentos");
  const podeImportarParcelamentos = canImportar("parcelamentos");
  const podeImportarLimite = canImportar("limite");

  if (!podeVerImportar) {
    return (
      <AppLayout title="Importar Lançamentos">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Seu usuário não tem permissão para importar lançamentos. Fale com um administrador se
              precisar desse acesso.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Importar Lançamentos"
      description="Envie PDFs de fatura, planilha ou cole os lançamentos, revise linha a linha e confirme."
      actions={
        faturas.length > 0 ? (
          <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>
            {confirmar.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 size-4" />
            )}
            Confirmar importação
          </Button>
        ) : undefined
      }
    >
      <PrimeiraFaturaAviso onImportar={() => inputRef.current?.click()} />
      <PrimeiraCategoriaGuia tipo="despesa" className="mb-3" />
      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="pdf">
            <TabsList className="mb-3">
              <TabsTrigger value="pdf">
                <FileText className="mr-2 size-4" /> Fatura em PDF
              </TabsTrigger>
              <TabsTrigger value="texto">
                <ClipboardPaste className="mr-2 size-4" /> Colar lançamentos
              </TabsTrigger>
              <TabsTrigger value="prints">
                <ImageIcon className="mr-2 size-4" /> Prints
              </TabsTrigger>
              <TabsTrigger value="planilha">
                <FileSpreadsheet className="mr-2 size-4" /> Planilha
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                <span>
                  Seu banco não foi reconhecido? Envie uma cópia para modelagem. Os dados não serão
                  usados e o arquivo será descartado em até 30 dias.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enviandoLayout}
                    onClick={() => layoutRef.current?.click()}
                  >
                    {enviandoLayout ? "Enviando…" : "Enviar para análise"}
                  </Button>
                  {solicitacoesAnalise.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setModalAnaliseOpen(true)}
                    >
                      <FileText className="mr-1 size-3.5" /> Faturas enviadas (
                      {solicitacoesAnalise.length})
                    </Button>
                  )}
                </div>
                <input
                  ref={layoutRef}
                  className="hidden"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => void enviarParaModelagem(e.target.files)}
                />
              </div>
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/50"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void onFiles(e.dataTransfer.files);
                }}
              >
                {lendo ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="size-6 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">Arraste os PDFs ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground">
                  Itaú, Nubank, Pernambucanas e Santander · vários arquivos por vez
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => void onFiles(e.target.files)}
                />
              </div>

              {pdfsComSenha.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pdfsComSenha.map((p) => (
                    <div
                      key={p.file.name + p.file.size}
                      className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          PDF protegido por senha — informe a senha para ler.
                        </p>
                        {p.erro && <p className="text-xs text-destructive">{p.erro}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Senha do PDF"
                          value={p.senha}
                          className="h-9 w-40"
                          onChange={(e) =>
                            setPdfsComSenha((prev) =>
                              prev.map((x) =>
                                x.file === p.file ? { ...x, senha: e.target.value } : x,
                              ),
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void tentarComSenha(p.file);
                          }}
                        />
                        <Button
                          size="sm"
                          disabled={!p.senha || p.tentando}
                          onClick={() => void tentarComSenha(p.file)}
                        >
                          {p.tentando ? <Loader2 className="size-4 animate-spin" /> : "Desbloquear"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setPdfsComSenha((prev) => prev.filter((x) => x.file !== p.file))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="texto" className="space-y-3">
              <Textarea
                rows={8}
                placeholder={
                  "Cole aqui uma linha por lançamento, contendo data, descrição e valor.\n\n12/08 iFood 54,90\n15/08 Uber 23,40\nNetflix 55,90 dia 20"
                }
                value={colado}
                onChange={(e) => setColado(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  As categorias são sugeridas pelo de-para e pelas palavras-chave; tudo continua
                  editável na prévia.
                </p>
                <Button onClick={() => void importarColado()} disabled={!colado.trim()}>
                  <ClipboardPaste className="mr-2 size-4" /> Interpretar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="prints" className="space-y-3">
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/50"
                onClick={() => imgInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void onImages(e.dataTransfer.files);
                }}
              >
                {lendoImagens ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">Arraste prints ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG ou WEBP · até 10 por vez · OCR no navegador (sem custo de IA)
                </p>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => void onImages(e.target.files)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O texto é lido por OCR no próprio navegador e passa pelo mesmo parser das faturas em
                PDF. Linhas sem data/descrição/valor ficam em branco para preencher manualmente na
                prévia.
              </p>
            </TabsContent>

            <TabsContent value="planilha" className="space-y-3">
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/50"
                onClick={() => planilhaInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void importarPlanilha(e.dataTransfer.files);
                }}
              >
                {lendoPlanilha ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                ) : (
                  <FileSpreadsheet className="size-6 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">Arraste a planilha ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground">
                  .xlsx ou .csv de qualquer banco · até 5 MB · colunas detectadas automaticamente
                  (Data, Descrição, Valor e Parcela, quando existir)
                </p>
                <input
                  ref={planilhaInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  multiple
                  className="hidden"
                  onChange={(e) => void importarPlanilha(e.target.files)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Não precisa ser de um banco específico — funciona com qualquer planilha que tenha
                  colunas de data, descrição e valor.
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => {
                    const blob = new Blob([modeloCsvPlanilha()], {
                      type: "text/csv;charset=utf-8",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "modelo-importacao.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Baixar modelo .csv
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {faturas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{totais.arquivos} lote(s)</span>
              <span>{totais.linhas} lançamento(s) selecionado(s)</span>
              <span className="font-medium text-foreground">{formatBRL(totais.valor)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {faturas.map((f, idx) => (
        <Card key={f.arquivo_hash} className="mt-4">
          <CardHeader className="gap-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                <span className="truncate">{f.arquivo_nome}</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {f.duplicada && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" /> Arquivo já importado
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFaturas((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Cartão / conta de destino</Label>
                  {!f.destino && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400"
                    >
                      Não cadastrado
                    </Badge>
                  )}
                </div>
                <Select
                  value={f.destino || "nenhum"}
                  onValueChange={(v) => atualizarFatura(idx, { destino: v === "nenhum" ? "" : v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Não vincular</SelectItem>
                    {(cartoes as any[]).map((c) => (
                      <SelectItem key={c.id} value={`cartao:${c.id}`}>
                        {c.apelido ?? c.bandeira ?? "Cartão"} •{c.final} ·{" "}
                        {c.titular?.trim().split(/\s+/)[0] || "Titular não informado"} ·{" "}
                        {c.bancos?.nome ?? c.bandeira}
                      </SelectItem>
                    ))}
                    {(bancos as any[]).map((b) => (
                      <SelectItem key={b.id} value={`banco:${b.id}`}>
                        {b.nome} (conta)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1 text-xs"
                    onClick={() => {
                      setNomeBancoNovo(f.banco === "desconhecido" ? "" : BANCO_LABEL[f.banco]);
                      setCadastroDestino({ arquivoHash: f.arquivo_hash, tipo: "banco" });
                    }}
                  >
                    <Plus className="mr-1 size-3" /> Cadastrar banco
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1 text-xs"
                    onClick={() => {
                      setCartaoNovo({
                        apelido: "",
                        final: f.finais[0] ?? "",
                        titular: profiles[0]?.nome ?? "",
                        bancoId: "",
                      });
                      setCadastroDestino({ arquivoHash: f.arquivo_hash, tipo: "cartao" });
                    }}
                  >
                    <Plus className="mr-1 size-3" /> Cadastrar cartão
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Banco</Label>
                <Select
                  value={f.banco}
                  onValueChange={(v) =>
                    atualizarFatura(idx, {
                      banco: v as BancoFatura,
                      destino: destinoPadrao({ ...f, banco: v as BancoFatura }),
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {BANCO_LABEL[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento da fatura</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={f.vencimento ?? ""}
                  onChange={(e) =>
                    atualizarFatura(idx, {
                      vencimento: e.target.value || null,
                      competencia: e.target.value ? e.target.value.slice(0, 7) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total da fatura</Label>
                <Input
                  className="h-9"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={
                    f.total_declarado_edicao ??
                    (f.total_declarado == null ? "" : String(f.total_declarado).replace(".", ","))
                  }
                  onChange={(e) => {
                    const digitado = e.target.value;
                    if (!/^\d*(?:[.,]\d{0,2})?$/.test(digitado)) return;

                    const normalizado = digitado.replace(",", ".");
                    const valor =
                      normalizado && !/[.,]$/.test(digitado) ? Number(normalizado) : null;
                    atualizarFatura(idx, {
                      total_declarado_edicao: digitado,
                      ...(valor != null && Number.isFinite(valor)
                        ? { total_declarado: valor }
                        : digitado === ""
                          ? { total_declarado: null }
                          : {}),
                    });
                  }}
                  onBlur={() =>
                    atualizarFatura(idx, {
                      total_declarado_edicao:
                        f.total_declarado == null
                          ? ""
                          : f.total_declarado.toFixed(2).replace(".", ","),
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Pré-preenchido com a soma dos lançamentos (exceto pagamento de fatura). Troque
                  pelo valor real da sua fatura para conferir se falta algum lançamento.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Finais detectados</Label>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-9 text-sm"
                    placeholder="0000, 0000"
                    value={f.finais.join(", ")}
                    onChange={(e) =>
                      atualizarFatura(idx, {
                        finais: e.target.value
                          .split(/[,\s]+/)
                          .map((v) => v.replace(/\D/g, "").slice(0, 4))
                          .filter(Boolean),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 whitespace-nowrap px-2 text-xs"
                    disabled={!f.finais.length}
                    title="Usa o primeiro final da lista em todos os lançamentos abaixo"
                    onClick={() => {
                      const final = f.finais[0] ?? null;
                      setFaturas((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                lancamentos: x.lancamentos.map((l) => ({
                                  ...l,
                                  cartao_final: final,
                                })),
                              }
                            : x,
                        ),
                      );
                    }}
                  >
                    Aplicar a todos
                  </Button>
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Responsável de todas as linhas</Label>
                <Select
                  value="manter"
                  onValueChange={(v) =>
                    setFaturas((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              lancamentos: x.lancamentos.map((l) => ({
                                ...l,
                                responsavel: v === "nenhum" ? null : v,
                              })),
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Aplicar a todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manter">Aplicar a todos…</SelectItem>
                    <SelectItem value="nenhum">—</SelectItem>
                    {opcoesResponsavel.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(() => {
              const comDuplicata = f.lancamentos.filter((l) => candidatasDe(f, l).length);
              if (!comDuplicata.length) return null;
              const pendentes = comDuplicata.filter(
                (l) => acaoDuplicataDe(f, l) === "decidir",
              ).length;
              return (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <span className="mr-auto">
                    <b>{comDuplicata.length} lançamento(s)</b> desta fatura já têm algo parecido
                    cadastrado
                    {pendentes ? `, ${pendentes} sem decisão` : " e já estão resolvidos"}. Clique no
                    aviso de cada linha para ver a origem e escolher.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-[11px]"
                    onClick={() => substituirTodasDuplicatas(f)}
                  >
                    <ClipboardPaste className="mr-1 size-3.5" aria-hidden="true" /> Substituir todos
                    pela importação
                  </Button>
                </div>
              );
            })()}

            {(f.portadores?.length || f.futuros_ignorados || f.total_impresso != null) && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                {f.portadores?.map((p) => (
                  <Badge key={`${p.nome}-${p.final ?? ""}`} variant="outline" className="gap-1 font-normal">
                    {p.nome}
                    <span className="text-muted-foreground">
                      {p.final ? `· final ${p.final}` : "· final não impresso"}
                    </span>
                  </Badge>
                ))}
                {f.total_impresso != null && (
                  <span className="text-muted-foreground">
                    Total impresso na fatura: <b className="text-foreground">{formatBRL(f.total_impresso)}</b>
                  </span>
                )}
                {!!f.futuros_ignorados && (
                  <span className="text-muted-foreground">
                    · {f.futuros_ignorados} parcela(s) de próximas faturas deixada(s) de fora (não são
                    deste mês)
                  </span>
                )}
              </div>
            )}

            {(() => {
              // Recalculada a cada render (não é mais o snapshot da extração):
              // reflete lançamentos desmarcados/editados e qualquer valor que
              // o usuário tenha digitado em "Total da fatura" — é assim que o
              // usuário percebe, na hora, se ficou faltando algo.
              const incluidos = f.lancamentos.filter((l) => l.incluir);
              const conf = conferirTotal(incluidos, f.total_declarado);
              return (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    conf.ok
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-amber-500/40 bg-amber-500/10"
                  }`}
                >
                  {conf.ok ? (
                    <span>
                      Leitura conferida: {incluidos.length} lançamento(s), soma{" "}
                      {formatBRL(conf.soma)}
                      {f.leitura === "perfil" ? " (padrão deste banco já memorizado)" : ""}.
                    </span>
                  ) : (
                    <span>
                      A soma dos lançamentos ({formatBRL(conf.soma)}){" "}
                      {conf.diferenca != null
                        ? `está ${formatBRL(Math.abs(conf.diferenca))} ${
                            conf.diferenca > 0 ? "abaixo" : "acima"
                          } do total da fatura`
                        : "não pôde ser comparada com o total da fatura"}
                      . Confira as linhas abaixo antes de salvar.
                    </span>
                  )}
                </div>
              );
            })()}

            {!podeImportarLimite && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0" />
                Seu usuário não tem permissão para importar o limite do cartão — esses campos não
                serão salvos.
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Limite total</Label>
                <Input
                  className="h-8 text-xs font-medium tabular-nums"
                  type="text"
                  inputMode="decimal"
                  placeholder="Não identificado"
                  disabled={!podeImportarLimite}
                  value={
                    podeImportarLimite && f.limite_total != null
                      ? String(f.limite_total).replace(".", ",")
                      : ""
                  }
                  onChange={(e) => {
                    const digitado = e.target.value.replace(/\./g, "").replace(",", ".");
                    const num = parseFloat(digitado);
                    atualizarFatura(idx, { limite_total: isNaN(num) ? null : num });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Limite utilizado</Label>
                <Input
                  className="h-8 text-xs font-medium tabular-nums"
                  type="text"
                  inputMode="decimal"
                  placeholder="Não identificado"
                  disabled={!podeImportarLimite}
                  value={
                    podeImportarLimite && f.limite_utilizado != null
                      ? String(f.limite_utilizado).replace(".", ",")
                      : ""
                  }
                  onChange={(e) => {
                    const digitado = e.target.value.replace(/\./g, "").replace(",", ".");
                    const num = parseFloat(digitado);
                    atualizarFatura(idx, { limite_utilizado: isNaN(num) ? null : num });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Limite disponível</Label>
                <Input
                  className="h-8 text-xs font-medium tabular-nums"
                  type="text"
                  inputMode="decimal"
                  placeholder="Não identificado"
                  disabled={!podeImportarLimite}
                  value={
                    podeImportarLimite && f.limite_disponivel != null
                      ? String(f.limite_disponivel).replace(".", ",")
                      : ""
                  }
                  onChange={(e) => {
                    const digitado = e.target.value.replace(/\./g, "").replace(",", ".");
                    const num = parseFloat(digitado);
                    atualizarFatura(idx, { limite_disponivel: isNaN(num) ? null : num });
                  }}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {f.lancamentos.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Não consegui identificar lançamentos neste layout. O leitor específico deste banco
                será calibrado com o PDF de referência.
              </p>
            ) : (
              <div>
                <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">
                      {f.lancamentos.filter((l) => l.incluir).length}
                    </span>{" "}
                    de {f.lancamentos.length} lançamento(s) selecionado(s) nesta fatura
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] table-fixed text-xs">
                    <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="w-7 p-1"></th>
                        <th className="w-[108px] p-1 text-left">Data</th>
                        <th className="w-[22%] p-1 text-left">Descrição</th>
                        <th className="w-[112px] p-1 text-left">Parcela</th>
                        <th className="w-[9%] p-1 text-left">Tipo</th>
                        <th className="w-[7%] p-1 text-left">Final</th>
                        <th className="w-[12%] p-1 text-left">Responsável</th>
                        <th className="w-[13%] p-1 text-left">Categoria</th>
                        <th className="w-[11%] p-1 text-left">Subcategoria</th>
                        <th className="w-[12%] p-1 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.lancamentos.map((l) => {
                        // Etapa D: lançamento com parcela_total > 1 é um
                        // parcelamento; parcela_total === 1 é lançamento
                        // simples (ver gravação mais abaixo, mesmo critério).
                        const ehParcelamento = l.parcela_total > 1;
                        const permitidoPorTipo = ehParcelamento
                          ? podeImportarParcelamentos
                          : podeImportarLancamentos;
                        return (
                          <tr key={l.id} className="border-t align-top">
                            <td className="p-1">
                              <Checkbox
                                checked={l.incluir && permitidoPorTipo}
                                disabled={!permitidoPorTipo}
                                title={
                                  !permitidoPorTipo
                                    ? ehParcelamento
                                      ? "Seu usuário não tem permissão para importar parcelamentos"
                                      : "Seu usuário não tem permissão para importar lançamentos simples"
                                    : undefined
                                }
                                onCheckedChange={(v) =>
                                  atualizarLancamento(idx, l.id, {
                                    incluir: !!v && permitidoPorTipo,
                                  })
                                }
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="date"
                                className="h-7 w-full min-w-0 px-1 text-[11px]"
                                value={l.data_compra}
                                onChange={(e) =>
                                  atualizarLancamento(idx, l.id, { data_compra: e.target.value })
                                }
                              />
                            </td>
                            <td className="p-1">
                              <Textarea
                                className="min-h-7 w-full min-w-0 resize-none overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight"
                                rows={1}
                                value={l.descricao}
                                onChange={(e) => {
                                  atualizarLancamento(idx, l.id, { descricao: e.target.value });
                                  e.target.style.height = "auto";
                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                ref={(el) => {
                                  if (!el) return;
                                  el.style.height = "auto";
                                  el.style.height = `${el.scrollHeight}px`;
                                }}
                              />
                              {(() => {
                                const candidatas = candidatasDe(f, l);
                                if (!candidatas.length) return null;
                                const acao = acaoDuplicataDe(f, l);
                                const rotulos: Record<AcaoDuplicata, string> = {
                                  decidir: `${candidatas.length} parecido(s): resolver`,
                                  substituir: "Vai substituir o existente",
                                  manter_existente: "Mantém o que já existe",
                                  novo: "Vai criar um novo",
                                };
                                return (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDuplicataAberta({ faturaIdx: idx, lancamentoId: l.id })
                                    }
                                    className={cn(
                                      "mt-1 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-left text-[10px] font-semibold",
                                      acao === "decidir"
                                        ? "border-amber-500/50 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300"
                                        : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                                    )}
                                  >
                                    <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{rotulos[acao]}</span>
                                  </button>
                                );
                              })()}
                              {(() => {
                                // Etapa F: "Ensinar" só aparece quando esta fatura tem layout
                                // identificado (PDF reconhecido) e o usuário editou
                                // data/descrição/valor em relação ao que foi extraído.
                                if (!f.assinatura) return null;
                                const base = baseCorrecao.current.get(l.id);
                                if (!base) return null;
                                const divergente =
                                  base.data_compra !== l.data_compra ||
                                  base.descricao !== l.descricao ||
                                  base.valor !== l.valor;
                                if (!divergente) return null;
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-1 h-6 gap-1 px-1.5 text-[10px]"
                                    disabled={ensinarCorrecao.isPending}
                                    title="Lembrar esta correção para as próximas faturas deste mesmo layout"
                                    onClick={() =>
                                      ensinarCorrecao.mutate({ assinatura: f.assinatura!, l })
                                    }
                                  >
                                    <GraduationCap className="size-3 shrink-0" /> Ensinar correção
                                  </Button>
                                );
                              })()}
                            </td>
                            <td className="p-1">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-7 w-12 min-w-0 px-1 text-center text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  value={l.parcela_numero}
                                  onChange={(e) =>
                                    atualizarLancamento(idx, l.id, {
                                      parcela_numero: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                />
                                <span className="text-[10px] text-muted-foreground">/</span>
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-7 w-12 min-w-0 px-1 text-center text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  value={l.parcela_total}
                                  onChange={(e) =>
                                    atualizarLancamento(idx, l.id, {
                                      parcela_total: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                />
                              </div>
                            </td>
                            <td className="p-1">
                              <Select
                                value={l.tipo ?? "variavel"}
                                onValueChange={(v) =>
                                  atualizarLancamento(idx, l.id, { tipo: v as "fixa" | "variavel" })
                                }
                              >
                                <SelectTrigger className="h-7 w-full min-w-0 px-1 text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="variavel">Variável</SelectItem>
                                  <SelectItem value="fixa">Fixa</SelectItem>
                                </SelectContent>
                              </Select>
                              {(() => {
                                const cartaoLinha = acharCartao(f.banco, l.cartao_final);
                                const [tipoDestino, idDestino] = String(f.destino ?? "").split(":");
                                const correspondencia = encontrarCorrespondenciaFixa(
                                  despesasFixas,
                                  {
                                    descricao: l.descricao,
                                    valor: l.valor,
                                    direcao: l.direcao,
                                    data_compra: l.data_compra,
                                    parcela_total: l.parcela_total,
                                    cartao_final: l.cartao_final,
                                    cartao_id:
                                      cartaoLinha?.id ??
                                      (tipoDestino === "cartao" ? (idDestino ?? null) : null),
                                    banco_id: tipoDestino === "banco" ? (idDestino ?? null) : null,
                                    competencia: f.competencia,
                                  },
                                );
                                const chaveAcao = `${f.arquivo_hash}:${l.id}`;
                                return correspondencia ? (
                                  <AvisoCorrespondenciaFixa
                                    titulo={correspondencia.titulo}
                                    fixaDescricao={correspondencia.fixa.descricao}
                                    fixaValor={Number(correspondencia.fixa.valor_total)}
                                    motivos={correspondencia.motivos}
                                    valorImportado={l.valor}
                                    competenciaRotulo={monthLabelLong(
                                      (f.competencia ?? l.data_compra).slice(0, 7),
                                    )}
                                    acao={acoesFixas[chaveAcao]?.acao ?? "manter"}
                                    onAcao={(acao) => {
                                      setAcoesFixas((atual) => ({
                                        ...atual,
                                        [chaveAcao]: { acao, fixaId: correspondencia.fixa.id },
                                      }));
                                      atualizarLancamento(idx, l.id, {
                                        incluir: acao !== "ignorar",
                                      });
                                      // Guarda a escolha para repetir na próxima fatura.
                                      salvarPreferenciaImportacao.mutate({
                                        descricao: l.descricao,
                                        escopo: "fixa",
                                        acao,
                                        despesaId: correspondencia.fixa.id,
                                      });
                                    }}
                                  />
                                ) : null;
                              })()}
                            </td>
                            <td className="p-1">
                              <Input
                                className="h-7 w-full min-w-0 px-1 text-[11px]"
                                placeholder="0000"
                                maxLength={4}
                                value={l.cartao_final ?? ""}
                                onChange={(e) =>
                                  atualizarLancamento(idx, l.id, {
                                    cartao_final:
                                      e.target.value.replace(/\D/g, "").slice(0, 4) || null,
                                  })
                                }
                              />
                            </td>
                            <td className="p-1">
                              <Select
                                value={l.responsavel ?? "none"}
                                onValueChange={(v) =>
                                  atualizarLancamento(idx, l.id, {
                                    responsavel: v === "none" ? null : v,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 w-full min-w-0 px-1 text-[11px]">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">—</SelectItem>
                                  {opcoesResponsavel.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {r}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1">
                              <div className="flex items-center gap-1">
                                <Select
                                  value={l.categoria}
                                  onValueChange={(v) =>
                                    atualizarLancamento(idx, l.id, {
                                      categoria: v,
                                      subcategoria: null,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-7 w-full min-w-0 px-1 text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {listaCategorias.map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {c}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {(() => {
                                  const adicionada = regras.some(
                                    (r) =>
                                      r.tipo_regra === "de_para" &&
                                      r.estabelecimento_normalizado ===
                                        chaveEstabelecimento(l.descricao) &&
                                      r.categoria === l.categoria &&
                                      (r.subcategoria ?? null) === (l.subcategoria ?? null),
                                  );
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0"
                                      title={
                                        adicionada
                                          ? "Remover regra de de-para"
                                          : "Salvar como regra de de-para"
                                      }
                                      disabled={
                                        salvarRegra.isPending || (adicionada && exclusaoBloqueada)
                                      }
                                      onClick={() => salvarRegra.mutate(l)}
                                    >
                                      {adicionada ? (
                                        <BookmarkMinus className="size-4 text-emerald-600" />
                                      ) : (
                                        <BookmarkPlus className="size-4 text-muted-foreground hover:text-primary" />
                                      )}
                                    </Button>
                                  );
                                })()}
                              </div>
                              {l.confianca_categoria && (
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  Confiança: {CONFIANCA_LABEL[l.confianca_categoria]}
                                </p>
                              )}
                            </td>
                            <td className="p-1">
                              <Select
                                value={l.subcategoria ?? "none"}
                                onValueChange={(v) =>
                                  atualizarLancamento(idx, l.id, {
                                    subcategoria: v === "none" ? null : v,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 w-full min-w-0 px-1 text-[11px]">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">—</SelectItem>
                                  {subDaCategoria(l.categoria).map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                className={`h-7 w-full min-w-0 px-1 text-right text-[11px] font-medium ${
                                  l.direcao === "credito" ? "text-success" : "text-destructive"
                                }`}
                                value={l.valor}
                                onChange={(e) =>
                                  atualizarLancamento(idx, l.id, {
                                    valor: Number(e.target.value) || 0,
                                  })
                                }
                              />
                              <p
                                className={`mt-1 text-[10px] font-medium ${
                                  l.direcao === "credito" ? "text-success" : "text-destructive"
                                }`}
                              >
                                {l.direcao === "credito" ? "crédito" : "débito"} ·{" "}
                                {formatBRL(l.valor * l.parcela_total)}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <Dialog
        open={!!cadastroDestino}
        onOpenChange={(aberto) => !aberto && setCadastroDestino(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cadastroDestino?.tipo === "banco" ? "Cadastrar banco ou conta" : "Cadastrar cartão"}
            </DialogTitle>
          </DialogHeader>
          {cadastroDestino?.tipo === "banco" ? (
            <div className="space-y-2">
              <Label htmlFor="novo-banco-importacao">Nome do banco ou conta</Label>
              <Input
                id="novo-banco-importacao"
                value={nomeBancoNovo}
                onChange={(evento) => setNomeBancoNovo(evento.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="novo-cartao-apelido">Apelido do cartão (opcional)</Label>
                <Input
                  id="novo-cartao-apelido"
                  value={cartaoNovo.apelido}
                  onChange={(evento) =>
                    setCartaoNovo({ ...cartaoNovo, apelido: evento.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="novo-cartao-final">Quatro últimos dígitos</Label>
                <Input
                  id="novo-cartao-final"
                  inputMode="numeric"
                  maxLength={4}
                  value={cartaoNovo.final}
                  onChange={(evento) =>
                    setCartaoNovo({ ...cartaoNovo, final: evento.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="novo-cartao-titular">Titular</Label>
                <Input
                  id="novo-cartao-titular"
                  value={cartaoNovo.titular}
                  onChange={(evento) =>
                    setCartaoNovo({ ...cartaoNovo, titular: evento.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Banco cadastrado (opcional)</Label>
                <Select
                  value={cartaoNovo.bancoId || "nenhum"}
                  onValueChange={(valor) =>
                    setCartaoNovo({ ...cartaoNovo, bancoId: valor === "nenhum" ? "" : valor })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem banco vinculado</SelectItem>
                    {bancos.map((banco) => (
                      <SelectItem key={banco.id} value={banco.id}>
                        {banco.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCadastroDestino(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={cadastrarDestino.isPending}
              onClick={() => cadastrarDestino.mutate()}
            >
              {cadastrarDestino.isPending ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalAnaliseOpen} onOpenChange={setModalAnaliseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Faturas Enviadas para Análise</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Abaixo estão os arquivos de fatura que você enviou para a nossa equipe calibrar o
              leitor de PDF.
            </p>
            {solicitacoesAnalise.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma fatura enviada para análise.
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {solicitacoesAnalise.map((item: any) => (
                  <div key={item.id} className="rounded-lg border p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-sm">{item.arquivo_nome}</b>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {item.status === "corrigida"
                          ? "✓ Concluída / Tratada"
                          : item.status === "descartada"
                            ? "Descartada"
                            : item.status === "em_modelagem"
                              ? "Em análise"
                              : "Recebida"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Enviado em {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                      {item.banco_informado ? ` · Banco: ${item.banco_informado}` : ""}
                      {item.cartao_final ? ` · Final: ${item.cartao_final}` : ""}
                    </p>
                    {item.protocolo && (
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                        Protocolo: {item.protocolo.substring(0, 8)}…
                      </p>
                    )}
                    {item.resposta_admin && (
                      <p className="mt-1 font-medium text-emerald-600">
                        Resposta: {item.resposta_admin}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setModalAnaliseOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(() => {
        const f = duplicataAberta ? faturas[duplicataAberta.faturaIdx] : null;
        const l = f?.lancamentos.find((x) => x.id === duplicataAberta?.lancamentoId) ?? null;
        const chave = f && l ? chaveDup(f.arquivo_hash, l.id) : "";
        return (
          <DuplicidadeDialog
            aberto={!!f && !!l}
            onAberto={(v) => !v && setDuplicataAberta(null)}
            lancamento={l}
            candidatas={f && l ? candidatasDe(f, l) : []}
            acao={acoesDuplicata[chave]?.acao ?? "decidir"}
            alvoId={acoesDuplicata[chave]?.alvoId ?? null}
            onEscolher={(acao, alvoId) => f && l && definirAcaoDuplicata(f, l, acao, alvoId)}
          />
        );
      })()}
    </AppLayout>
  );
}
