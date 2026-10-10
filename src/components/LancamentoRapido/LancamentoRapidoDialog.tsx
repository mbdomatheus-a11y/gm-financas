import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, History, Loader2, Mic, Sparkles, Square, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/routes/_authenticated/receitas";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuthData";
import {
  RESPONSAVEIS_EXTRA,
  useBancos,
  useCartoes,
  useCategorias,
  useDespesas,
  useProfilesList,
  useReceitas,
} from "@/hooks/useFinance";
import { PrimeiraCategoriaGuia } from "@/components/PrimeiraCategoriaGuia";
import { useResumoFinanceiroMes } from "@/hooks/useResumoFinanceiroMes";
import { classificar } from "@/lib/categorizacao";
import { addMonths, dividirParcelas, toISODate } from "@/lib/format";
import {
  interpretarLancamentoIA,
  transcreverAudioIA,
  resumoFinanceiroIA,
} from "@/lib/lancamento-ia.functions";
import {
  RASCUNHO_VAZIO,
  LIMITE_CARACTERES_TEXTO_IA,
  type ContextoLancamentoIA,
  type RascunhoIA,
} from "@/lib/lancamento-ia";
import { obterModoIaLancamento } from "@/lib/ia-lancamento-modo.functions";

/** Grava no máximo 60s de áudio — mantém "1 áudio" como unidade de custo
 * previsível pra IA, em vez de deixar a pessoa gravar minutos à toa. Ver
 * `claude/plano-fase2-lancamento-2026-10-02.md` (Frente 1). */
const LIMITE_GRAVACAO_MS = 60_000;

type FormaPagamento = "nenhum" | `cartao:${string}` | `banco:${string}`;

type FormConfirma = {
  tipo: "despesa" | "receita";
  descricao: string;
  /** Detalhe extra que não cabe numa descrição curta (Item 3, Frente 3) —
   * salvo no campo `observacoes` de despesas/receitas. */
  observacao: string;
  valor: string;
  data: string;
  categoria: string;
  responsavel: string;
  pagamento: FormaPagamento;
  parcelas: string;
};

function formVazio(hoje: string, responsavelPadrao: string): FormConfirma {
  return {
    tipo: "despesa",
    descricao: "",
    observacao: "",
    valor: "",
    data: hoje,
    categoria: "",
    responsavel: responsavelPadrao,
    pagamento: "nenhum",
    parcelas: "1",
  };
}

/** Acha, por nome aproximado (case-insensitive, sem acento), o item de uma
 * lista — usado pra casar o texto livre da IA com cadastros reais (cartão,
 * banco, categoria, pessoa). Nunca inventa: sem correspondência, null. */
function acharPorNome<T>(lista: T[], nome: string | null, nomeDe: (item: T) => string): T | null {
  if (!nome) return null;
  const chave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const alvo = chave(nome);
  return lista.find((item) => chave(nomeDe(item)) === alvo) ?? null;
}

export type ItemHistoricoIA = {
  id: string;
  dataHora: string;
  tipo: "lancamento" | "resumo";
  perguntaOuEntrada: string;
  respostaOuDetalhes: string;
};

const CHAVE_HISTORICO_IA = "controlall_ia_historico";

function carregarHistoricoIA(): ItemHistoricoIA[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAVE_HISTORICO_IA);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function salvarHistoricoIA(itens: ItemHistoricoIA[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAVE_HISTORICO_IA, JSON.stringify(itens.slice(0, 50)));
  } catch {
    // ignora falhas de localStorage
  }
}

export function LancamentoRapidoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: perfis = [] } = useProfilesList();
  const { data: categoriasDespesa = [] } = useCategorias("despesa");
  const { data: categoriasReceita = [] } = useCategorias("receita");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const { data: despesasExistentes = [] } = useDespesas();
  const { data: receitasExistentes = [] } = useReceitas();

  const interpretarFn = useServerFn(interpretarLancamentoIA);
  const transcreverFn = useServerFn(transcreverAudioIA);
  const resumirFn = useServerFn(resumoFinanceiroIA);
  const obterModoFn = useServerFn(obterModoIaLancamento);
  const { resumo } = useResumoFinanceiroMes();

  const { data: modoIaConfig } = useQuery({
    queryKey: ["ia-lancamento-modo"],
    queryFn: () => obterModoFn(),
    enabled: open,
    staleTime: 60_000,
  });
  const modoIa = modoIaConfig?.modo ?? "ambos";
  const iaDesabilitada = modoIa === "desabilitado";
  const textoPermitido = !iaDesabilitada && modoIa !== "somente_audio";
  const audioPermitido = !iaDesabilitada && modoIa !== "somente_texto";

  const hoje = toISODate(new Date());
  const nomeUsuarioAtual = profile?.nome ?? null;

  const [modo, setModo] = useState<"lancar" | "resumo" | "historico">("lancar");
  const [historico, setHistorico] = useState<ItemHistoricoIA[]>(() => carregarHistoricoIA());

  function registrarNoHistorico(tipo: "lancamento" | "resumo", entrada: string, saida: string) {
    const novoItem: ItemHistoricoIA = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dataHora: new Date().toISOString(),
      tipo,
      perguntaOuEntrada: entrada,
      respostaOuDetalhes: saida,
    };
    setHistorico((prev) => {
      const atualizado = [novoItem, ...prev].slice(0, 50);
      salvarHistoricoIA(atualizado);
      return atualizado;
    });
  }

  function limparHistorico() {
    setHistorico([]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(CHAVE_HISTORICO_IA);
      } catch {}
    }
    toast.success("Histórico de IA limpo.");
  }

  function removerItemHistorico(id: string) {
    setHistorico((prev) => {
      const atualizado = prev.filter((i) => i.id !== id);
      salvarHistoricoIA(atualizado);
      return atualizado;
    });
    toast.success("Item removido.");
  }

  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  // Item 8 (2026-10-05): o mesmo gravador serve a aba "Lançar" e a aba
  // "Perguntar/Resumir" (resumo mensal e cálculos por voz).
  const destinoAudioRef = useRef<"lancar" | "resumo">("lancar");
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [interpretando, setInterpretando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoIA | null>(null);
  const [form, setForm] = useState<FormConfirma>(
    formVazio(hoje, nomeUsuarioAtual ?? RESPONSAVEIS_EXTRA),
  );
  const [duplicata, setDuplicata] = useState<any | null>(null);

  const [perguntaResumo, setPerguntaResumo] = useState("");
  const [respostaResumo, setRespostaResumo] = useState<string | null>(null);
  const [resumindo, setResumindo] = useState(false);

  const [textoLiberadoPorAudio, setTextoLiberadoPorAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const limiteGravacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetarTudo() {
    setModo("lancar");
    setTexto("");
    setRascunho(null);
    setForm(formVazio(hoje, nomeUsuarioAtual ?? RESPONSAVEIS_EXTRA));
    setPerguntaResumo("");
    setRespostaResumo(null);
    setTextoLiberadoPorAudio(false);
    setDuplicata(null);
  }

  function fechar() {
    if (gravando) pararGravacao();
    resetarTudo();
    onOpenChange(false);
  }

  async function iniciarGravacao(destino: "lancar" | "resumo" = "lancar") {
    destinoAudioRef.current = destino;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported(t) : false,
      );
      const recorder = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void processarAudioGravado(recorder.mimeType || "audio/webm");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      limiteGravacaoRef.current = setTimeout(() => {
        toast.info("Gravação limitada a 60 segundos — parando automaticamente.");
        pararGravacao();
      }, LIMITE_GRAVACAO_MS);
    } catch {
      toast.error("Não consegui acessar o microfone — verifique a permissão do navegador.");
    }
  }

  function pararGravacao() {
    if (limiteGravacaoRef.current) {
      clearTimeout(limiteGravacaoRef.current);
      limiteGravacaoRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setGravando(false);
  }

  async function processarAudioGravado(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size === 0) return;
    setTranscrevendo(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultado = String(reader.result ?? "");
          resolve(resultado.slice(resultado.indexOf(",") + 1));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const resultado = await transcreverFn({ data: { audioBase64: base64, mimeType } });
      if (resultado.erro && !resultado.texto) {
        toast.error(resultado.erro);
        return;
      }
      if (destinoAudioRef.current === "resumo") {
        setPerguntaResumo((atual) =>
          (atual ? `${atual} ${resultado.texto}` : resultado.texto).slice(
            0,
            LIMITE_CARACTERES_TEXTO_IA,
          ),
        );
      } else {
        setTexto((atual) => (atual ? `${atual} ${resultado.texto}` : resultado.texto));
        setTextoLiberadoPorAudio(true);
      }
    } catch {
      toast.error("Falha ao transcrever o áudio. Você pode digitar em vez disso.");
    } finally {
      setTranscrevendo(false);
    }
  }

  async function interpretar() {
    if (!texto.trim()) {
      toast.error("Digite ou grave algo primeiro.");
      return;
    }
    setInterpretando(true);
    try {
      const contexto: ContextoLancamentoIA = {
        hoje,
        perfis: [...perfis.map((p: any) => p.nome as string), RESPONSAVEIS_EXTRA],
        categoriasDespesa: categoriasDespesa.map((c: any) => c.nome as string),
        categoriasReceita: categoriasReceita.map((c: any) => c.nome as string),
        formasPagamento: [
          ...cartoes.map((c: any) => c.apelido || `Cartão${c.final ? ` •${c.final}` : ""}`),
          ...bancos.map((b: any) => b.nome as string),
        ],
        usuarioAtual: nomeUsuarioAtual,
      };
      const draft = await interpretarFn({
        data: { texto, contexto, origem: textoLiberadoPorAudio ? "audio" : "manual" },
      });
      setRascunho(draft);
      aplicarRascunhoNoForm(draft);
      if (draft.observacao_ia) toast.info(draft.observacao_ia);
    } catch {
      toast.error("IA indisponível agora — preencha manualmente abaixo.");
      setRascunho(RASCUNHO_VAZIO);
    } finally {
      setInterpretando(false);
    }
  }

  async function resumir() {
    setResumindo(true);
    setRespostaResumo(null);
    try {
      const r = await resumirFn({ data: { pergunta: perguntaResumo.trim(), resumo } });
      if (r.erro && !r.texto) {
        toast.error(r.erro);
        return;
      }
      setRespostaResumo(r.texto);
      registrarNoHistorico(
        "resumo",
        perguntaResumo.trim() || "Resumo financeiro do mês",
        r.texto,
      );
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
      qc.invalidateQueries({ queryKey: ["resumo-ia-lista-compras"] });
    } catch {
      toast.error("IA indisponível agora — tente de novo em instantes.");
    } finally {
      setResumindo(false);
    }
  }

  function aplicarRascunhoNoForm(draft: RascunhoIA) {
    const tipo = draft.tipo ?? "despesa";
    const categoriasDoTipo = tipo === "despesa" ? categoriasDespesa : categoriasReceita;
    const categoriaAchada = acharPorNome(categoriasDoTipo, draft.categoria, (c: any) => c.nome);
    const categoriaFallback =
      !draft.categoria && draft.descricao && tipo === "despesa"
        ? classificar(draft.descricao, { valor: draft.valor ?? 0 }).categoria
        : null;

    const cartaoAchado = acharPorNome(
      cartoes,
      draft.forma_pagamento,
      (c: any) => c.apelido || `Cartão${c.final ? ` •${c.final}` : ""}`,
    );
    const bancoAchado = cartaoAchado
      ? null
      : acharPorNome(bancos, draft.forma_pagamento, (b: any) => b.nome);

    const perfilAchado = acharPorNome(perfis, draft.responsavel, (p: any) => p.nome);
    const responsavel =
      perfilAchado?.nome ??
      (draft.responsavel === RESPONSAVEIS_EXTRA ? RESPONSAVEIS_EXTRA : null) ??
      nomeUsuarioAtual ??
      RESPONSAVEIS_EXTRA;

    setForm({
      tipo,
      descricao: draft.descricao ?? "",
      observacao: draft.observacao ?? "",
      valor: draft.valor != null ? String(draft.valor) : "",
      data: draft.data ?? hoje,
      categoria: (categoriaAchada as any)?.nome ?? categoriaFallback ?? "",
      responsavel,
      pagamento: cartaoAchado
        ? (`cartao:${(cartaoAchado as any).id}` as FormaPagamento)
        : bancoAchado
          ? (`banco:${(bancoAchado as any).id}` as FormaPagamento)
          : "nenhum",
      parcelas: draft.parcelas ? String(draft.parcelas) : "1",
    });
  }

  /** Item 3 (plano de 2026-10-02, Frente 3): mesma trava já existente em
   * `/despesas` e `/receitas` — mesmo valor + mesma data exige confirmação
   * explícita antes de salvar um segundo lançamento igual. */
  const possivelDuplicata = useMemo(() => {
    const valorNum = Number(form.valor.replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0 || !form.data) return null;
    const lista = form.tipo === "despesa" ? despesasExistentes : receitasExistentes;
    return (
      (lista as any[]).find((item) => {
        const valorItem = Number(form.tipo === "despesa" ? item.valor_total : item.valor);
        const dataItem = form.tipo === "despesa" ? item.data_compra : item.data_recebimento;
        return Math.abs(valorItem - valorNum) < 0.01 && dataItem === form.data;
      }) ?? null
    );
  }, [despesasExistentes, receitasExistentes, form.tipo, form.valor, form.data]);

  function tentarSalvar() {
    if (possivelDuplicata && !duplicata) {
      setDuplicata(possivelDuplicata);
      return;
    }
    salvar.mutate();
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const valorNum = Number(form.valor.replace(",", "."));
      if (!form.descricao.trim()) throw new Error("Informe a descrição.");
      if (!Number.isFinite(valorNum) || valorNum <= 0) throw new Error("Informe um valor válido.");
      if (!form.data) throw new Error("Informe a data.");

      const [tipoPg, idPg] = form.pagamento.split(":");
      const cartao_id = tipoPg === "cartao" ? (idPg ?? null) : null;
      const banco_id = tipoPg === "banco" ? (idPg ?? null) : null;

      if (form.tipo === "despesa") {
        const totalParcelas = Math.max(1, Number(form.parcelas) || 1);
        const { data: despesa, error } = await supabase
          .from("despesas")
          .insert({
            descricao: form.descricao.trim(),
            observacoes: form.observacao.trim() || null,
            valor_total: valorNum,
            moeda: "BRL",
            categoria: form.categoria || "Categoria a confirmar",
            tipo: "variavel",
            data_compra: form.data,
            total_parcelas: totalParcelas,
            data_primeira_parcela: form.data,
            responsavel: form.responsavel,
            cartao_id,
            banco_id,
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        if (error) throw error;

        const base = new Date(`${form.data}T12:00:00`);
        const parcelas = dividirParcelas(valorNum, totalParcelas).map((valor, i) => ({
          despesa_id: despesa.id,
          numero: i + 1,
          total: totalParcelas,
          valor,
          moeda: "BRL",
          vencimento: toISODate(addMonths(base, i)),
          paga: false,
        }));
        const { error: e2 } = await supabase.from("parcelas").insert(parcelas);
        if (e2) throw e2;
      } else {
        const { error } = await supabase.from("receitas").insert({
          descricao: form.descricao.trim(),
          observacoes: form.observacao.trim() || null,
          valor: valorNum,
          moeda: "BRL",
          categoria: form.categoria || "Outros",
          data_recebimento: form.data,
          recorrente: false,
          responsavel: form.responsavel,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.tipo === "despesa" ? "Despesa lançada" : "Receita lançada");
      registrarNoHistorico(
        "lancamento",
        texto.trim() || form.descricao,
        `${form.tipo === "despesa" ? "Despesa" : "Receita"}: ${form.descricao} · R$ ${form.valor} · ${form.data}${form.categoria ? ` · ${form.categoria}` : ""}${form.responsavel ? ` · ${form.responsavel}` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["receitas"] });
      fechar();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Não foi possível salvar o lançamento.");
    },
  });

  const mostrarFormulario = rascunho !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : fechar())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4.5 text-primary" /> Lançar ou resumir com IA
          </DialogTitle>
          <DialogDescription>
            Fale ou digite o que aconteceu pra lançar na hora, ou peça um resumo rápido de como
            estão suas finanças no mês — a IA sempre te mostra antes de salvar qualquer coisa.
          </DialogDescription>
        </DialogHeader>

        {iaDesabilitada ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <p>
              O lançamento e o resumo por IA estão desativados agora pelo administrador. Você ainda
              pode lançar manualmente.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setRascunho(RASCUNHO_VAZIO);
                setModo("lancar");
              }}
            >
              Preencher manualmente
            </Button>
          </div>
        ) : (
          <Tabs value={modo} onValueChange={(v) => setModo(v as "lancar" | "resumo" | "historico")}>
            <TabsList className="w-full">
              <TabsTrigger value="lancar" className="flex-1">
                Lançar
              </TabsTrigger>
              {textoPermitido && (
                <TabsTrigger value="resumo" className="flex-1">
                  Resumo
                </TabsTrigger>
              )}
              <TabsTrigger value="historico" className="flex-1 flex items-center justify-center gap-1.5">
                Histórico
                {historico.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono leading-none">
                    {historico.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="historico" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Perguntas de resumo e lançamentos interpretados com auxílio da IA.
                </p>
                {historico.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={limparHistorico}
                    className="h-7 text-xs text-destructive hover:text-destructive flex items-center gap-1"
                  >
                    <Trash2 className="size-3.5" /> Limpar tudo
                  </Button>
                )}
              </div>

              {historico.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <History className="mx-auto mb-2 size-6 opacity-40" />
                  Nenhum registro no histórico de IA ainda.
                  <p className="mt-1 text-[11px]">
                    Perguntas na aba Resumo e lançamentos salvos aparecerão aqui para você consultar quando quiser.
                  </p>
                </div>
              ) : (
                <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1">
                  {historico.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5 transition-colors hover:bg-muted/35"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={item.tipo === "resumo" ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 h-4.5"
                          >
                            {item.tipo === "resumo" ? "Resumo" : "Lançamento"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(item.dataHora).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removerItemHistorico(item.id)}
                          className="size-5 text-muted-foreground hover:text-destructive"
                          title="Remover este item"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          <span className="text-muted-foreground font-normal">Entrada: </span>
                          "{item.perguntaOuEntrada}"
                        </p>
                        <div className="rounded bg-background/80 p-2 border text-[11px] whitespace-pre-wrap text-muted-foreground font-sans">
                          {item.respostaOuDetalhes}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="resumo" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Pergunte sobre suas finanças (ex.: <em>"quais contas terminam em novembro?"</em>,{" "}
                <em>"quanto gasto com assinaturas?"</em>, <em>"o que falta comprar?"</em>) ou peça{" "}
                <em>"adicione café na lista de compras"</em>.
              </p>
              <Textarea
                value={perguntaResumo}
                onChange={(e) =>
                  setPerguntaResumo(e.target.value.slice(0, LIMITE_CARACTERES_TEXTO_IA))
                }
                placeholder='Ex.: "quais contas terminam em novembro?" ou "adicione leite na lista"'
                rows={2}
                disabled={resumindo}
              />
              <p className="text-xs text-muted-foreground">
                Dá pra falar em vez de digitar: grave um áudio pedindo o resumo do mês ou um
                cálculo (ex.: <em>"quanto sobra se eu pagar a fatura do Nubank?"</em>).
              </p>
              <div className="flex flex-wrap items-center gap-2">
              {!gravando ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void iniciarGravacao("resumo")}
                  disabled={transcrevendo || resumindo || !audioPermitido}
                >
                  <Mic className="size-4" /> Gravar pergunta
                </Button>
              ) : (
                <Button type="button" variant="destructive" size="sm" onClick={pararGravacao}>
                  <Square className="size-4" /> Parar gravação
                </Button>
              )}
              {transcrevendo && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Transcrevendo áudio…
                </span>
              )}
              <Button type="button" size="sm" onClick={resumir} disabled={resumindo || gravando || transcrevendo}>
                {resumindo ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {perguntaResumo.trim() ? "Perguntar à IA" : "Resumir meu mês"}
              </Button>
              </div>
              {respostaResumo && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {respostaResumo}
                </div>
              )}
            </TabsContent>

            <TabsContent value="lancar" className="space-y-3">
              <PrimeiraCategoriaGuia tipo="despesa" />
              {modoIa === "somente_audio" && !textoLiberadoPorAudio && (
                <p className="text-xs text-muted-foreground">
                  O administrador liberou apenas entrada por áudio agora — grave um áudio pra
                  liberar o campo de texto, ou preencha o formulário manualmente.
                </p>
              )}
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_CARACTERES_TEXTO_IA))}
                placeholder="Ex.: gastei 45 reais de uber hoje, no cartão nubank"
                rows={3}
                disabled={
                  gravando ||
                  transcrevendo ||
                  (modoIa === "somente_audio" && !textoLiberadoPorAudio)
                }
              />
              <div className="flex items-center gap-2">
                {audioPermitido &&
                  (!gravando ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void iniciarGravacao("lancar")}
                      disabled={transcrevendo}
                    >
                      <Mic className="size-4" /> Gravar áudio
                    </Button>
                  ) : (
                    <Button type="button" variant="destructive" size="sm" onClick={pararGravacao}>
                      <Square className="size-4" /> Parar gravação
                    </Button>
                  ))}
                {transcrevendo && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Transcrevendo áudio…
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="ml-auto"
                  onClick={interpretar}
                  disabled={interpretando || gravando || transcrevendo || !texto.trim()}
                >
                  {interpretando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Interpretar com IA
                </Button>
              </div>

              {!mostrarFormulario && (
                <p className="text-xs text-muted-foreground">
                  Também dá pra pular a IA: escreva a descrição e clique em "Interpretar" — se ela
                  não conseguir, o formulário abaixo abre em branco pra você preencher na mão.
                </p>
              )}

              {mostrarFormulario && duplicata && (
                <Alert className="border-warning/40 bg-warning/10">
                  <AlertTriangle className="size-4 text-warning" />
                  <AlertTitle className="text-sm">Possível duplicidade</AlertTitle>
                  <AlertDescription className="text-xs">
                    Já existe "{duplicata.descricao}" com o mesmo valor nessa mesma data. Clique em
                    salvar novamente para confirmar mesmo assim.
                  </AlertDescription>
                </Alert>
              )}

              {mostrarFormulario && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tipo">
                      <Select
                        value={form.tipo}
                        onValueChange={(v) =>
                          setForm({ ...form, tipo: v as "despesa" | "receita", categoria: "" })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="despesa">Despesa</SelectItem>
                          <SelectItem value="receita">Receita</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Data">
                      <Input
                        type="date"
                        value={form.data}
                        onChange={(e) => setForm({ ...form, data: e.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label="Descrição">
                    <Input
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                      placeholder="Ex.: Mercado"
                    />
                  </Field>

                  <Field label="Observação (opcional)">
                    <Textarea
                      value={form.observacao}
                      onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                      placeholder="Detalhes extras que não cabem na descrição"
                      rows={2}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Valor (R$)">
                      <Input
                        inputMode="decimal"
                        value={form.valor}
                        onChange={(e) => setForm({ ...form, valor: e.target.value })}
                        placeholder="0,00"
                      />
                    </Field>
                    <Field label={form.tipo === "despesa" ? "Parcelas" : "Responsável"}>
                      {form.tipo === "despesa" ? (
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={form.parcelas}
                          onChange={(e) => setForm({ ...form, parcelas: e.target.value })}
                        />
                      ) : (
                        <Select
                          value={form.responsavel}
                          onValueChange={(v) => setForm({ ...form, responsavel: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {perfis.map((p: any) => (
                              <SelectItem key={p.id} value={p.nome}>
                                {p.nome}
                              </SelectItem>
                            ))}
                            <SelectItem value={RESPONSAVEIS_EXTRA}>{RESPONSAVEIS_EXTRA}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                  </div>

                  {form.tipo === "despesa" && (
                    <Field label="Responsável">
                      <Select
                        value={form.responsavel}
                        onValueChange={(v) => setForm({ ...form, responsavel: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {perfis.map((p: any) => (
                            <SelectItem key={p.id} value={p.nome}>
                              {p.nome}
                            </SelectItem>
                          ))}
                          <SelectItem value={RESPONSAVEIS_EXTRA}>{RESPONSAVEIS_EXTRA}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  <Field label="Categoria">
                    <Select
                      value={form.categoria}
                      onValueChange={(v) => setForm({ ...form, categoria: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(form.tipo === "despesa" ? categoriasDespesa : categoriasReceita).map(
                          (c: any) => (
                            <SelectItem key={c.id} value={c.nome}>
                              {c.nome}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  {form.tipo === "despesa" && (
                    <Field label="Forma de pagamento (opcional)">
                      <Select
                        value={form.pagamento}
                        onValueChange={(v) => setForm({ ...form, pagamento: v as FormaPagamento })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhum">Pix / dinheiro / não informado</SelectItem>
                          {cartoes.map((c: any) => (
                            <SelectItem key={c.id} value={`cartao:${c.id}`}>
                              {c.apelido || "Cartão"} {c.final ? `•${c.final}` : ""}
                            </SelectItem>
                          ))}
                          {bancos.map((b: any) => (
                            <SelectItem key={b.id} value={`banco:${b.id}`}>
                              {b.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          {modo === "lancar" && mostrarFormulario && (
            <Button onClick={tentarSalvar} disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {duplicata ? "Salvar mesmo assim" : "Salvar lançamento"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
