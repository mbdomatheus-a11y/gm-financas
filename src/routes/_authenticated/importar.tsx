import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import {
  RESPONSAVEIS_EXTRA,
  useBancos,
  useCartoes,
  useCategorias,
  useDespesas,
  useProfilesList,
} from "@/hooks/useFinance";
import { formatBRL } from "@/lib/format";
import {
  CONFIANCA_LABEL,
  chaveEstabelecimento,
  classificar,
  subcategoriasDe,
  type RegraUsuario,
} from "@/lib/categorizacao";
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

const BANCOS: BancoFatura[] = ["itau", "nubank", "pernambucanas", "santander", "desconhecido"];

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

/**
 * Encontra uma despesa fixa já cadastrada que provavelmente é o mesmo
 * lançamento recorrente (mesma descrição normalizada, ou valor a até 2% de
 * diferença). Sem janela de data — fixa recorrente aparece ~30 dias depois,
 * não em poucos dias como duplicata de digitação — critério usado em
 * `/despesas`, adaptado aqui pra recorrência mensal.
 */
function encontrarFixaDuplicada(
  despesasFixas: any[],
  l: Pick<LancamentoExtraido, "descricao_normalizada" | "valor">,
): any | null {
  if (!l.descricao_normalizada && !l.valor) return null;
  return (
    despesasFixas.find((d) => {
      const mesmaDescricao = d.descricao_normalizada === l.descricao_normalizada;
      const valorProximo = Math.abs(Number(d.valor_total) - l.valor) <= l.valor * 0.02;
      return mesmaDescricao || valorProximo;
    }) ?? null
  );
}

async function hashTexto(texto: string) {
  const buf = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ImportarPage() {
  const qc = useQueryClient();
  const { user } = useSession();
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
    () => (despesasTodas as any[]).filter((d) => d.tipo === "fixa"),
    [despesasTodas],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const classificacoesEditadas = useRef(new Set<string>());

  const [lendo, setLendo] = useState(false);
  const [lendoImagens, setLendoImagens] = useState(false);
  const [faturas, setFaturas] = useState<FaturaItem[]>([]);
  const [colado, setColado] = useState("");
  const [cadastroDestino, setCadastroDestino] = useState<{
    arquivoHash: string;
    tipo: "banco" | "cartao";
  } | null>(null);
  const [nomeBancoNovo, setNomeBancoNovo] = useState("");
  const [cartaoNovo, setCartaoNovo] = useState({ apelido: "", final: "", titular: "", bancoId: "" });
  const [pdfsComSenha, setPdfsComSenha] = useState<
    { file: File; senha: string; erro: string | null; tentando: boolean }[]
  >([]);

  const { data: regras = [] } = useQuery({
    queryKey: ["categoria-regras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categoria_regras").select("*");
      if (error) throw error;
      return (data ?? []) as RegraUsuario[];
    },
  });

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
      return {
        ...l,
        categoria: c.categoria,
        subcategoria: c.subcategoria,
        categoria_sugerida: c.categoria,
        confianca_categoria: c.confianca,
        tipo: l.tipo ?? "variavel",
      };
    });
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
    if (extraida.assinatura && (!extraida.conferencia?.ok || !extraida.lancamentos.length)) {
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
    const { data: jaExiste } = await supabase
      .from("import_faturas")
      .select("id")
      .eq("arquivo_hash", extraida.arquivo_hash)
      .maybeSingle();
    return {
      ...extraida,
      lancamentos: categorizar(extraida.lancamentos),
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
      if (novos.length) setFaturas((prev) => [...prev, ...novos]);
    } finally {
      setLendoImagens(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
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
        const { data, error } = await supabase.from("bancos")
          .insert({ nome, tipo_conta: "outros", titular: profiles[0]?.nome ?? null })
          .select("*").single();
        if (error) throw error;
        qc.setQueryData(["bancos"], (anterior: typeof bancos | undefined) => [...(anterior ?? []), data]);
        return `banco:${data.id}`;
      }
      const final = cartaoNovo.final.trim();
      if (!/^\d{4}$/.test(final)) throw new Error("Informe os quatro últimos dígitos do cartão.");
      if (!cartaoNovo.titular.trim()) throw new Error("Informe o titular do cartão.");
      const { data, error } = await supabase.from("cartoes")
        .insert({
          apelido: cartaoNovo.apelido.trim() || `Cartão •${final}`,
          final,
          titular: cartaoNovo.titular.trim(),
          banco_id: cartaoNovo.bancoId || null,
          bandeira: "Não informada",
          tipo: "credito",
        })
        .select("*, bancos(nome)").single();
      if (error) throw error;
      qc.setQueryData(["cartoes"], (anterior: typeof cartoes | undefined) => [...(anterior ?? []), data]);
      return `cartao:${data.id}`;
    },
    onSuccess: (destino) => {
      setFaturas((atuais) => atuais.map((f) =>
        f.arquivo_hash === cadastroDestino?.arquivoHash ? { ...f, destino } : f,
      ));
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
        .maybeSingle();
      if (existente) {
        const { error } = await supabase
          .from("categoria_regras")
          .update(item)
          .eq("id", existente.id);
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
        const { error } = await supabase.from("categorias")
          .insert({ nome: l.categoria, tipo: "despesa" });
        if (error) throw error;
      }
  }

  const salvarRegra = useMutation({
    mutationFn: gravarRegra,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categoria-regras"] });
      qc.invalidateQueries({ queryKey: ["categorias", "despesa"] });
      toast.success("Regra de de-para salva.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar a regra."),
  });

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
      const regrasAprendidas = new Map<string, LancamentoExtraido>();
      faturas.forEach((f) => f.lancamentos.forEach((l) => {
        if (l.incluir && classificacoesEditadas.current.has(`${f.arquivo_hash}:${l.id}`)) {
          regrasAprendidas.set(chaveEstabelecimento(l.descricao), l);
        }
      }));

      const { data: lote, error: loteErr } = await supabase
        .from("import_lotes")
        .insert({ created_by: user?.id ?? null, status: "confirmado" })
        .select("id")
        .single();
      if (loteErr) throw loteErr;

      let inseridos = 0;
      let ignorados = 0;
      let fechadas = 0;

      for (const f of faturas) {
        const cartoesTocados = new Set<string>();
        let path: string | null = null;
        if (f.arquivo) {
          path = `${lote.id}/${f.arquivo_hash}.pdf`;
          const up = await supabase.storage.from("faturas").upload(path, f.arquivo, {
            contentType: "application/pdf",
            upsert: true,
          });
          if (up.error) throw up.error;
        }

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
              limite_total: f.limite_total,
              limite_utilizado: f.limite_utilizado,
              limite_disponivel: f.limite_disponivel,
              total_extraido: f.lancamentos
                .filter((l) => l.incluir)
                .reduce((s, l) => s + (l.direcao === "credito" ? -l.valor : l.valor), 0),
              paginas: f.paginas,
              status: "importada",
            },
            { onConflict: "grupo_id,arquivo_hash" },
          )
          .select("id")
          .single();
        if (fatErr) throw fatErr;

        for (const l of f.lancamentos.filter((x) => x.incluir)) {
          const chave = dedupKey(l);
          const { data: existente } = await supabase
            .from("despesas")
            .select("id")
            .eq("grupo_id", grupoId)
            .eq("dedup_key", chave)
            .maybeSingle();
          if (existente) {
            ignorados++;
            continue;
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
              paga: numero < l.parcela_numero,
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
              .select("id, despesa_avulsa_id")
              .eq("cartao_id", cartaoId)
              .eq("competencia", comp)
              .maybeSingle();
            if (!rapida) continue;
            if (rapida.despesa_avulsa_id) {
              await supabase.from("parcelas").delete().eq("despesa_id", rapida.despesa_avulsa_id);
              await supabase.from("despesas").delete().eq("id", rapida.despesa_avulsa_id);
            }
            await supabase
              .from("fatura_mes")
              .update({
                status: "fechada",
                fechada_em: new Date().toISOString(),
                despesa_avulsa_id: null,
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
      return { inseridos, ignorados, fechadas, falhasDePara, regrasSalvas: regrasAprendidas.size - falhasDePara };
    },
    onSuccess: ({ inseridos, ignorados, fechadas, falhasDePara, regrasSalvas }) => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["fatura-mes"] });
      qc.invalidateQueries({ queryKey: ["import-faturas"] });
      qc.invalidateQueries({ queryKey: ["categoria-regras"] });
      setFaturas([]);
      classificacoesEditadas.current.clear();
      toast.success(
        `${inseridos} lançamento(s) importado(s). ${ignorados} duplicado(s) ignorado(s).` +
          (fechadas ? ` ${fechadas} competência(s) fechada(s).` : ""),
      );
      if (regrasSalvas) toast.info(`${regrasSalvas} classificação(ões) aprendida(s) para próximas importações.`);
      if (falhasDePara) toast.warning(`${falhasDePara} regra(s) de de-para não puderam ser salvas.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao importar."),
  });

  return (
    <AppLayout
      title="Importar Lançamentos"
      description="Envie PDFs de fatura ou cole os lançamentos, revise linha a linha e confirme."
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
            </TabsList>

            <TabsContent value="pdf">
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
                <Label className="text-xs">Cartão / conta de destino</Label>
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
                        {c.apelido ?? c.titular} · {c.bancos?.nome ?? c.bandeira} •{c.final}
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
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => {
                    setNomeBancoNovo(f.banco === "desconhecido" ? "" : BANCO_LABEL[f.banco]);
                    setCadastroDestino({ arquivoHash: f.arquivo_hash, tipo: "banco" });
                  }}>
                    <Plus className="mr-1 size-3" /> Cadastrar banco
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => {
                    setCartaoNovo({
                      apelido: "",
                      final: f.finais[0] ?? "",
                      titular: profiles[0]?.nome ?? "",
                      bancoId: "",
                    });
                    setCadastroDestino({ arquivoHash: f.arquivo_hash, tipo: "cartao" });
                  }}>
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
                    {responsaveis.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Limite total", valor: f.limite_total },
                { label: "Limite utilizado", valor: f.limite_utilizado },
                { label: "Limite disponível", valor: f.limite_disponivel },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {k.valor != null ? formatBRL(k.valor) : "não identificado"}
                  </p>
                </div>
              ))}
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
                      {f.lancamentos.map((l) => (
                        <tr key={l.id} className="border-t align-top">
                          <td className="p-1">
                            <Checkbox
                              checked={l.incluir}
                              onCheckedChange={(v) =>
                                atualizarLancamento(idx, l.id, { incluir: !!v })
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
                              const fixaExistente = encontrarFixaDuplicada(despesasFixas, l);
                              return fixaExistente ? (
                                <p className="mt-1 text-[10px] font-medium text-amber-600">
                                  Já existe como fixa: "{fixaExistente.descricao}" (
                                  {formatBRL(Number(fixaExistente.valor_total))}). Deve aparecer
                                  sozinha nos lançamentos deste mês — considere desmarcar esta linha
                                  pra não contar em dobro.
                                </p>
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
                                {responsaveis.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1">
                            <div className="flex items-center gap-0.5">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0"
                                title="Salvar como regra de de-para"
                                onClick={() => salvarRegra.mutate(l)}
                              >
                                <BookmarkPlus className="size-3.5" />
                              </Button>
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
                                {subcategoriasDe(l.categoria).map((s) => (
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <Dialog open={!!cadastroDestino} onOpenChange={(aberto) => !aberto && setCadastroDestino(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cadastroDestino?.tipo === "banco" ? "Cadastrar banco ou conta" : "Cadastrar cartão"}
            </DialogTitle>
          </DialogHeader>
          {cadastroDestino?.tipo === "banco" ? (
            <div className="space-y-2">
              <Label htmlFor="novo-banco-importacao">Nome do banco ou conta</Label>
              <Input id="novo-banco-importacao" value={nomeBancoNovo}
                onChange={(evento) => setNomeBancoNovo(evento.target.value)} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="novo-cartao-apelido">Apelido do cartão (opcional)</Label>
                <Input id="novo-cartao-apelido" value={cartaoNovo.apelido}
                  onChange={(evento) => setCartaoNovo({ ...cartaoNovo, apelido: evento.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="novo-cartao-final">Quatro últimos dígitos</Label>
                <Input id="novo-cartao-final" inputMode="numeric" maxLength={4} value={cartaoNovo.final}
                  onChange={(evento) => setCartaoNovo({ ...cartaoNovo, final: evento.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="novo-cartao-titular">Titular</Label>
                <Input id="novo-cartao-titular" value={cartaoNovo.titular}
                  onChange={(evento) => setCartaoNovo({ ...cartaoNovo, titular: evento.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Banco cadastrado (opcional)</Label>
                <Select value={cartaoNovo.bancoId || "nenhum"}
                  onValueChange={(valor) => setCartaoNovo({ ...cartaoNovo, bancoId: valor === "nenhum" ? "" : valor })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem banco vinculado</SelectItem>
                    {bancos.map((banco) => <SelectItem key={banco.id} value={banco.id}>{banco.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCadastroDestino(null)}>Cancelar</Button>
            <Button type="button" disabled={cadastrarDestino.isPending}
              onClick={() => cadastrarDestino.mutate()}>
              {cadastrarDestino.isPending ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
