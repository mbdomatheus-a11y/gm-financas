import { createFileRoute } from "@tanstack/react-router";
import { guardarMesSite } from "@/lib/mes-escolhido";
import { usePreferencias } from "@/hooks/usePreferencias";
import { datasDoCiclo } from "@/lib/previsao-mes";
import { useNumerosCiclo } from "@/hooks/useNumerosCiclo";
import { ROTULO_SOBRA_PREVISTA, ROTULO_SOBRA_REAL, janelasDoCiclo, lancamentosDoCiclo, textoPorDia, textoVaiSobrar } from "@/lib/numeros-ciclo";
import { CampoCategoria } from "@/components/CampoCategoria";
import { useEffect, useMemo, useRef, useState } from "react";
import { useValorAdiado } from "@/hooks/useValorAdiado";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  EllipsisVertical,
  List as ListIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  X,
  Receipt,
  RotateCcw,
  Landmark,
} from "lucide-react";
import { FaturaMesDialog } from "@/components/FaturaMesDialog";
import { IndiceReajusteField } from "@/components/IndiceReajusteField";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { JuntarLancamentoDialog } from "@/components/JuntarLancamentoDialog";
import { useIsSiteAdmin, useModulosGlobais } from "@/hooks/useAuthData";
import { carregarVinculos, melhorSugestao, type LancamentoOF } from "@/lib/juntar-lancamento";
import { excluirDespesaSerie } from "@/lib/exclusao-recorrente";
import { diasAntesPadrao, vencimentoDaFatura } from "@/lib/fatura-ciclo";
import { ExcluirRecorrenteDialog } from "@/components/ExcluirRecorrenteDialog";
import { z } from "zod";

import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { correspondeBuscaComValor } from "@/lib/busca";
import { PrimeiraCategoriaGuia } from "@/components/PrimeiraCategoriaGuia";
import { AppLayout } from "@/components/AppLayout";
import { BarraSoma, useSelecaoSoma } from "@/components/BarraSoma";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useContas, useContasComSaldo } from "@/hooks/useContas";
import { definirTagsDoLancamento, useTags, useTagsDoLancamento } from "@/hooks/useTags";
import { SeletorTags } from "@/components/SeletorTags";
import { supabase } from "@/integrations/supabase/client";
import {
  RESPONSAVEIS_EXTRA,
  useBancos,
  useCartoes,
  useCategorias,
  useDespesas,
  useReceitas,
  useFaturasMes,
  useProfilesList,
} from "@/hooks/useFinance";
import { lembrarClassificacao } from "@/lib/classificacao-lembrada";
import { SelectBusca } from "@/components/SelectBusca";
import { NavegadorMes } from "@/components/NavegadorMes";
import { IconeBanco } from "@/components/IconeBanco";
import { visualDoBanco } from "@/lib/banco-visual";
import { formatarNomeExibicao } from "@/lib/nome-exibicao";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { Skeleton } from "@/components/ui/skeleton";
import {
  competenciaDe,
  lancamentosPorCompetencias,
  PERIODICIDADES,
  projetarCompetencias,
  receitasPorCompetencias,
  somarMeses,
  type Periodicidade,
  type RecorrenciaFixa,
} from "@/lib/recorrencia";
import { useCotacao } from "@/hooks/useCotacao";
import { addMonths, dividirParcelas, formatBRL, formatDate, formatUSD, identificacaoDespesa, monthKey, monthLabelLong, parseDate, toBRL, toISODate, competenciaAtual, competenciaDoDia, mesDoCiclo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { lancamentosDoCardMes } from "@/lib/lancamentos-card";
import { PixDespesas, usePix } from "@/components/pix/AbaPix";

export const Route = createFileRoute("/_authenticated/despesas")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    cartao?: string;
    modo?: "lista" | "cartao";
    mes?: string;
    economia?: boolean;
    novo?: boolean;
    busca?: string;
    filtro?: "parcelas" | "aberto";
  } => ({
    ...(s["novo"] === true || s["novo"] === "true" || s["novo"] === 1 ? { novo: true } : {}),
    ...(typeof s["cartao"] === "string" && s["cartao"] ? { cartao: s["cartao"] } : {}),
    ...(s["modo"] === "cartao" || s["modo"] === "lista" ? { modo: s["modo"] } : {}),
    ...(s["filtro"] === "parcelas" || s["filtro"] === "aberto" ? { filtro: s["filtro"] } : {}),
    ...(typeof s["mes"] === "string" && s["mes"] ? { mes: s["mes"] } : {}),
    // Bloco 3 (plano-mega-2026-09-14.md): o card "Economia Conquistada" da
    // Início usa isso pra levar direto aos lançamentos que geraram a economia.
    ...(s["economia"] === true ? { economia: true } : {}),
    // "Quero cancelar" em /para-onde-vai abre esta tela já filtrando o gasto.
    ...(typeof s["busca"] === "string" && s["busca"] ? { busca: s["busca"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Despesas | Control ALL" },
      {
        name: "description",
        content:
          "Despesas fixas e variáveis com parcelamento automático, alerta de duplicidade e controle de parcelas pagas.",
      },
      { property: "og:title", content: "Despesas | Control ALL" },
      {
        property: "og:description",
        content: "Controle de despesas fixas, variáveis e parcelamentos do casal.",
      },
    ],
  }),
  component: DespesasPage,
});

const schema = z.object({
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(120),
  valor_total: z.number().positive("Valor deve ser maior que zero"),
  moeda: z.enum(["BRL", "USD"]),
  categoria: z.string().min(1, "Selecione a categoria"),
  tipo: z.enum(["fixa", "variavel"]),
  data_compra: z.string().min(10, "Informe a data"),
  total_parcelas: z.number().int().min(1, "Número de parcelas obrigatório (mínimo 1)"),
  data_primeira_parcela: z.string().min(10, "Informe a data da 1ª parcela"),
  responsavel: z.string().min(1, "Informe o responsável"),
  observacoes: z.string().max(500).nullable(),
  economia_conquistada: z.boolean(),
});

function novoForm(tipo: "fixa" | "variavel") {
  return {
    descricao: "",
    valor_total: "",
    moeda: "BRL",
    categoria: "",
    tipo,
    data_compra: toISODate(new Date()),
    pagamento: "",
    total_parcelas: "1",
    parcela_atual: "1",
    data_primeira_parcela: toISODate(new Date()),
    responsavel: "",
    observacoes: "",
    economia_conquistada: false,
    // Variável parcelada: true = o valor digitado é o da parcela (total = parcela x parcelas).
    informar_parcela: true,
    recorrencia_duracao: "sem_prazo",
    recorrencia_meses: "12",
    reajuste_tipo: "nenhum",
    reajuste_percentual: "",
    reajuste_periodicidade: "anual",
    reajuste_indice: "",
    reajuste_inicio: "",
  };
}

/** Horizonte de competências geradas para uma despesa fixa sem prazo. */
const HORIZONTE_SEM_PRAZO = 36;

function DespesasPage() {
  const qc = useQueryClient();
  const cotacao = useCotacao();
  const { user } = useSession();
  const { can, isSiteAdmin } = usePermissoes();
  const { data: despesas = [] } = useDespesas();
  const financasProntas = useFinancasProntas();
  const { data: receitas = [] } = useReceitas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: categorias = [] } = useCategorias("despesa");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const { data: perfis = [] } = useProfilesList();
  const { formatar } = usePrivacidadeValores();

  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Item 3 (backlog 2026-09-27): aba e filtros de categoria/banco/responsável
  // são lembrados por sessão (localStorage) e restaurados quando o usuário
  // volta pra tela. `filtroMes` e `modoLista` ficam de fora de propósito —
  // eles já têm sua própria lógica de default (mês atual / `?mes=`/`?modo=`
  // vindos de outras telas, ex. o card "Dívida total" do dashboard), e
  // persistir por localStorage entraria em conflito com esse comportamento.
  const [tab, setTab] = usePersistedState<"total" | "fixa" | "variavel" | "pix">("despesas.tab", "total");
  // Ordenação da lista (vale dentro de cada grupo); padrão = ordem original. Lembrada em localStorage.
  const [ordem, setOrdem] = usePersistedState<"padrao" | "valor_desc" | "valor_asc" | "nome_asc" | "nome_desc">(
    "despesas.ordem",
    "padrao",
  );
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Bloco 6 (plano-mega 2026-09-14): simulação visual de corte em despesas
  // fixas — desmarcar itens aqui só recalcula o total exibido na hora,
  // nunca grava nada no banco. Estado local, puro "e se", reseta ao trocar
  // de aba/mês ou sair da tela.
  const [simulandoCortes, setSimulandoCortes] = useState(false);
  // Item 2 (2026-10-05): modo "Somar itens" (marcar lançamentos e ver a soma na hora).
  const soma = useSelecaoSoma();
  const [idsExcluidosSimulacao, setIdsExcluidosSimulacao] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<any>(novoForm("fixa"));
  const [duplicata, setDuplicata] = useState<any | null>(null);
  // 07/11/2026: "Conta ou cartão" (contas bancárias do módulo Contas) e tags no formulário.
  const contasPg = useContasComSaldo(receitas as any, despesas as any);
  const contasDisponiveis = contasPg.tabelaPendente ? [] : contasPg.linhas;
  // 07/11/2026: nome da conta na identificação da despesa (todas, inclusive arquivadas; vazio com a tabela pendente).
  const { todas: todasContas } = useContas();
  const nomesContas = useMemo(() => new Map(todasContas.map((c) => [String(c.id), c.nome])), [todasContas]);
  const { tabelaPendente: tagsPendentes } = useTags();
  const [tagsForm, setTagsForm] = useState<string[]>([]);
  const tagsAtuais = useTagsDoLancamento("despesa", editId);
  useEffect(() => {
    if (editId && tagsAtuais.data) setTagsForm(tagsAtuais.data);
  }, [editId, tagsAtuais.data]);
  const [busca, setBusca] = useState(search.busca ?? "");
  const buscaAdiada = useValorAdiado(busca, 250);
  // `mes=todos` na URL (ex.: vindo do card "Dívida total em aberto" do
  // dashboard) abre a página já mostrando a dívida completa, não só a do
  // mês atual.
  // 03/11/2026: abre sempre no ciclo vigente (igual ao Início), não no último mês escolhido.
  const { prefs: prefsCiclo } = usePreferencias();
  const [filtroMes, setFiltroMes] = useState(search.mes ?? competenciaAtual());
  // 07/11/2026: a sobra vem só de numeros-ciclo.ts (mesmo número do Início e das Finanças).
  const numerosCiclo = useNumerosCiclo(filtroMes === "todos" ? undefined : filtroMes);
  const cicloTexto = useMemo(() => {
    if (filtroMes === "todos") return "";
    // 08/11/2026: regra do ciclo: contas pelo vencimento de D+1 até D do mês seguinte.
    const j = janelasDoCiclo(filtroMes, prefsCiclo.dia_virada);
    return ` · ciclo ${j.rotulo}`;
  }, [filtroMes, prefsCiclo.dia_virada]);
  // 28/10/2026: o mês escolhido fica salvo e vale também em Receitas e Calendário.
  useEffect(() => {
    guardarMesSite(filtroMes);
  }, [filtroMes]);
  // Aba PIX (24/10/2026): PIX enviados pelo Open Finance esperando decisão.
  const { data: pixSaida } = usePix("saida");
  const pixPendentes = (pixSaida?.itens ?? []).filter(
    (p) => p.situacao === "pendente" && (filtroMes === "todos" || p.data.slice(0, 7) === filtroMes),
  ).length;
  useEffect(() => {
    if (tab === "pix" && pixSaida && !pixSaida.disponivel) setTab("total");
  }, [tab, pixSaida, setTab]);
  const [filtroBanco, setFiltroBanco] = usePersistedState("despesas.filtroBanco", "todos");
  const [filtroCategoria, setFiltroCategoria] = usePersistedState(
    "despesas.filtroCategoria",
    "todos",
  );
  const [filtroResponsavel, setFiltroResponsavel] = usePersistedState(
    "despesas.filtroResponsavel",
    "todos",
  );
  /** Item 3 (plano de 2026-10-02, Frente 3): distinguir lançamentos diretos
   * (avulsos, inclui os feitos por IA) dos vindos de fatura/importação,
   * usando o campo `origem` que já existe em `despesas` — nenhuma coluna
   * nova. */
  const [filtroOrigem, setFiltroOrigem] = usePersistedState("despesas.filtroOrigem", "todos");
  const [filtroEconomia, setFiltroEconomia] = useState(search.economia ?? false);
  // `modo=cartao` na URL (ex.: vindo do card "Parcelas mensalizadas" do
  // dashboard) abre a página já na visão "Por cartão".
  // 2026-10-10: a visão por cartão é o padrão e a escolha do usuário fica
  // guardada. O estado é SEMPRE o salvo — um `?modo=` vindo de outra tela só
  // o ajusta uma vez, ao abrir, e some da URL em seguida. Antes o `?modo=`
  // ficava mandando o tempo todo: clicar na aba não trocava nada e a
  // preferência parecia não salvar.
  const [modoLista, setModoLista] = usePersistedState<"lista" | "cartao">(
    "despesas.modoLista",
    "cartao",
  );
  const modoDaUrl = search.modo;
  useEffect(() => {
    if (!modoDaUrl) return;
    setModoLista(modoDaUrl);
    void navigate({
      search: (atual: Record<string, unknown>) => {
        const { modo: _modo, ...resto } = atual;
        return resto;
      },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoDaUrl]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);
  const [filtroResumo, setFiltroResumo] = useState<null | "pago" | "aberto" | "proximo" | "parcelas">(null);
  // 08/11/2026: filtro vindo dos cards do dashboard (?filtro=&mes=); usa a mesma função do card.
  const origemCardRef = useRef<{ filtro: "parcelas" | "aberto"; mes: string } | null>(null);

  const filtroCartao = search.cartao ?? "todos";
  const setFiltroCartao = (v: string) =>
    navigate({
      search: (s: any) => ({ ...s, cartao: v === "todos" ? undefined : v }),
      replace: true,
    });

  const responsaveis = [...perfis.map((p: any) => p.nome), RESPONSAVEIS_EXTRA];

  const valorDigitado = Number(String(form.valor_total).replace(",", ".")) || 0;
  const parcelasInformadas = Math.max(1, Number(form.total_parcelas) || 1);
  const ehFixa = form.tipo === "fixa";
  const semPrazo = ehFixa && form.recorrencia_duracao === "sem_prazo";
  const mesesPrazo = Math.max(1, Number(form.recorrencia_meses) || 1);
  const percentualReajuste = Number(String(form.reajuste_percentual).replace(",", ".")) || 0;

  /** Recorrência configurada no formulário (somente para despesas fixas). */
  const recorrencia: RecorrenciaFixa | null = ehFixa
    ? {
        valor: valorDigitado,
        inicio: form.data_primeira_parcela || form.data_compra,
        semPrazo,
        meses: semPrazo ? null : mesesPrazo,
        reajuste:
          form.reajuste_tipo === "composto" && percentualReajuste !== 0
            ? {
                percentual: percentualReajuste,
                periodicidade: form.reajuste_periodicidade as Periodicidade,
                inicio: form.reajuste_inicio || null,
                indice: form.reajuste_indice || null,
              }
            : null,
      }
    : null;

  /** Competências geradas para a recorrência (horizonte limitado quando sem prazo). */
  const projecao = useMemo(() => {
    if (!recorrencia || valorDigitado <= 0 || !recorrencia.inicio) return [];
    const inicio = competenciaDe(recorrencia.inicio);
    const qtd = recorrencia.semPrazo ? HORIZONTE_SEM_PRAZO : (recorrencia.meses ?? 1);
    return projetarCompetencias(recorrencia, inicio, somarMeses(inicio, qtd - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    valorDigitado,
    ehFixa,
    semPrazo,
    mesesPrazo,
    form.data_primeira_parcela,
    form.data_compra,
    form.reajuste_tipo,
    percentualReajuste,
    form.reajuste_periodicidade,
    form.reajuste_inicio,
  ]);

  const nParcelas = ehFixa ? Math.max(1, projecao.length) : parcelasInformadas;
  // Fixa: o valor gravado é o valor mensal. Variável: valor da parcela x parcelas.
  // Switch "Informar valor da parcela" desligado: o valor digitado já é o total da compra.
  const informarParcela = form.informar_parcela !== false;
  const valorNum = ehFixa
    ? valorDigitado
    : informarParcela
      ? Number((valorDigitado * nParcelas).toFixed(2))
      : valorDigitado;
  const previewParcela =
    ehFixa || informarParcela ? valorDigitado : Number((valorDigitado / nParcelas).toFixed(2));
  const ultimaCompetencia = projecao.at(-1);

  const possivelDuplicata = useMemo(() => {
    if (editId) return null;
    if (!form.descricao && !valorNum) return null;
    const [tipoPg, idPg] = String(form.pagamento).split(":");
    return (
      despesas.find((d: any) => {
        const mesmaDescricao =
          d.descricao.trim().toLowerCase() === String(form.descricao).trim().toLowerCase();
        const valorProximo = Math.abs(Number(d.valor_total) - valorNum) <= valorNum * 0.02;
        const diffDias =
          Math.abs(parseDate(d.data_compra).getTime() - parseDate(form.data_compra).getTime()) /
          86400000;
        const mesmoPagamento =
          (tipoPg === "cartao" && d.cartao_id === idPg) ||
          (tipoPg === "conta" && d.conta_id === idPg) ||
          (tipoPg === "banco" && d.banco_id === idPg);
        return (mesmaDescricao || valorProximo) && diffDias <= 3 && (mesmoPagamento || !idPg);
      }) ?? null
    );
  }, [despesas, editId, form.descricao, form.data_compra, form.pagamento, valorNum]);

  useEffect(() => {
    if (!search.novo) return;
    setEditId(null);
    setForm(novoForm(tab === "fixa" ? "fixa" : "variavel"));
    setTagsForm([]);
    setOpen(true);
    void navigate({
      search: (p: Record<string, unknown>) => {
        const { novo: _n, ...resto } = p;
        return resto as never;
      },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.novo]);

  function abrirNova() {
    setEditId(null);
    setForm(novoForm(tab === "fixa" ? "fixa" : "variavel"));
    setDuplicata(null);
    setTagsForm([]);
    setOpen(true);
  }

  function abrirEdicao(d: any) {
    if (!can("despesas", "editar")) return;
    setEditId(d.id);
    setDuplicata(null);
    setTagsForm([]);
    const n = Math.max(1, Number(d.total_parcelas) || 1);
    const fixa = (d.tipo ?? "fixa") === "fixa";
    // Fixa nova já grava o valor mensal; registros antigos guardavam o total.
    const mensal = d.recorrencia_inicio
      ? Number(d.valor_total ?? 0)
      : Number((Number(d.valor_total ?? 0) / n).toFixed(2));
    setForm({
      ...novoForm(d.tipo ?? "fixa"),
      descricao: d.descricao ?? "",
      valor_total: String(fixa ? mensal : Number((Number(d.valor_total ?? 0) / n).toFixed(2))),
      moeda: d.moeda ?? "BRL",
      categoria: d.categoria ?? "",
      tipo: d.tipo ?? "fixa",
      data_compra: d.data_compra,
      pagamento: d.cartao_id
        ? `cartao:${d.cartao_id}`
        : d.conta_id
          ? `conta:${d.conta_id}`
          : d.banco_id
            ? `banco:${d.banco_id}`
            : "",
      total_parcelas: fixa ? "1" : String(n),
      data_primeira_parcela: d.recorrencia_inicio ?? d.data_primeira_parcela,
      responsavel: d.responsavel ?? "",
      observacoes: d.observacoes ?? "",
      economia_conquistada: !!d.economia_conquistada,
      recorrencia_duracao: d.recorrencia_meses ? "prazo" : "sem_prazo",
      recorrencia_meses: String(d.recorrencia_meses ?? 12),
      reajuste_tipo: d.reajuste_percentual ? "composto" : "nenhum",
      reajuste_percentual: d.reajuste_percentual ? String(d.reajuste_percentual) : "",
      reajuste_periodicidade: d.reajuste_periodicidade ?? "anual",
      reajuste_indice: d.reajuste_indice ?? "",
      reajuste_inicio: d.reajuste_inicio ?? "",
    });

    setOpen(true);
  }

  const salvar = useMutation({
    mutationFn: async (_opcoes?: { continuar?: boolean }) => {
      const parsed = schema.parse({
        descricao: form.descricao,
        valor_total: valorNum,
        moeda: form.moeda,
        categoria: form.categoria,
        tipo: form.tipo,
        data_compra: form.data_compra,
        total_parcelas: nParcelas,
        data_primeira_parcela: form.data_primeira_parcela,
        responsavel: form.responsavel,
        observacoes: form.observacoes || null,
        economia_conquistada: !!form.economia_conquistada,
      });
      const [tipoPg, idPg] = String(form.pagamento).split(":");
      // conta_id só vai no payload quando há conta escolhida e o módulo Contas existe
      // (migration aplicada). Na edição, limpa a conta antiga se o usuário trocou para cartão.
      const contaEscolhida =
        tipoPg === "conta" && idPg && !contasPg.tabelaPendente ? idPg : null;
      const despesaOriginal: any = editId ? despesas.find((d: any) => d.id === editId) : null;
      const vinculoConta: { conta_id?: string | null } = contaEscolhida
        ? { conta_id: contaEscolhida }
        : despesaOriginal?.conta_id
          ? { conta_id: null }
          : {};
      const vinculos = {
        ...vinculoConta,
        cartao_id: tipoPg === "cartao" ? (idPg ?? null) : null,
        banco_id: tipoPg === "banco" ? (idPg ?? null) : null,
        recorrencia_inicio: ehFixa ? parsed.data_primeira_parcela : null,
        recorrencia_sem_prazo: ehFixa ? semPrazo : false,
        recorrencia_meses: ehFixa && !semPrazo ? mesesPrazo : null,
        reajuste_percentual: recorrencia?.reajuste?.percentual ?? null,
        reajuste_periodicidade: recorrencia?.reajuste?.periodicidade ?? null,
        reajuste_indice: recorrencia?.reajuste?.indice ?? null,
        reajuste_inicio: recorrencia?.reajuste?.inicio ?? null,
      };

      let despesaId = editId;
      if (editId) {
        const { error } = await supabase
          .from("despesas")
          .update({ ...parsed, ...vinculos } as any)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { data: despesa, error } = await supabase
          .from("despesas")
          .insert({ ...parsed, ...vinculos, created_by: user?.id ?? null } as any)
          .select()
          .single();
        if (error) throw error;
        despesaId = despesa.id;
      }

      const antigas = editId
        ? ((despesas.find((d: any) => d.id === editId)?.parcelas ?? []) as any[])
        : [];
      const pagasPorNumero = new Set<number>(
        antigas.filter((p: any) => p.paga).map((p: any) => p.numero),
      );
      // Na recorrência o pagamento pertence à competência, não ao número da parcela.
      const pagasPorCompetencia = new Map<string, string | null>(
        antigas
          .filter((p: any) => p.paga)
          .map((p: any) => [competenciaDe(p.vencimento), p.data_pagamento ?? null]),
      );
      if (editId) {
        const { error } = await supabase.from("parcelas").delete().eq("despesa_id", editId);
        if (error) throw error;
      }

      const parcelasPagasInformadas = Math.max(1, Number(form.parcela_atual) || 1);
      const dataInformada = parseDate(parsed.data_primeira_parcela);
      // Compra de cartão cai na fatura do ciclo (fechamento e vencimento do cadastro).
      const cartaoDaCompra = !ehFixa && tipoPg === "cartao" ? cartoes.find((c: any) => c.id === idPg) : undefined;
      const dataNaFatura =
        cartaoDaCompra?.dia_vencimento
          ? parseDate(
              vencimentoDaFatura(toISODate(dataInformada), {
                diaFechamento: cartaoDaCompra.dia_fechamento ?? null,
                diaVencimento: cartaoDaCompra.dia_vencimento,
                diasAntes: diasAntesPadrao(`${cartaoDaCompra.bancos?.nome ?? ""} ${cartaoDaCompra.apelido ?? ""}`),
              }),
            )
          : dataInformada;
      const base =
        !ehFixa && parsed.total_parcelas > 1 && parcelasPagasInformadas > 1
          ? addMonths(dataNaFatura, 1 - parcelasPagasInformadas)
          : dataNaFatura;

      const parcelas = ehFixa
        ? projecao.map((c, i) => ({
            despesa_id: despesaId!,
            numero: i + 1,
            total: projecao.length,
            valor: c.valor,
            moeda: parsed.moeda,
            vencimento: toISODate(addMonths(base, i)),
            paga: pagasPorCompetencia.has(c.competencia),
            data_pagamento: pagasPorCompetencia.get(c.competencia) ?? null,
          }))
        : dividirParcelas(parsed.valor_total, parsed.total_parcelas).map((valor, i) => {
            const numero = i + 1;
            const jaPaga =
              pagasPorNumero.has(numero) || (!editId && numero <= parcelasPagasInformadas);
            return {
              despesa_id: despesaId!,
              numero,
              total: parsed.total_parcelas,
              valor,
              moeda: parsed.moeda,
              vencimento: toISODate(addMonths(base, i)),
              paga: jaPaga,
              data_pagamento: jaPaga ? toISODate(addMonths(base, i)) : null,
            };
          });
      const { error: e2 } = await supabase.from("parcelas").insert(parcelas);
      if (e2) throw e2;
      // Guarda esta classificação para o mesmo estabelecimento: a próxima
      // importação (e a reimportação da mesma fatura) já vem com a categoria e
      // o tipo que você escolheu aqui, sem precisar corrigir de novo.
      await lembrarClassificacao({
        descricao: parsed.descricao,
        categoria: parsed.categoria,
        subcategoria: (parsed as { subcategoria?: string | null }).subcategoria ?? null,
        tipo: parsed.tipo,
        userId: user?.id ?? null,
      });
      // Tags: grava depois da despesa salva. Falha aqui não desfaz a despesa.
      const tinhaTags = !!editId && (tagsAtuais.data?.length ?? 0) > 0;
      if (despesaId && !tagsPendentes && (tagsForm.length > 0 || tinhaTags)) {
        try {
          await definirTagsDoLancamento("despesa", despesaId, tagsForm);
        } catch {
          toast.error("Despesa salva, mas as tags não foram gravadas.");
        }
      }
      return despesaId;
    },
    onSuccess: (_id, opcoes) => {
      if (opcoes?.continuar && !editId) {
        // "Salvar e adicionar outro": mantém data, conta/cartão, categoria, tipo e responsável.
        toast.success("Despesa salva. Pode lançar a próxima.");
        setDuplicata(null);
        setTagsForm([]);
        setForm((f: any) => ({
          ...novoForm(f.tipo === "fixa" ? "fixa" : "variavel"),
          data_compra: f.data_compra,
          data_primeira_parcela: f.data_primeira_parcela,
          pagamento: f.pagamento,
          categoria: f.categoria,
          responsavel: f.responsavel,
          moeda: f.moeda,
          informar_parcela: f.informar_parcela,
        }));
        qc.invalidateQueries();
        return;
      }
      toast.success(editId ? "Despesa atualizada" : "Despesa cadastrada com parcelas geradas");
      setOpen(false);
      setEditId(null);
      setDuplicata(null);
      setTagsForm([]);
      setForm(novoForm(tab === "fixa" ? "fixa" : "variavel"));
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message ?? "Erro ao salvar"),
  });

  const togglePaga = useMutation({
    mutationFn: async ({ id, paga }: { id: string; paga: boolean }) => {
      const { error } = await supabase
        .from("parcelas")
        .update({ paga, data_pagamento: paga ? toISODate(new Date()) : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const [despesaParaExcluir, setDespesaParaExcluir] = useState<any | null>(null);
  const [despesaFixaParaExcluir, setDespesaFixaParaExcluir] = useState<any | null>(null);
  const competenciaFiltrada = filtroMes !== "todos" ? filtroMes : competenciaAtual();

  async function executarExclusaoComUndo(d: any) {
    const faturaVinculada = (faturasMes as any[]).find((f) => f.despesa_avulsa_id === d.id);
    const backupDespesa = { ...d };
    const backupParcelas = [...(d.parcelas ?? [])];
    const backupFatura = faturaVinculada ? { ...faturaVinculada } : null;

    const { error } = await supabase.from("despesas").delete().eq("id", d.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (faturaVinculada) {
      await supabase
        .from("fatura_mes")
        .update({ despesa_avulsa_id: null, modo_calculo: "inclui_parcelas" })
        .eq("id", faturaVinculada.id);
    }
    qc.invalidateQueries();

    toast.success("Despesa excluída", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          try {
            const { error: insErr } = await supabase.from("despesas").insert({
              id: backupDespesa.id,
              descricao: backupDespesa.descricao,
              valor_total: backupDespesa.valor_total,
              moeda: backupDespesa.moeda,
              categoria: backupDespesa.categoria,
              tipo: backupDespesa.tipo,
              data_compra: backupDespesa.data_compra,
              total_parcelas: backupDespesa.total_parcelas,
              data_primeira_parcela: backupDespesa.data_primeira_parcela,
              cartao_id: backupDespesa.cartao_id,
              banco_id: backupDespesa.banco_id,
              banco_nome: backupDespesa.banco_nome,
              cartao_final: backupDespesa.cartao_final,
              direcao: backupDespesa.direcao,
              origem: backupDespesa.origem,
              created_by: backupDespesa.created_by,
            });
            if (insErr) throw insErr;
            if (backupParcelas.length > 0) {
              await supabase.from("parcelas").insert(
                backupParcelas.map((p: any) => ({
                  id: p.id,
                  despesa_id: backupDespesa.id,
                  numero: p.numero,
                  total: p.total,
                  valor: p.valor,
                  moeda: p.moeda,
                  vencimento: p.vencimento,
                  paga: p.paga,
                  origem: p.origem,
                })),
              );
            }
            if (backupFatura) {
              await supabase
                .from("fatura_mes")
                .update({
                  despesa_avulsa_id: backupFatura.despesa_avulsa_id,
                  modo_calculo: backupFatura.modo_calculo,
                })
                .eq("id", backupFatura.id);
            }
            qc.invalidateQueries();
            toast.success("Exclusão desfeita com sucesso.");
          } catch (err: any) {
            toast.error("Não foi possível desfazer a exclusão: " + (err.message ?? ""));
          }
        },
      },
    });
  }

  const moverTipo = useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: "fixa" | "variavel" }) => {
      const { error } = await supabase.from("despesas").update({ tipo }).eq("id", id);
      if (error) throw error;
      return tipo;
    },
    onSuccess: (tipo) => {
      toast.success(`Despesa movida para ${tipo === "fixa" ? "fixas" : "variáveis"}`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível mover"),
  });

  /** Marca/desmarca em lote todas as parcelas de um conjunto de despesas na competência filtrada
   * (usado tanto para "marcar fatura importada como paga" quanto para lançamentos fixos/variáveis). */
  const marcarLote = useMutation({
    mutationFn: async ({ ids, paga }: { ids: string[]; paga: boolean }) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("parcelas")
        .update({ paga, data_pagamento: paga ? toISODate(new Date()) : null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.paga
          ? `${vars.ids.length} lançamento(s) marcado(s) como pago(s)`
          : `${vars.ids.length} lançamento(s) marcado(s) como em aberto`,
      );
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível atualizar os lançamentos"),
  });

  const marcarParcelaPaga = useMutation({
    mutationFn: async ({ id, paga }: { id: string; paga: boolean }) => {
      const { error } = await supabase
        .from("parcelas")
        .update({ paga, data_pagamento: paga ? toISODate(new Date()) : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.paga ? "Lançamento marcado como pago" : "Lançamento marcado como em aberto",
      );
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível atualizar o lançamento"),
  });

  /** Ids reais de parcela (ignora ocorrências projetadas sem linha no banco ainda) das despesas
   * informadas, na competência filtrada, filtrando por status atual de pagamento. */
  function idsDoLote(despesasDoGrupo: any[], statusAlvo: "abertas" | "pagas"): string[] {
    if (filtroMes === "todos") return [];
    const ids: string[] = [];
    for (const d of despesasDoGrupo) {
      const parcelasDoMes = lancamentosDoFiltro.filter((p) => p.despesa_id === d.id);
      for (const p of parcelasDoMes) {
        if (p.projetada) continue;
        if (statusAlvo === "abertas" && p.paga) continue;
        if (statusAlvo === "pagas" && !p.paga) continue;
        ids.push(String(p.id));
      }
    }
    return ids;
  }

  function tentarSalvar(continuar = false) {
    if (possivelDuplicata && !duplicata) {
      setDuplicata(possivelDuplicata);
      return;
    }
    salvar.mutate({ continuar });
  }

  const meses = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 61 }, (_, i) =>
      mesDoCiclo(+ 36 - i),
    );
  }, []);

  const lancamentosDoFiltro = useMemo(
    () => (filtroMes === "todos" ? [] : lancamentosDoCiclo(despesas as any[], filtroMes, prefsCiclo.dia_virada, { incluirEconomia: true })),
    [despesas, filtroMes, prefsCiclo.dia_virada],
  );
  const lancamentoPorDespesa = useMemo(
    () => new Map(lancamentosDoFiltro.map((p) => [p.despesa_id, p])),
    [lancamentosDoFiltro],
  );

  // 07/11/2026: juntar lançamento do Open Finance com um que o usuário já tinha (mesma regra de acesso do módulo).
  const { data: ehAdminSiteOF } = useIsSiteAdmin();
  const { habilitado: moduloHabilitadoOF } = useModulosGlobais();
  const podeJuntarOF = (!!ehAdminSiteOF || isSiteAdmin || moduloHabilitadoOF("open_finance")) && can("despesas", "editar");
  const { data: vinculosOF = [] } = useQuery({
    queryKey: ["vinculos-open-finance"],
    queryFn: () => carregarVinculos(supabase),
    enabled: podeJuntarOF,
  });
  const [juntarOF, setJuntarOF] = useState<LancamentoOF | null>(null);
  const poolPorCompetencia = useMemo(() => {
    const cache = new Map<string, any[]>();
    return (comp: string) => {
      if (!cache.has(comp)) cache.set(comp, lancamentosPorCompetencias(despesas as any[], [comp]));
      return cache.get(comp)!;
    };
  }, [despesas]);
  function lancamentoOFDe(d: any): LancamentoOF | null {
    if (d.origem !== "pluggy" || !d.pluggy_transaction_id) return null;
    const comp = filtroMes !== "todos" ? filtroMes : competenciaDoDia(d.parcelas?.[0]?.vencimento ?? d.data_compra);
    const valor = filtroMes !== "todos" ? Number(lancamentoPorDespesa.get(d.id)?.valor ?? d.valor_total) : Number(d.valor_total);
    return {
      despesaId: d.id,
      transactionId: d.pluggy_transaction_id,
      descricao: String(d.descricao ?? ""),
      valor,
      data: String(d.data_compra).slice(0, 10),
      categoria: d.categoria ?? null,
      competencia: comp,
    };
  }
  function sugestaoOF(d: any) {
    if (!podeJuntarOF || (d.parcelas ?? []).length > 1) return null;
    const of = lancamentoOFDe(d);
    return of ? melhorSugestao(of, poolPorCompetencia(of.competencia), vinculosOF) : null;
  }

  const formaKey = (d: any) => (d.cartao_id ? `cartao:${d.cartao_id}` : "sem");
  const primeiroNome = (nome?: string | null) =>
    nome?.trim().split(/\s+/)[0] || "Titular não informado";

  function valorVisivel(d: any): number {
    if (filtroMes === "todos") return Number(d.valor_total ?? 0);
    return Number(lancamentoPorDespesa.get(d.id)?.valor ?? 0);
  }

  const lista = despesas.filter((d: any) => {
    if (tab !== "total" && d.tipo !== tab) return false;
    if (filtroMes !== "todos" && !lancamentoPorDespesa.has(d.id)) return false;
    if (filtroCartao !== "todos") {
      if (filtroCartao === "recorrente_fora") {
        if (d.cartao_id || (d.tipo !== "fixa" && d.tipo !== "recorrente")) return false;
      } else if (filtroCartao === "sem") {
        if (d.cartao_id || d.tipo === "fixa" || d.tipo === "recorrente") return false;
      } else if (d.cartao_id !== filtroCartao) {
        return false;
      }
    }
    if (filtroBanco !== "todos" && d.banco_id !== filtroBanco) return false;
    if (filtroCategoria !== "todos" && d.categoria !== filtroCategoria) return false;
    if (filtroResponsavel === "pessoais") {
      if (d.responsavel === RESPONSAVEIS_EXTRA) return false;
    } else if (filtroResponsavel !== "todos" && d.responsavel !== filtroResponsavel) {
      return false;
    }
    if (filtroOrigem === "diretos" && d.origem && d.origem !== "manual") return false;
    if (filtroOrigem === "fatura" && (!d.origem || d.origem === "manual")) return false;
    if (filtroEconomia && !d.economia_conquistada) return false;
    if (
      buscaAdiada &&
      !correspondeBuscaComValor(
        `${d.descricao ?? ""} ${d.categoria ?? ""} ${d.responsavel ?? ""}`,
        valorVisivel(d),
        buscaAdiada,
      )
    )
      return false;
    return true;
  });

  const idsIgnoradosPorTotal = useMemo(() => {
    if (filtroMes === "todos") return new Set<string>();
    const ids = new Set<string>();
    for (const f of faturasMes as any[]) {
      if (f.competencia !== filtroMes || f.modo_calculo !== "somente_total") continue;
      for (const d of despesas as any[]) {
        if (d.cartao_id !== f.cartao_id) continue;
        const ehResumo = d.id === f.despesa_avulsa_id;
        if (f.status === "aberta" ? !ehResumo : ehResumo) ids.add(d.id);
      }
    }
    return ids;
  }, [faturasMes, despesas, filtroMes]);

  const listaVisivel = lista;

  const resumo = useMemo(() => {
    let total = 0;
    let pago = 0;
    let aberto = 0;
    let proximo: { data: string; valor: number; fixas: number; parcelados: number; outros: number } | null =
      null;
    const futuras: { data: string; valor: number; tipo: "fixa" | "parcelado" | "outro" }[] = [];
    const hoje = toISODate(new Date());
    for (const d of listaVisivel as any[]) {
      if (idsIgnoradosPorTotal.has(d.id)) continue;
      // Economia conquistada é neutra: continua visível na lista, mas não
      // soma nos totais do mês nem na conferência com a fatura (ela é o
      // gasto que deixou de existir, não um gasto a pagar).
      if (d.economia_conquistada) continue;
      const brl = (v: number) => toBRL(v, d.moeda, cotacao);
      const parcelasVisiveis =
        filtroMes === "todos"
          ? (d.parcelas ?? [])
          : lancamentosDoFiltro.filter((p) => p.despesa_id === d.id);
      total += brl(valorVisivel(d));
      for (const p of parcelasVisiveis) {
        if (p.paga) pago += brl(Number(p.valor));
        else {
          aberto += brl(Number(p.valor));
          if (p.vencimento >= hoje)
            futuras.push({
              data: p.vencimento,
              valor: brl(Number(p.valor)),
              tipo:
                d.tipo === "fixa"
                  ? "fixa"
                  : Number(d.total_parcelas ?? p.total ?? 1) > 1
                    ? "parcelado"
                    : "outro",
            });
        }
      }
    }
    // Próximo vencimento: soma de TUDO que vence na próxima data (antes mostrava só uma
    // parcela), separando despesas fixas e compras parceladas no cartão.
    const dataProxima = futuras.reduce<string | null>(
      (min, f) => (!min || f.data < min ? f.data : min),
      null,
    );
    if (dataProxima) {
      const doDia = futuras.filter((f) => f.data === dataProxima);
      const somaTipo = (tipo: string) =>
        doDia.filter((f) => f.tipo === tipo).reduce((s, f) => s + f.valor, 0);
      proximo = {
        data: dataProxima,
        valor: doDia.reduce((s, f) => s + f.valor, 0),
        fixas: somaTipo("fixa"),
        parcelados: somaTipo("parcelado"),
        outros: somaTipo("outro"),
      };
    }
    return { total, pago, aberto, proximo };
  }, [listaVisivel, cotacao, filtroMes, lancamentosDoFiltro, lancamentoPorDespesa, idsIgnoradosPorTotal]);

  // Lançamentos (parcelas) que compõem cada indicador do topo; ao clicar num indicador a lista mostra só eles.
  const lancamentosDoResumo = useMemo(() => {
    const itens: { despesa: any; parcela: any; valor: number }[] = [];
    if (!filtroResumo) return itens;
    if (filtroResumo === "parcelas" || (origemCardRef.current?.filtro === filtroResumo && origemCardRef.current.mes === filtroMes))
      return lancamentosDoCardMes(despesas as any[], faturasMes as any[], filtroMes, filtroResumo as "parcelas" | "aberto", cotacao, prefsCiclo.somar_pagamento_fatura);
    for (const d of listaVisivel as any[]) {
      if (idsIgnoradosPorTotal.has(d.id) || d.economia_conquistada) continue;
      const parcelasVisiveis =
        filtroMes === "todos"
          ? (d.parcelas ?? [])
          : lancamentosDoFiltro.filter((p) => p.despesa_id === d.id);
      for (const p of parcelasVisiveis) {
        const casa = filtroResumo === "pago" ? !!p.paga : !p.paga;
        if (!casa) continue;
        if (filtroResumo === "proximo" && (!resumo.proximo || p.vencimento !== resumo.proximo.data))
          continue;
        itens.push({ despesa: d, parcela: p, valor: toBRL(Number(p.valor), d.moeda, cotacao) });
      }
    }
    return itens.sort((a, b) => String(a.parcela.vencimento).localeCompare(String(b.parcela.vencimento)));
  }, [filtroResumo, listaVisivel, idsIgnoradosPorTotal, filtroMes, lancamentosDoFiltro, resumo.proximo, cotacao, despesas, faturasMes, prefsCiclo.somar_pagamento_fatura]);
  const somaDoResumo = lancamentosDoResumo.reduce((s, i) => s + i.valor, 0);

  // Receitas do período, do mesmo jeito que a Home: pela data de recebimento e convertidas para BRL.
  // Igual à tela Receitas e ao Dashboard: inclui as receitas fixas projetadas para o mês.
  const receitaDoFiltro = useMemo(() => {
    const lancadas = filtroMes === "todos"
      ? (receitas as any[])
      : receitasPorCompetencias(receitas as any[], [filtroMes]);
    return lancadas.reduce((s, r) => s + toBRL(Number(r.valor) || 0, r.moeda ?? "BRL", cotacao), 0);
  }, [receitas, filtroMes, cotacao]);
  // Divisão justa (proposta duo-fi, 2026-11-02): os gastos "Casal / Compartilhado" do mês são divididos
  // na proporção da renda de cada pessoa no mesmo mês. Só aparece com um mês escolhido.
  const divisaoJusta = useMemo(() => {
    if (filtroMes === "todos") return null;
    const nossos = lancamentosDoFiltro.filter(
      (p: any) => p.despesa?.responsavel === RESPONSAVEIS_EXTRA && !p.despesa?.economia_conquistada,
    );
    const total = nossos.reduce((s: number, p: any) => s + toBRL(Number(p.valor) || 0, p.moeda ?? p.despesa?.moeda ?? "BRL", cotacao), 0);
    if (total <= 0) return null;
    const pessoas = (perfis as any[]).map((p) => p.nome as string).filter(Boolean);
    const recs = receitasPorCompetencias(receitas as any[], [filtroMes]);
    const rendaDe = (nome: string) =>
      recs.filter((r) => r.responsavel === nome).reduce((s, r) => s + toBRL(Number(r.valor) || 0, r.moeda ?? "BRL", cotacao), 0);
    const rendas = pessoas.map((nome) => ({ nome, renda: rendaDe(nome) }));
    const rendaTotal = rendas.reduce((s, x) => s + x.renda, 0);
    if (rendaTotal <= 0) return { total, linhas: [] as { nome: string; pct: number; valor: number }[] };
    return {
      total,
      linhas: rendas.map((x) => ({ nome: x.nome, pct: x.renda / rendaTotal, valor: total * (x.renda / rendaTotal) })),
    };
  }, [filtroMes, lancamentosDoFiltro, perfis, receitas, cotacao]);

  // O saldo só faz sentido com a lista completa do período; com filtros, a despesa mostrada é parcial.
  const semFiltrosDeLista =
    tab === "total" &&
    filtroCartao === "todos" &&
    filtroBanco === "todos" &&
    filtroCategoria === "todos" &&
    filtroResponsavel === "todos" &&
    filtroOrigem === "todos" &&
    !filtroEconomia &&
    !busca;

  // Bloco 6: sai da simulação sozinho ao trocar de aba/mês — os ids
  // excluídos de uma simulação não fazem sentido mais depois disso.
  useEffect(() => {
    setSimulandoCortes(false);
    setIdsExcluidosSimulacao(new Set());
    const o = origemCardRef.current;
    setFiltroResumo(o && o.mes === filtroMes ? o.filtro : null);
  }, [tab, filtroMes]);

  const filtroCardUrl = search.filtro;
  useEffect(() => {
    if (!filtroCardUrl) return;
    const mes = search.mes ?? competenciaAtual();
    origemCardRef.current = { filtro: filtroCardUrl, mes };
    setTab("total");
    setFiltroMes(mes);
    setFiltroResumo(filtroCardUrl);
    navigate({ search: (atual: any) => {
      const { filtro: _f, mes: _m, ...resto } = atual;
      return resto;
    }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCardUrl]);

  const simulacao = useMemo(() => {
    if (!simulandoCortes) return null;
    let economia = 0;
    for (const d of listaVisivel as any[]) {
      if (idsIgnoradosPorTotal.has(d.id)) continue;
      if (!idsExcluidosSimulacao.has(d.id)) continue;
      economia += toBRL(valorVisivel(d), d.moeda, cotacao);
    }
    return { totalSimulado: resumo.total - economia, economia };
  }, [simulandoCortes, listaVisivel, idsExcluidosSimulacao, idsIgnoradosPorTotal, cotacao, resumo.total]);

  /**
   * REGRA DE AGRUPAMENTO (copiar no app): lançamentos com cartao_id formam um grupo por cartão
   * (`cartao:<id>`). TODOS os lançamentos sem cartão (fixas/recorrentes manuais e os sem atribuição,
   * inclusive os do Open Finance) formam um único grupo "fora_cartao", rotulado
   * "Fora do cartão (recorrentes e sem atribuição)", para enxergar duplicados lado a lado.
   * Total e contagem do grupo somam os dois; grupos ordenados por total desc.
   * Ordenação opcional (valor/nome) é aplicada aos itens dentro de cada grupo; padrão = ordem original.
   */
  const gruposLista = useMemo(() => {
    if (modoLista === "lista")
      return [
        { key: "all", label: "", cor: "", banco: "", itens: listaVisivel as any[], total: resumo.total },
      ];
    const mapa = new Map<
      string,
      { key: string; label: string; cor: string; banco: string; itens: any[]; total: number }
    >();
    for (const d of listaVisivel as any[]) {
      const ehRecorrenteFora = !d.cartao_id && (d.tipo === "fixa" || d.tipo === "recorrente");
      const key = d.cartao_id ? `cartao:${d.cartao_id}` : "fora_cartao";
      const label = d.cartoes
        ? `${formatarNomeExibicao(d.cartoes.apelido || d.cartoes.bandeira || "Cartão")} •${d.cartoes.final ?? ""} · ${primeiroNome(d.cartoes.titular)}`
        : "Fora do cartão (recorrentes e sem atribuição)";
      // Recorrente fora do cartão: cor sólida, sem logo de banco nem ícone (pedido do usuário).
      // Sem cartão (recorrente fora ou sem atribuição): cor sólida e sem logo, para não parecer cartão de um banco.
      const semCartao = !d.cartao_id;
      const cor = semCartao ? "#94a3b8" : (d.cartoes?.cor ?? "var(--muted-foreground)");
      const banco = semCartao ? "" : String(d.bancos?.nome ?? d.banco_nome ?? d.cartoes?.apelido ?? "");
      const g = mapa.get(key) ?? { key, label, cor, banco, itens: [] as any[], total: 0 };
      g.itens.push(d);
      // Economia conquistada não soma no total do mês (mesma regra do cabeçalho e da previsão).
      if (!idsIgnoradosPorTotal.has(d.id) && !d.economia_conquistada) {
        g.total += toBRL(valorVisivel(d), d.moeda, cotacao);
      }
      mapa.set(key, g);
    }
    const arr = Array.from(mapa.values()).sort((a, b) => b.total - a.total);
    if (ordem !== "padrao") {
      const val = (d: any) => toBRL(valorVisivel(d), d.moeda, cotacao);
      const nome = (d: any) => String(d.descricao ?? "");
      const cmp: Record<string, (a: any, b: any) => number> = {
        valor_desc: (a, b) => val(b) - val(a),
        valor_asc: (a, b) => val(a) - val(b),
        nome_asc: (a, b) => nome(a).localeCompare(nome(b), "pt-BR", { sensitivity: "base" }),
        nome_desc: (a, b) => nome(b).localeCompare(nome(a), "pt-BR", { sensitivity: "base" }),
      };
      for (const g of arr) g.itens = [...g.itens].sort(cmp[ordem]);
    }
    return arr;
  }, [ordem, listaVisivel, modoLista, cotacao, resumo.total, filtroMes, lancamentoPorDespesa, idsIgnoradosPorTotal]);

  const chips = [
    filtroCartao !== "todos" && {
      label:
        filtroCartao === "recorrente_fora"
          ? "Recorrente fora do cartão"
          : filtroCartao === "sem"
          ? "Sem atribuição"
          : (() => {
              const c: any = cartoes.find((c: any) => c.id === filtroCartao);
              return c
                ? `Cartão ${c.apelido ?? c.bandeira} •${c.final} · ${primeiroNome(c.titular)}`
                : "Cartão";
            })(),
      clear: () => setFiltroCartao("todos"),
    },
    filtroBanco !== "todos" && {
      label: `Banco ${(bancos.find((b: any) => b.id === filtroBanco) as any)?.nome ?? ""}`,
      clear: () => setFiltroBanco("todos"),
    },
    filtroCategoria !== "todos" && {
      label: filtroCategoria,
      clear: () => setFiltroCategoria("todos"),
    },
    filtroResponsavel !== "todos" && {
      label: filtroResponsavel === "pessoais" ? "Pessoais" : filtroResponsavel,
      clear: () => setFiltroResponsavel("todos"),
    },
    filtroOrigem !== "todos" && {
      label: filtroOrigem === "diretos" ? "Lançamentos diretos" : "De fatura/importação",
      clear: () => setFiltroOrigem("todos"),
    },
    filtroEconomia && {
      label: "Economia conquistada",
      clear: () => setFiltroEconomia(false),
    },
    filtroMes !== "todos" && {
      label: monthLabelLong(filtroMes),
      clear: () => setFiltroMes("todos"),
    },
    !!busca && { label: `"${busca}"`, clear: () => setBusca("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  function limparFiltros() {
    setFiltroCartao("todos");
    setFiltroBanco("todos");
    setFiltroCategoria("todos");
    setFiltroResponsavel("todos");
    setFiltroOrigem("todos");
    setFiltroMes("todos");
    setFiltroEconomia(false);
    setBusca("");
  }

  return (
    <AppLayout
      title="Despesas"
      description={`${lista.length} lançamento(s) · ${formatar(resumo.total)}${cicloTexto}`}
      actions={
        <div className="flex items-center gap-2">
          {isSiteAdmin && (
            <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/pluggy" })}>
              <Landmark className="size-4" /> Open Finance
            </Button>
          )}
          {can("despesas", "editar") && (
            <>
            <FaturaMesDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Receipt className="size-4" /> Fatura do mês
                </Button>
              }
            />
            <Button size="sm" onClick={abrirNova} data-tour="nova-despesa">
              <Plus className="size-4" /> Nova
            </Button>
            </>
          )}
        </div>
      }
    >
      {divisaoJusta && (
        <Card className="mb-6">
          <CardContent className="space-y-2 p-4">
            <h2 className="text-base font-bold tracking-tight">Divisão justa do compartilhado</h2>
            <p className="text-sm text-muted-foreground">
              Gastos do grupo no mês: <b className="text-foreground">{formatar(divisaoJusta.total)}</b>. Cada um paga na
              proporção da renda do mês.
            </p>
            {divisaoJusta.linhas.length === 0 || divisaoJusta.linhas.every((l) => l.valor === 0) ? (
              <p className="text-sm text-muted-foreground">Cadastre as receitas de cada pessoa neste mês para calcular.</p>
            ) : (
              divisaoJusta.linhas.map((l) => (
                <div key={l.nome} className="flex items-center justify-between text-sm">
                  <span>{l.nome}</span>
                  <span className="font-semibold tabular-nums">
                    {Math.round(l.pct * 100)}% · {formatar(l.valor)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { filtro: "total" as const, label: "Total despesas", valor: formatar(resumo.total), cor: "text-destructive", hint: "" },
          { filtro: null, label: "Receitas", valor: formatar(receitaDoFiltro), cor: "text-success", hint: "" },
          {
            filtro: null,
            label: filtroMes !== "todos" ? textoVaiSobrar(numerosCiclo) : ROTULO_SOBRA_PREVISTA,
            valor: semFiltrosDeLista && filtroMes !== "todos" ? formatar(numerosCiclo.previsto.sobra) : "-",
            cor: numerosCiclo.previsto.sobra >= 0 ? "text-success" : "text-destructive",
            hint: semFiltrosDeLista && filtroMes !== "todos"
              ? textoPorDia(numerosCiclo, formatar)
              : "tire os filtros para ver a sobra",
          },
          { filtro: "pago" as const, label: "Pago", valor: formatar(resumo.pago), cor: "text-success", hint: "" },
          {
            filtro: "aberto" as const,
            label: "Em aberto",
            valor: formatar(resumo.aberto),
            cor: "text-destructive",
            hint: "",
          },
          {
            filtro: "proximo" as const,
            label: "Próximo vencimento",
            valor: resumo.proximo ? formatar(resumo.proximo.valor) : "-",
            cor: "text-warning",
            hint: resumo.proximo
              ? `${formatDate(resumo.proximo.data)} · fixas ${formatar(resumo.proximo.fixas)} · parcelados no cartão ${formatar(resumo.proximo.parcelados)}${resumo.proximo.outros > 0.004 ? ` · outros ${formatar(resumo.proximo.outros)}` : ""}`
              : "sem parcelas futuras",
          },
        ].map((k) => {
          const conteudo = (
            <>
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              {financasProntas ? (
                <p className={cn("mt-0.5 text-lg font-extrabold tabular-nums tracking-tight", k.cor)}>{k.valor}</p>
              ) : (
                <Skeleton className="mt-1 h-7 w-24" aria-label="Carregando" />
              )}
              {financasProntas && k.hint && <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>}
            </>
          );
          if (!k.filtro)
            return (
              <div key={k.label} className="rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
                {conteudo}
              </div>
            );
          const ativo = filtroResumo === k.filtro;
          return (
            <button
              key={k.label}
              type="button"
              aria-pressed={ativo}
              onClick={() =>
                setFiltroResumo(
                  k.filtro === "total" || ativo ? null : (k.filtro as "pago" | "aberto" | "proximo"),
                )
              }
              className={cn(
                "rounded-2xl border bg-card px-4 py-3 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                ativo && "ring-2 ring-primary",
              )}
            >
              {conteudo}
            </button>
          );
        })}
      </div>

      <BarraSoma
        qtd={soma.ids.size}
        total={(lista as any[])
          .filter((d) => soma.ids.has(d.id))
          .reduce((t, d) => t + toBRL(valorVisivel(d), d.moeda, cotacao), 0)}
        onLimpar={soma.limpar}
      />

      {/* Bloco 6 (plano-mega 2026-09-14): simular corte de despesas fixas —
          desmarcar itens aqui só recalcula o total na hora, nada é gravado
          no banco (estado local, reseta ao trocar de aba/mês ou sair). */}
      {tab === "fixa" && filtroMes !== "todos" && modoLista === "lista" && lista.length > 0 && (
        <div className="mb-6 space-y-3">
          <Button
            size="sm"
            variant={simulandoCortes ? "secondary" : "outline"}
            className="h-9 text-xs"
            onClick={() => setSimulandoCortes((v) => !v)}
          >
            <Calculator className="size-3.5" />
            {simulandoCortes ? "Sair da simulação" : "Simular cortes"}
          </Button>
          {simulandoCortes && simulacao && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Desmarque o que você cortaria. Nada é salvo.
              </span>
              <span className="font-semibold">
                Total simulado: {formatBRL(simulacao.totalSimulado)}
              </span>
              {simulacao.economia > 0 && (
                <span className="font-semibold text-success">
                  Economia: {formatBRL(simulacao.economia)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-primary" aria-hidden="true" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar despesa por descrição, categoria ou responsável"
            aria-label="Buscar despesas"
            className="h-12 border-primary/50 bg-card pl-11 pr-11 text-base shadow-sm focus-visible:border-primary"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="contents">
          {/* Ajuste mobile (otimização para celulares, 2026-09-27): abas,
              busca e selects de filtro ganham altura/toque maiores (~40-44px)
              — os h-9/py-1 anteriores ficavam abaixo do mínimo recomendado
              de toque confortável no dedo. Só nesta tela e em Receitas por
              ora (telas apontadas como as mais usadas no celular). */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="h-10">
              <TabsTrigger value="total" className="px-4 py-2 text-sm">
                Total
              </TabsTrigger>
              <TabsTrigger value="fixa" className="px-4 py-2 text-sm">
                Fixas
              </TabsTrigger>
              <TabsTrigger value="variavel" className="px-4 py-2 text-sm">
                Variáveis
              </TabsTrigger>
              {pixSaida?.disponivel && (
                <TabsTrigger value="pix" className="gap-1.5 px-4 py-2 text-sm">
                  PIX
                  {pixPendentes > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                      {pixPendentes}
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <Tabs value={modoLista} onValueChange={(v) => setModoLista(v as "lista" | "cartao")}>
            <TabsList className="h-10">
              <TabsTrigger value="lista" className="gap-1.5 px-4 py-2 text-sm">
                <ListIcon className="size-3.5" /> Lista
              </TabsTrigger>
              <TabsTrigger value="cartao" className="gap-1.5 px-4 py-2 text-sm">
                <CreditCard className="size-3.5" /> Por cartão
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Atalho Todos / Nossos / Pessoais (duo-fi, proposta 2026-11-02): "Nossos" é o compartilhado do grupo. */}
        <Tabs
          value={filtroResponsavel === RESPONSAVEIS_EXTRA ? "nossos" : filtroResponsavel === "pessoais" ? "pessoais" : "todos"}
          onValueChange={(v) =>
            setFiltroResponsavel(v === "nossos" ? RESPONSAVEIS_EXTRA : v === "pessoais" ? "pessoais" : "todos")
          }
        >
          <TabsList className="h-10">
            <TabsTrigger value="todos" className="px-4 py-2 text-sm">Todos</TabsTrigger>
            <TabsTrigger value="nossos" className="px-4 py-2 text-sm">Nossos</TabsTrigger>
            <TabsTrigger value="pessoais" className="px-4 py-2 text-sm">Pessoais</TabsTrigger>
          </TabsList>
        </Tabs>

        <NavegadorMes
          valor={filtroMes === "todos" ? null : filtroMes}
          onChange={setFiltroMes}
        />

        <div className="flex w-full flex-wrap items-center gap-3">
        <div className="contents">
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="h-9 w-auto min-w-[8.5rem] text-xs">
              <SelectValue placeholder="Cartão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cartões</SelectItem>
              <SelectItem value="recorrente_fora">Recorrente fora do cartão</SelectItem>
              <SelectItem value="sem">Sem atribuição</SelectItem>
              {cartoes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.apelido ?? c.bandeira} •{c.final} · {primeiroNome(c.titular)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroBanco} onValueChange={setFiltroBanco}>
            <SelectTrigger className="h-9 w-auto min-w-[8.5rem] text-xs">
              <SelectValue placeholder="Banco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bancos</SelectItem>
              {bancos.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SelectBusca
            className="h-9 w-auto min-w-[8.5rem] text-xs"
            ariaLabel="Filtrar por categoria"
            placeholder="Categoria"
            valor={filtroCategoria}
            opcoes={[
              { valor: "todos", rotulo: "Todas as categorias" },
              ...categorias.map((c: any) => ({ valor: c.nome as string, rotulo: c.nome as string })),
            ]}
            onEscolher={setFiltroCategoria}
          />
          <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
            <SelectTrigger className="h-9 w-auto min-w-[8.5rem] text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              <SelectItem value="pessoais">Só pessoais (sem o compartilhado)</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
            <SelectTrigger className="h-9 w-auto min-w-[8.5rem] text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Diretos e de fatura</SelectItem>
              <SelectItem value="diretos">Só lançamentos diretos</SelectItem>
              <SelectItem value="fatura">Só de fatura/importação</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="h-9 w-auto min-w-[8.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabelLong(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {chips.length > 0 && (
          <div className="contents">
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={c.clear}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                {c.label}
                <X className="size-3" />
              </button>
            ))}
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </div>
        )}
        </div>
      </div>

      {modoLista === "lista" &&
        filtroMes !== "todos" &&
        can("despesas", "editar") &&
        lista.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {tab === "total" ? "Todas" : tab === "fixa" ? "Fixas" : "Variáveis"} de{" "}
              {monthLabelLong(filtroMes)}:
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs"
              disabled={marcarLote.isPending || idsDoLote(lista, "abertas").length === 0}
              onClick={() => marcarLote.mutate({ ids: idsDoLote(lista, "abertas"), paga: true })}
            >
              <CheckCircle2 className="size-3.5" /> Marcar todas pagas
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs"
              disabled={marcarLote.isPending || idsDoLote(lista, "pagas").length === 0}
              onClick={() => marcarLote.mutate({ ids: idsDoLote(lista, "pagas"), paga: false })}
            >
              Desfazer todas
            </Button>
          </div>
        )}

      {tab === "pix" ? (
        <PixDespesas
          despesas={despesas as any[]}
          categorias={categorias as any[]}
          mes={filtroMes === "todos" ? null : filtroMes}
        />
      ) : filtroResumo ? (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {({ pago: "Pagos", aberto: "Em aberto", proximo: "Próximo vencimento", parcelas: "Parcelas do mês" } as const)[filtroResumo]}
                {" · "}
                {lancamentosDoResumo.length} lançamento(s) · <span className="font-semibold text-foreground">{formatar(somaDoResumo)}</span>
              </p>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFiltroResumo(null)}>
                Limpar filtro
              </Button>
            </div>
            {lancamentosDoResumo.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhum lançamento neste filtro.</p>
            ) : (
              <div className="divide-y">
                {lancamentosDoResumo.map(({ despesa: d, parcela: p, valor }) => (
                  <button
                    key={`${d.id}-${p.id ?? p.numero}`}
                    type="button"
                    onClick={() => abrirEdicao(d)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.vencimento)} ·{" "}
                        {d.cartoes
                          ? `${d.cartoes.apelido || d.cartoes.bandeira || "Cartão"} •${d.cartoes.final ?? ""}`
                          : "Sem cartão"}
                        {d.total_parcelas > 1 ? ` · parcela ${p.numero}/${d.total_parcelas}` : ""}
                      </p>
                    </div>
                    <Badge variant={p.paga ? "secondary" : "outline"} className="text-xs">
                      {p.paga ? "Paga" : "Em aberto"}
                    </Badge>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatar(valor)}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <TrendingDown className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">Nenhuma despesa por aqui.</p>
            {chips.length > 0 ? (
              <Button variant="outline" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            ) : (
              can("despesas", "editar") && (
                <Button onClick={abrirNova}>
                  <Plus className="size-4" /> Nova despesa
                </Button>
              )
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">Ordenar</span>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
              <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Ordenar lista">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Padrão</SelectItem>
                <SelectItem value="valor_desc">Valor: maior primeiro</SelectItem>
                <SelectItem value="valor_asc">Valor: menor primeiro</SelectItem>
                <SelectItem value="nome_asc">Nome: A a Z</SelectItem>
                <SelectItem value="nome_desc">Nome: Z a A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {gruposLista.map((grupo) => (
            <div key={grupo.key} className="overflow-hidden rounded-2xl border bg-card">
              {modoLista === "cartao" && (
                <div
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-center gap-3 border-b bg-muted/30 px-4 py-3 text-left native:flex-wrap native:gap-y-2"
                  onClick={() => setGrupoExpandido(grupoExpandido === grupo.key ? null : grupo.key)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    setGrupoExpandido(grupoExpandido === grupo.key ? null : grupo.key)
                  }
                >
                  {grupo.banco ? (
                    <IconeBanco nome={grupo.banco} className="size-8 rounded-lg" />
                  ) : grupo.key === "fora_cartao" ? (
                    <div className="size-8 shrink-0 rounded-lg" style={{ backgroundColor: grupo.cor }} />
                  ) : (
                    <div
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: grupo.cor }}
                    >
                      <CreditCard className="size-4 text-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{grupo.label}</p>
                    <Progress
                      value={resumo.total > 0 ? (grupo.total / resumo.total) * 100 : 0}
                      className="mt-1 h-1.5"
                      corIndicador={visualDoBanco(grupo.banco).conhecido ? visualDoBanco(grupo.banco).cor : grupo.cor}
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">{formatar(grupo.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      {grupo.itens.length} lançamento(s) ·{" "}
                      {resumo.total > 0 ? ((grupo.total / resumo.total) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                  {can("despesas", "editar") &&
                    filtroMes !== "todos" &&
                    idsDoLote(grupo.itens, "abertas").length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 text-xs native:order-last native:h-8 native:w-full"
                      disabled={
                        marcarLote.isPending || idsDoLote(grupo.itens, "abertas").length === 0
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        marcarLote.mutate({ ids: idsDoLote(grupo.itens, "abertas"), paga: true });
                      }}
                      aria-label="Marcar fatura importada como paga"
                    >
                      <CheckCircle2 className="size-3.5" /> Marcar fatura paga
                    </Button>
                  )}
                  {can("despesas", "editar") &&
                    filtroMes !== "todos" &&
                    idsDoLote(grupo.itens, "abertas").length === 0 &&
                    idsDoLote(grupo.itens, "pagas").length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0 text-xs native:order-last native:h-8 native:w-full"
                        disabled={marcarLote.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          marcarLote.mutate({ ids: idsDoLote(grupo.itens, "pagas"), paga: false });
                        }}
                        aria-label="Marcar fatura como não paga"
                      >
                        <RotateCcw className="size-3.5" /> Marcar como não paga
                      </Button>
                    )}
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      grupoExpandido === grupo.key && "rotate-180",
                    )}
                  />
                </div>
              )}
              {(modoLista !== "cartao" || grupoExpandido === grupo.key) && (
                <div className="divide-y">
                  <label className="flex cursor-pointer items-center gap-3 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={soma.todosMarcados(grupo.itens.map((d: any) => d.id))}
                      onCheckedChange={() => soma.alternarVarios(grupo.itens.map((d: any) => d.id))}
                      aria-label="Selecionar todos para somar"
                    />
                    Selecionar todos ({grupo.itens.length}) para somar
                  </label>
                  {grupo.itens.map((d: any) => {
                    const parcelas = [
                      ...(filtroMes === "todos"
                        ? (d.parcelas ?? [])
                        : lancamentosDoFiltro.filter((p) => p.despesa_id === d.id)),
                    ].sort((a: any, b: any) => a.numero - b.numero);
                    const totalPagas = (d.parcelas ?? []).filter((p: any) => p.paga).length;
                    const pDoMes = filtroMes === "todos" ? null : lancamentoPorDespesa.get(d.id);
                    const aberta = expandida === d.id;
                    const ignoradaNoMes = idsIgnoradosPorTotal.has(d.id);
                    const faturaAvulsa = (faturasMes as any[]).find(
                      (f) => f.despesa_avulsa_id === d.id,
                    );
                    const ehTotalManual = !!faturaAvulsa;
                    return (
                      <div key={d.id}>
                        <div
                          onClick={() => abrirEdicao(d)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 native:gap-2 native:active:bg-muted/50",
                            can("despesas", "editar") && "cursor-pointer",
                            (ignoradaNoMes ||
                              d.origem === "fatura_total_concluida" ||
                              d.economia_conquistada ||
                              (simulandoCortes && idsExcluidosSimulacao.has(d.id))) &&
                              "opacity-60 line-through bg-muted/20",
                          )}
                        >
                          <Checkbox
                            className="shrink-0"
                            checked={soma.ids.has(d.id)}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => soma.alternar(d.id)}
                            aria-label={`Somar ${d.descricao}`}
                          />
                          {simulandoCortes && tab === "fixa" && (
                            <Checkbox
                              className="shrink-0"
                              checked={!idsExcluidosSimulacao.has(d.id)}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={(checked) => {
                                setIdsExcluidosSimulacao((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.delete(d.id);
                                  else next.add(d.id);
                                  return next;
                                });
                              }}
                              aria-label={`Incluir ${d.descricao} na simulação`}
                            />
                          )}
                          <div
                            className="h-8 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: d.cartoes?.cor ?? "var(--muted-foreground)" }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-semibold leading-tight native:line-clamp-2 native:whitespace-normal">
                                {identificacaoDespesa(d, nomesContas) && (
                                  <span className="text-primary">{identificacaoDespesa(d, nomesContas)} · </span>
                                )}
                                {d.descricao}
                                {!!d.possivel_duplicidade && (
                                  <Badge variant="outline" className="ml-2 border-warning/40 align-middle text-xs text-warning-foreground dark:text-warning" title="Mesmo valor de um lançamento manual em outra data. Confira se não é duplicidade.">Possível duplicidade</Badge>
                                )}
                              </p>
                              {ignoradaNoMes && (
                                <Badge
                                  variant="outline"
                                  className="border-warning/30 text-xs text-warning-foreground dark:text-warning"
                                >
                                  Ignorado neste mês (total manual)
                                </Badge>
                              )}
                              {ehTotalManual && faturaAvulsa?.status === "aberta" && (
                                <Badge
                                  className="bg-warning text-xs text-warning-foreground hover:bg-warning/90"
                                  title="Veio do totalizador de fatura (Fatura do mês), não de lançamento item a item."
                                >
                                  Total manual ativo
                                  {faturaAvulsa.tipo_lancamento === "temporario" &&
                                    faturaAvulsa.data_limite &&
                                    ` · até ${monthLabelLong(competenciaDoDia(faturaAvulsa.data_limite))}`}
                                </Badge>
                              )}
                              {ehTotalManual &&
                                faturaAvulsa?.status === "aberta" &&
                                faturaAvulsa.tipo_lancamento === "temporario" &&
                                faturaAvulsa.data_limite &&
                                competenciaDoDia(faturaAvulsa.data_limite) < competenciaAtual() && (
                                  <Badge
                                    variant="outline"
                                    className="border-destructive/40 text-xs text-destructive"
                                  >
                                    Prazo do total vencido: detalhe item a item
                                  </Badge>
                                )}
                              {d.origem === "fatura_total_concluida" && (
                                <Badge variant="outline" className="text-xs">
                                  Total manual concluído
                                </Badge>
                              )}
                              {d.origem === "pluggy" && (
                                <Badge
                                  variant="outline"
                                  className="border-success/30 text-xs text-success"
                                >
                                  Open Finance
                                </Badge>
                              )}
                              {podeJuntarOF && d.origem === "pluggy" && (() => {
                                const sug = sugestaoOF(d);
                                const of = lancamentoOFDe(d);
                                if (!of) return null;
                                return (
                                  <>
                                    {sug && (
                                      <button
                                        type="button"
                                        title={`Parece ser ${sug.descricao}. Juntar?`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setJuntarOF(of);
                                        }}
                                      >
                                        <Badge variant="outline" className="border-amber-500/40 text-xs text-amber-600 dark:text-amber-400">
                                          Possível duplicado
                                        </Badge>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setJuntarOF(of);
                                      }}
                                    >
                                      Juntar com lançamento existente
                                    </button>
                                  </>
                                );
                              })()}
                              {d.origem && d.origem !== "manual" && d.origem !== "pluggy" && (
                                <Badge
                                  variant="outline"
                                  className="border-sky-500/30 text-xs text-sky-600 dark:text-sky-400"
                                >
                                  {d.origem.startsWith("fatura") ? "De fatura" : "Importado"}
                                </Badge>
                              )}
                              {d.economia_conquistada && (
                                <Badge
                                  variant="outline"
                                  className="border-success/30 text-xs text-success"
                                >
                                  Economia conquistada
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatDate(d.data_compra)} · {d.categoria}
                              {d.tipo === "fixa"
                                ? ` · ${filtroMes === "todos" ? "valor mensal" : monthLabelLong(filtroMes)}`
                                : d.total_parcelas > 1
                                  ? ` · ${d.total_parcelas}x de ${formatar(
                                      toBRL(
                                        Number(d.valor_total) / d.total_parcelas,
                                        d.moeda,
                                        cotacao,
                                      ),
                                    )}`
                                  : " · à vista"}
                            </p>
                          </div>
                          {d.tipo !== "fixa" && d.total_parcelas > 1 && (
                            <div className="hidden w-24 shrink-0 sm:block">
                              <Badge variant="secondary" className="text-xs">
                                {`${totalPagas}/${d.total_parcelas} pagas`}
                              </Badge>
                              <Progress
                                value={(totalPagas / d.total_parcelas) * 100}
                                className="mt-1 h-1"
                              />
                            </div>
                          )}

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold tabular-nums">
                              {formatar(toBRL(valorVisivel(d), d.moeda, cotacao))}
                            </p>
                            {d.moeda === "USD" && (
                              <p className="text-xs tabular-nums text-muted-foreground">
                                {formatUSD(Number(d.valor_total))}
                              </p>
                            )}
                          </div>
                          {/* No app: um único botão de ações, como em app nativo. */}
                          <div className="hidden shrink-0 native:block">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Ações de ${d.descricao}`}
                                >
                                  <EllipsisVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                {can("despesas", "editar") && (
                                  <DropdownMenuItem onSelect={() => abrirEdicao(d)}>
                                    <Pencil className="size-4" /> Editar
                                  </DropdownMenuItem>
                                )}
                                {can("despesas", "editar") && (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      moverTipo.mutate({
                                        id: d.id,
                                        tipo: d.tipo === "fixa" ? "variavel" : "fixa",
                                      })
                                    }
                                  >
                                    <ArrowLeftRight className="size-4" />
                                    {d.tipo === "fixa" ? "Mover para variável" : "Mover para fixa"}
                                  </DropdownMenuItem>
                                )}
                                {parcelas.length > 0 && (
                                  <DropdownMenuItem onSelect={() => setExpandida(aberta ? null : d.id)}>
                                    <ChevronDown className="size-4" />
                                    {aberta ? "Ocultar parcelas" : "Ver parcelas"}
                                  </DropdownMenuItem>
                                )}
                                {can("despesas", "excluir") && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => {
                                      if (d.tipo === "fixa" && !d.cartao_id) setDespesaFixaParaExcluir(d);
                                      else setDespesaParaExcluir(d);
                                    }}
                                  >
                                    <Trash2 className="size-4" /> Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex shrink-0 items-center native:hidden">
                            {can("despesas", "editar") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moverTipo.mutate({
                                    id: d.id,
                                    tipo: d.tipo === "fixa" ? "variavel" : "fixa",
                                  });
                                }}
                                title={
                                  d.tipo === "fixa" ? "Mover para variável" : "Mover para fixa"
                                }
                                aria-label={
                                  d.tipo === "fixa" ? "Mover para variável" : "Mover para fixa"
                                }
                              >
                                <ArrowLeftRight className="size-4" />
                              </Button>
                            )}
                            {can("despesas", "editar") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirEdicao(d);
                                }}
                                aria-label="Editar despesa"
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}

                            {parcelas.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandida(aberta ? null : d.id);
                                }}
                                aria-label="Ver parcelas"
                              >
                                <ChevronDown
                                  className={cn(
                                    "size-4 transition-transform",
                                    aberta && "rotate-180",
                                  )}
                                />
                              </Button>
                            )}
                            {can("despesas", "excluir") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (d.tipo === "fixa" && !d.cartao_id) setDespesaFixaParaExcluir(d);
                                  else setDespesaParaExcluir(d);
                                }}
                                aria-label="Excluir despesa"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {aberta && (
                          <div className="space-y-2 border-t bg-muted/20 px-3 py-2.5">
                            {d.tipo !== "fixa" && d.total_parcelas > 1 && (
                              <Progress
                                value={(totalPagas / d.total_parcelas) * 100}
                                className="h-1.5"
                              />
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              {parcelas.map((p: any) => (
                                <button
                                  key={p.id}
                                  onClick={() => togglePaga.mutate({ id: p.id, paga: !p.paga })}
                                  disabled={!can("despesas", "editar")}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium tabular-nums transition-colors",
                                    p.paga
                                      ? "border-success/30 bg-success/10 text-success"
                                      : "border-border bg-background text-muted-foreground hover:border-primary/40",
                                  )}
                                  title={`Vence em ${formatDate(p.vencimento)}`}
                                >
                                  {p.paga && <CheckCircle2 className="size-3" />}
                                  {d.tipo === "fixa"
                                    ? monthLabelLong(competenciaDoDia(p.vencimento))
                                    : `${p.numero}/${p.total}`}{" "}
                                  · {formatBRL(Number(p.valor))}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <JuntarLancamentoDialog
        of={juntarOF}
        lancamentos={juntarOF ? poolPorCompetencia(juntarOF.competencia) : []}
        onFechar={() => setJuntarOF(null)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar despesa" : `Nova despesa ${tab === "fixa" ? "fixa" : "variável"}`}
            </DialogTitle>
          </DialogHeader>
          {!editId && <PrimeiraCategoriaGuia tipo="despesa" />}

          {duplicata && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="size-4 text-warning" />
              <AlertTitle className="text-sm">Possível duplicidade</AlertTitle>
              <AlertDescription className="text-xs">
                Já existe “{duplicata.descricao}” de {formatBRL(Number(duplicata.valor_total))} em{" "}
                {formatDate(duplicata.data_compra)}. Clique em salvar novamente para confirmar mesmo
                assim.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição" className="sm:col-span-2">
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex.: Mercado do mês"
              />
            </Field>
            <Field label={ehFixa ? "Valor" : nParcelas > 1 && informarParcela ? "Valor da parcela" : nParcelas > 1 ? "Valor total" : "Valor"}>
              <Input
                inputMode="decimal"
                value={form.valor_total}
                onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                placeholder="0,00"
              />
              {valorDigitado > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {ehFixa
                    ? `${formatBRL(valorDigitado)} por mês`
                    : nParcelas > 1
                      ? `${nParcelas}x de ${formatBRL(previewParcela)}, total ${formatBRL(valorNum)}`
                      : ""}
                </p>
              )}
            </Field>
            {ehFixa ? (
              <Field label="Duração">
                <Select
                  value={form.recorrencia_duracao}
                  onValueChange={(v) => setForm({ ...form, recorrencia_duracao: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_prazo">Sem prazo</SelectItem>
                    <SelectItem value="prazo">Prazo determinado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            {ehFixa && !semPrazo && (
              <Field label="Repetir por (meses)">
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={form.recorrencia_meses}
                  onChange={(e) => setForm({ ...form, recorrencia_meses: e.target.value })}
                />
              </Field>
            )}

            <Field label="Moeda">
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ Real</SelectItem>
                  <SelectItem value="USD">US$ Dólar</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria">
              <CampoCategoria
                tipo="despesa"
                ariaLabel="Categoria da despesa"
                valor={form.categoria ?? ""}
                categorias={categorias.map((c: any) => ({ nome: String(c.nome), cor: c.cor ?? null }))}
                onChange={(v) => setForm({ ...form, categoria: v })}
              />
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data da compra">
              <Input
                type="date"
                value={form.data_compra}
                onChange={(e) => setForm({ ...form, data_compra: e.target.value })}
              />
            </Field>
            <Field label={contasDisponiveis.length ? "Conta ou cartão" : "Forma de pagamento"}>
              <Select
                value={form.pagamento}
                onValueChange={(v) => setForm({ ...form, pagamento: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={contasDisponiveis.length ? "Conta ou cartão" : "Cartão ou banco"} />
                </SelectTrigger>
                <SelectContent>
                  {contasDisponiveis.length > 0 ? (
                    <>
                      <SelectGroup>
                        <SelectLabel>Contas</SelectLabel>
                        {contasDisponiveis.map(({ conta }) => (
                          <SelectItem key={conta.id} value={`conta:${conta.id}`}>
                            {conta.nome}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {cartoes.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Cartões</SelectLabel>
                          {cartoes.map((c: any) => (
                            <SelectItem key={c.id} value={`cartao:${c.id}`}>
                              {c.apelido ?? c.bandeira} •{c.final} · {primeiroNome(c.titular)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {bancos.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Bancos</SelectLabel>
                          {bancos.map((b: any) => (
                            <SelectItem key={b.id} value={`banco:${b.id}`}>
                              {b.nome} (conta)
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </>
                  ) : (
                    <>
                      {cartoes.map((c: any) => (
                        <SelectItem key={c.id} value={`cartao:${c.id}`}>
                          {c.apelido ?? c.bandeira} •{c.final} · {primeiroNome(c.titular)}
                        </SelectItem>
                      ))}
                      {bancos.map((b: any) => (
                        <SelectItem key={b.id} value={`banco:${b.id}`}>
                          {b.nome} (conta)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </Field>
            {!ehFixa && (
              <Field label="Número de parcelas *">
                <Input
                  type="number"
                  min={1}
                  value={form.total_parcelas}
                  onChange={(e) => setForm({ ...form, total_parcelas: e.target.value })}
                />
              </Field>
            )}
            {!ehFixa && nParcelas > 1 && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-3 py-2 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Informar valor da parcela</p>
                  <p className="text-xs text-muted-foreground">
                    {informarParcela
                      ? "O valor digitado é o de cada parcela. O total é parcela x parcelas."
                      : "O valor digitado é o total da compra, dividido nas parcelas."}
                  </p>
                </div>
                <Switch
                  checked={informarParcela}
                  onCheckedChange={(v) => setForm({ ...form, informar_parcela: v })}
                  aria-label="Informar valor da parcela"
                />
              </div>
            )}
            {!ehFixa && nParcelas > 1 && (
              <Field label="Parcela atual / Já pagas">
                <Input
                  type="number"
                  min={1}
                  max={nParcelas}
                  value={form.parcela_atual ?? "1"}
                  onChange={(e) => setForm({ ...form, parcela_atual: e.target.value })}
                />
              </Field>
            )}
            <Field label={ehFixa ? "Data de início" : "Data da 1ª parcela"}>
              <Input
                type="date"
                value={form.data_primeira_parcela}
                onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })}
              />
            </Field>
            {ehFixa && (
              <Field label="Reajuste" className="sm:col-span-2">
                <Select
                  value={form.reajuste_tipo}
                  onValueChange={(v) => setForm({ ...form, reajuste_tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem reajuste</SelectItem>
                    <SelectItem value="composto">Reajuste composto periódico</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {ehFixa && form.reajuste_tipo === "composto" && (
              <>
                {/* Ordem pedida em 24/10: índice primeiro; ao escolher índice e periodicidade o % é buscado sozinho. */}
                <Field label="Índice" className="sm:col-span-2">
                  <IndiceReajusteField
                    indice={form.reajuste_indice}
                    onIndiceChange={(v) => setForm((f: any) => ({ ...f, reajuste_indice: v }))}
                    periodicidade={form.reajuste_periodicidade as Periodicidade}
                    onValorBuscado={(percentual) =>
                      setForm((f: any) => ({
                        ...f,
                        reajuste_percentual: String(percentual).replace(".", ","),
                      }))
                    }
                    onMediaMensalBuscada={(percentual) =>
                      setForm((f: any) => ({
                        ...f,
                        reajuste_periodicidade: "mensal",
                        reajuste_percentual: String(percentual).replace(".", ","),
                      }))
                    }
                  />
                </Field>
                <Field label="Periodicidade">
                  <Select
                    value={form.reajuste_periodicidade}
                    onValueChange={(v) => setForm((f: any) => ({ ...f, reajuste_periodicidade: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODICIDADES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Percentual (%)">
                  <Input
                    inputMode="decimal"
                    placeholder="Preenchido pelo índice, ou digite"
                    value={form.reajuste_percentual}
                    onChange={(e) => setForm({ ...form, reajuste_percentual: e.target.value })}
                  />
                </Field>
                <Field label="1º reajuste em">
                  <Input
                    type="date"
                    value={form.reajuste_inicio}
                    onChange={(e) => setForm({ ...form, reajuste_inicio: e.target.value })}
                  />
                </Field>
              </>
            )}
            <Field label="Responsável">
              <Select
                value={form.responsavel}
                onValueChange={(v) => setForm({ ...form, responsavel: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!tagsPendentes && (
              <Field label="Tags" className="sm:col-span-2">
                <SeletorTags valor={tagsForm} onChange={setTagsForm} />
              </Field>
            )}
            <Field label="Observações" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2 rounded-lg border border-success/20 bg-success/5 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-success cursor-pointer">
                <Checkbox
                  checked={!!form.economia_conquistada}
                  onCheckedChange={(v) => setForm({ ...form, economia_conquistada: !!v })}
                />
                Economia conquistada
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Marque se negociou ou cancelou a cobrança. Ela fica riscada no histórico.
              </p>
            </div>
          </div>

          {valorDigitado > 0 && (ehFixa || nParcelas > 1) && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {ehFixa
                ? `${formatBRL(valorDigitado)} por mês a partir de ${monthLabelLong(competenciaDe(form.data_primeira_parcela || form.data_compra))}` +
                  (semPrazo
                    ? ", sem prazo."
                    : ` até ${monthLabelLong(ultimaCompetencia?.competencia ?? "")} (${mesesPrazo} meses).`) +
                  (recorrencia?.reajuste
                    ? ` Reajuste ${recorrencia.reajuste.periodicidade} de ${recorrencia.reajuste.percentual}%${recorrencia.reajuste.indice ? ` (${recorrencia.reajuste.indice})` : ""}. Último mês projetado: ${formatBRL(ultimaCompetencia?.valor ?? valorDigitado)}.`
                    : "")
                : `${nParcelas}x de ${formatBRL(previewParcela)}, total ${formatBRL(valorNum)}.`}
            </p>
          )}

          <DialogFooter className="gap-2">
            {!editId && (
              <Button variant="outline" onClick={() => tentarSalvar(true)} disabled={salvar.isPending}>
                Salvar e adicionar outro
              </Button>
            )}
            <Button onClick={() => tentarSalvar()} disabled={salvar.isPending}>
              {duplicata ? "Salvar mesmo assim" : editId ? "Salvar alterações" : "Salvar despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!despesaParaExcluir}
        onOpenChange={(v) => !v && setDespesaParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {despesaParaExcluir &&
              (faturasMes as any[]).some((f) => f.despesa_avulsa_id === despesaParaExcluir.id)
                ? "Excluir lançamento de total da fatura?"
                : "Excluir despesa?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {despesaParaExcluir &&
              (faturasMes as any[]).some((f) => f.despesa_avulsa_id === despesaParaExcluir.id)
                ? "Os lançamentos normais do cartão voltarão a ser considerados e somados no mês."
                : `Tem certeza que deseja excluir "${despesaParaExcluir?.descricao}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (despesaParaExcluir) {
                  void executarExclusaoComUndo(despesaParaExcluir);
                  setDespesaParaExcluir(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcluirRecorrenteDialog
        aberto={!!despesaFixaParaExcluir}
        onFechar={() => setDespesaFixaParaExcluir(null)}
        descricao={despesaFixaParaExcluir?.descricao ?? ""}
        competencia={competenciaFiltrada}
        onConfirmar={async (modo) => {
          const alvo = despesaFixaParaExcluir;
          setDespesaFixaParaExcluir(null);
          if (!alvo) return;
          try {
            await excluirDespesaSerie(supabase, alvo.id, competenciaFiltrada, modo);
            toast.success("Despesa excluída");
            qc.invalidateQueries();
          } catch (e: any) {
            toast.error(e?.message ?? "Erro ao excluir despesa");
          }
        }}
      />
    </AppLayout>
  );
}
