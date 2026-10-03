import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Apple,
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Gamepad2,
  HelpCircle,
  MoreVertical,
  Plus,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Sofa,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { appSupabase } from "@/integrations/supabase/app-types";
import { usePermissoes, useProfile, useSession } from "@/hooks/useAuthData";
import { useDespesas, useFaturasMes, useProfilesList, useReceitas } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { addMonths, formatDate, formatBRL, monthKey, toBRL, toISODate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/lista-compras")({
  head: () => ({
    meta: [
      { title: "Lista de compras — Control ALL" },
      {
        name: "description",
        content:
          "Lista de compras compartilhada do casal com datas, alertas de recompra, itens únicos e exportação.",
      },
      { property: "og:title", content: "Lista de compras — Control ALL" },
      {
        property: "og:description",
        content: "Adicione, marque, repita e exporte os itens que o casal precisa comprar.",
      },
    ],
  }),
  component: ListaComprasPage,
});

const CATEGORIAS = [
  { id: "alimentacao", label: "Alimentação", icon: Apple },
  { id: "bens_duraveis", label: "Bens duráveis", icon: Sofa },
  { id: "diversao", label: "Diversão", icon: Gamepad2 },
  { id: "outros", label: "Outros", icon: Sparkles },
] as const;

type CategoriaId = (typeof CATEGORIAS)[number]["id"];

const LIMITE = 2000;

function categoriaLabel(id: string) {
  return CATEGORIAS.find((c) => c.id === id)?.label ?? id;
}

function ListaComprasPage() {
  const { exclusaoBloqueada } = usePermissoes();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: meuPerfil } = useProfile();
  const { data: profiles = [] } = useProfilesList();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const cotacao = useCotacao();

  const [lista, setLista] = useState<"compras" | "unicos">("compras");
  const [filtro, setFiltro] = useState<CategoriaId | "todas">("todas");
  const [filtroHorizonte, setFiltroHorizonte] = useState<"todos" | "imediato" | "longo_prazo">("todos");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaId>("alimentacao");
  const [quantidade, setQuantidade] = useState("1");
  const [valorEstimadoInput, setValorEstimadoInput] = useState("");
  const [horizonte, setHorizonte] = useState<"imediato" | "longo_prazo">("imediato");
  const [alertaEm, setAlertaEm] = useState("");
  const [aprovacoesNecessarias, setAprovacoesNecessarias] = useState("0");
  const [observacao, setObservacao] = useState("");
  const [linkCompra, setLinkCompra] = useState("");

  // Aprovação só faz sentido se houver alguém além de quem cria o item pra
  // aprovar — com 1 pessoa com acesso, o máximo selecionável é 0 (ninguém
  // pra aprovar); com 2, até 1; e assim por diante.
  const pessoasComAcesso = useMemo(() => (profiles as any[]).filter((p) => p.ativo), [profiles]);
  const maxAprovacoes = Math.max(0, pessoasComAcesso.length - 1);

  const mesAtualKey = useMemo(() => monthKey(new Date()), []);

  // Gamificação financeira exclusiva do Control ALL baseada na renda líquida real e sobra livre
  const finCalculado = useMemo(() => {
    // 1. Receitas líquidas do mês corrente
    const receitasDoMes = (receitas as any[]).filter(
      (r) => monthKey(r.data_recebimento) === mesAtualKey,
    );
    const totalReceitaLiquida = receitasDoMes.reduce((acc, r) => {
      const val = Number(r.valor_liquido ?? r.valor ?? 0);
      return acc + toBRL(val, r.moeda, cotacao);
    }, 0);

    // 2. Despesas já comprometidas do mês (fixas + variáveis + faturas)
    const despesasComp = lancamentosPorCompetencias(despesas as any[], [mesAtualKey]);
    const parcelasComRegras = aplicarRegrasFaturaMes(despesasComp, faturasMes as any[]);
    const totalComprometido = parcelasComRegras.reduce((acc, p) => {
      return acc + toBRL(Number(p.valor), p.despesa?.moeda ?? "BRL", cotacao);
    }, 0);

    // 3. Sobra livre real (o que resta da renda líquida)
    const sobraLivre = Math.max(0, totalReceitaLiquida - totalComprometido);

    // 4. Jornada mensal de trabalho do perfil (default: 160h)
    const horasTrabalho = Number((meuPerfil as any)?.horas_trabalho_mes) || 160;
    const valorHora = totalReceitaLiquida > 0 ? totalReceitaLiquida / horasTrabalho : 0;
    const valorMinuto = valorHora / 60;

    return {
      mesAtualKey,
      totalReceitaLiquida,
      totalComprometido,
      sobraLivre,
      horasTrabalho,
      valorHora,
      valorMinuto,
    };
  }, [receitas, despesas, faturasMes, mesAtualKey, cotacao, meuPerfil]);

  const calcularImpacto = (valor: number) => {
    if (!valor || valor <= 0) return null;
    const { valorHora, sobraLivre } = finCalculado;
    const horas = valorHora > 0 ? valor / valorHora : 0;
    const minutosTotais = Math.round(horas * 60);
    const h = Math.floor(minutosTotais / 60);
    const m = minutosTotais % 60;
    let tempoFormatado = "";
    if (h > 0 && m > 0) tempoFormatado = `${h}h ${m}min`;
    else if (h > 0) tempoFormatado = `${h}h`;
    else tempoFormatado = `${Math.max(1, m)}min`;

    const percentualSobra =
      sobraLivre > 0 ? Math.round((valor / sobraLivre) * 100) : null;

    return {
      horas,
      minutosTotais,
      tempoFormatado,
      percentualSobra,
      excedeSobra: sobraLivre <= 0 || (percentualSobra !== null && percentualSobra > 100),
    };
  };

  const { data: itens = [] } = useQuery({
    queryKey: ["lista-compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("*")
        .order("comprado")
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (error) throw error;
      return data ?? [];
    },
  });

  const daLista = useMemo(
    () =>
      itens.filter((i) => {
        const itemAny = i as any;
        const bateLista = (i.lista ?? "compras") === lista;
        const bateCategoria = filtro === "todas" || i.categoria === filtro;
        const bateHorizonte =
          filtroHorizonte === "todos" || (itemAny.horizonte ?? "imediato") === filtroHorizonte;
        return bateLista && bateCategoria && bateHorizonte;
      }),
    [itens, lista, filtro, filtroHorizonte],
  );
  const pendentes = daLista.filter((i) => !i.comprado);
  const comprados = daLista.filter((i) => i.comprado);

  const totalEstimadoPendentes = useMemo(() => {
    return pendentes.reduce(
      (acc, item) => acc + (Number((item as any).valor_estimado) || 0) * (item.quantidade || 1),
      0,
    );
  }, [pendentes]);

  const hoje = toISODate(new Date());
  const alertasVencidos = itens.filter((i) => i.alerta_em && i.alerta_em <= hoje);

  const adicionar = useMutation({
    mutationFn: async () => {
      const texto = nome.trim();
      if (texto.length < 2) throw new Error("Informe o nome do item");
      if (itens.length >= LIMITE) throw new Error(`Limite de ${LIMITE} itens atingido`);
      const { data: auth } = await supabase.auth.getUser();
      const valorNum = valorEstimadoInput ? Number(valorEstimadoInput.replace(",", ".")) : null;

      const { error } = await (appSupabase.from("lista_compras") as any).insert({
        nome: texto,
        categoria,
        lista,
        quantidade: Math.max(1, Number(quantidade) || 1),
        valor_estimado: valorNum && !isNaN(valorNum) && valorNum > 0 ? valorNum : null,
        horizonte,
        alerta_em: alertaEm || null,
        aprovacoes_necessarias: Math.min(
          maxAprovacoes,
          Math.max(0, Number(aprovacoesNecessarias) || 0),
        ),
        created_by: auth.user?.id ?? null,
        observacao: observacao.trim() || null,
        links: linkCompra.trim() ? [{ url: linkCompra.trim(), tipo: "referencia" }] : [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      setQuantidade("1");
      setValorEstimadoInput("");
      setHorizonte("imediato");
      setAlertaEm("");
      setAprovacoesNecessarias("0");
      setObservacao("");
      setLinkCompra("");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: async (item: any) => {
      if (!item.comprado) {
        const necessarias = item.aprovacoes_necessarias ?? 0;
        const aprovados = (item.aprovado_por ?? []).length;
        if (necessarias > 0 && aprovados < necessarias) {
          throw new Error(
            `Faltam ${necessarias - aprovados} aprovação(ões) para comprar "${item.nome}"`,
          );
        }
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("lista_compras")
        .update({
          comprado: !item.comprado,
          comprado_em: !item.comprado ? new Date().toISOString() : null,
          comprado_por: !item.comprado ? (auth.user?.id ?? null) : null,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Qualquer pessoa com acesso pode aprovar, exceto quem criou o item —
  // aprovar de novo remove a própria aprovação (alternância).
  const aprovar = useMutation({
    mutationFn: async (item: any) => {
      if (!user?.id) throw new Error("Sessão inválida");
      const atuais: string[] = item.aprovado_por ?? [];
      const jaAprovou = atuais.includes(user.id);
      const novaLista = jaAprovou ? atuais.filter((id) => id !== user.id) : [...atuais, user.id];
      const { error } = await appSupabase
        .from("lista_compras")
        .update({ aprovado_por: novaLista })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const repetir = useMutation({
    mutationFn: async (item: any) => {
      const { data: auth } = await supabase.auth.getUser();
      const proximo = toISODate(addMonths(new Date(), 1));
      const { error } = await (supabase.from("lista_compras") as any).insert({
        nome: item.nome,
        categoria: item.categoria,
        lista: item.lista ?? "compras",
        quantidade: item.quantidade,
        observacao: item.observacao,
        links: item.links ?? [],
        alerta_em: proximo,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item repetido para o próximo mês");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const definirAlerta = useMutation({
    mutationFn: async ({ item, dias }: { item: any; dias: number }) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      const { error } = await supabase
        .from("lista_compras")
        .update({ alerta_em: toISODate(d) })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta definido");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async (item: any) => {
      const destino = (item.lista ?? "compras") === "compras" ? "unicos" : "compras";
      const { error } = await supabase
        .from("lista_compras")
        .update({ lista: destino })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      if (exclusaoBloqueada) throw new Error("Seu perfil não possui permissão para excluir dados.");
      const { error } = await supabase.from("lista_compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const limparComprados = useMutation({
    mutationFn: async () => {
      if (exclusaoBloqueada) throw new Error("Seu perfil não possui permissão para excluir dados.");
      const ids = comprados.map((i) => i.id);
      if (!ids.length) return;
      const { error } = await supabase.from("lista_compras").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  function exportar() {
    const linhas = [
      ["Lista", "Item", "Categoria", "Qtd", "Solicitado em", "Concluído em", "Alerta em", "Status"],
      ...itens.map((i) => [
        (i.lista ?? "compras") === "compras" ? "Compras" : "Itens únicos",
        i.nome,
        categoriaLabel(i.categoria),
        String(i.quantidade),
        i.created_at ? formatDate(i.created_at) : "",
        i.comprado_em ? formatDate(i.comprado_em) : "",
        i.alerta_em ? formatDate(i.alerta_em) : "",
        i.comprado ? "Concluído" : "Pendente",
      ]),
    ];
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-compras-${toISODate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Linha = ({ item }: { item: any }) => {
    const alerta = item.alerta_em && item.alerta_em <= hoje;
    const necessarias: number = item.aprovacoes_necessarias ?? 0;
    const aprovadores: string[] = item.aprovado_por ?? [];
    const faltam = Math.max(0, necessarias - aprovadores.length);
    const souCriador = !!user?.id && item.created_by === user.id;
    const jaAprovei = !!user?.id && aprovadores.includes(user.id);
    const bloqueadoPorAprovacao = necessarias > 0 && faltam > 0 && !item.comprado;

    const valorTotalItem = (Number(item.valor_estimado) || 0) * (item.quantidade || 1);
    const impacto = valorTotalItem > 0 ? calcularImpacto(valorTotalItem) : null;
    const isLongoPrazo = (item.horizonte ?? "imediato") === "longo_prazo";

    return (
      <div className="flex items-start gap-3 px-3 py-3">
        <Checkbox
          checked={item.comprado}
          onCheckedChange={() => alternar.mutate(item)}
          disabled={bloqueadoPorAprovacao}
          title={bloqueadoPorAprovacao ? `Faltam ${faltam} aprovação(ões)` : undefined}
          aria-label={`Marcar ${item.nome}`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              className={`text-sm font-medium ${item.comprado ? "text-muted-foreground line-through" : ""}`}
            >
              {item.nome}
              {item.quantidade > 1 && (
                <span className="text-muted-foreground"> · {item.quantidade} un.</span>
              )}
            </p>

            {valorTotalItem > 0 && (
              <Badge variant="outline" className="font-semibold text-xs text-foreground">
                {formatBRL(valorTotalItem)}
              </Badge>
            )}

            <Badge
              variant="outline"
              className={
                isLongoPrazo
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-700 text-[10px]"
                  : "border-border text-[10px] text-muted-foreground"
              }
            >
              {isLongoPrazo ? "Longo Prazo" : "Imediato"}
            </Badge>

            {impacto && (
              <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                <Clock className="size-3 text-primary" />
                {impacto.tempoFormatado} de trabalho
              </Badge>
            )}
          </div>

          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {categoriaLabel(item.categoria)} · pedido em{" "}
            {item.created_at ? formatDate(item.created_at) : "—"}
            {item.comprado_em && ` · concluído em ${formatDate(item.comprado_em)}`}
          </p>

          {item.alerta_em && (
            <p
              className={`mt-0.5 inline-flex items-center gap-1 text-xs ${alerta ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
              <BellRing className="size-3" /> Alerta em {formatDate(item.alerta_em)}
            </p>
          )}

          {item.observacao && <p className="mt-1 text-xs text-muted-foreground">{item.observacao}</p>}

          {Array.isArray(item.links) && item.links.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {item.links.map((link: any, index: number) => (
                <a
                  key={`${link.url}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline"
                >
                  Ver link{item.links.length > 1 ? ` ${index + 1}` : ""}
                </a>
              ))}
            </div>
          )}

          {/* Gamificação: Box de Impacto na Renda e Aprovação/Decisão */}
          {impacto && !item.comprado && (
            <div className="mt-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    ⏱ Para comprar este item são necessários{" "}
                    <span className="font-bold text-primary">{impacto.tempoFormatado}</span> do mês.
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    {impacto.percentualSobra !== null ? (
                      <>
                        Como só usamos o que sobra da renda já comprometida (sobra de{" "}
                        {formatBRL(finCalculado.sobraLivre)}), isso consome{" "}
                        <span
                          className={`font-semibold ${
                            impacto.excedeSobra ? "text-destructive font-bold" : "text-foreground"
                          }`}
                        >
                          {impacto.percentualSobra}%
                        </span>{" "}
                        do que está sobrando este mês. Deseja aprovar e seguir?
                      </>
                    ) : (
                      <>
                        Sua renda deste mês já está 100% comprometida por despesas e faturas. Esta compra exigirá reservas ou reorganização de orçamento.
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => alternar.mutate(item)}
                    disabled={bloqueadoPorAprovacao}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Aprovar e seguir
                  </Button>
                </div>
              </div>
            </div>
          )}

          {necessarias > 0 && !item.comprado && (
            <div className="mt-2 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={
                  faltam > 0 ? "border-warning/40 text-warning" : "border-success/40 text-success"
                }
              >
                <ShieldCheck className="size-3" />
                {aprovadores.length}/{necessarias} aprovações necessárias
              </Badge>
              {!souCriador && (
                <Button
                  size="sm"
                  variant={jaAprovei ? "outline" : "default"}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => aprovar.mutate(item)}
                >
                  <CheckCircle2 className="size-3" />
                  {jaAprovei ? "Remover minha aprovação" : "Aprovar"}
                </Button>
              )}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Ações do item">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={bloqueadoPorAprovacao}
              onClick={() => alternar.mutate(item)}
            >
              {item.comprado ? "Reabrir item" : "Marcar como concluído"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => repetir.mutate(item)}>
              <Repeat className="size-4" /> Repetir no próximo mês
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => definirAlerta.mutate({ item, dias: 30 })}>
              <BellRing className="size-4" /> Lembrar em 30 dias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => definirAlerta.mutate({ item, dias: 90 })}>
              <BellRing className="size-4" /> Lembrar em 90 dias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => mover.mutate(item)}>
              Mover para{" "}
              {(item.lista ?? "compras") === "compras" ? "itens únicos" : "lista de compras"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => excluir.mutate(item.id)}>
              <Trash2 className="size-4" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <AppLayout
      title="Lista de compras"
      description={`${itens.length}/${LIMITE} itens registrados · Gamificação e Poder de Compra`}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportar}>
            <Download className="size-4" /> Exportar
          </Button>
          {comprados.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => limparComprados.mutate()}>
              Limpar concluídos
            </Button>
          )}
        </div>
      }
    >
      {/* Card de Gamificação Financeira: Valor da Hora Líquida e Sobra Livre Real */}
      <Card className="mb-5 overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <Flame className="size-3.5" /> Gamificação Financeira
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Competência: {finCalculado.mesAtualKey}
                </span>
              </div>
              <h3 className="text-base font-semibold tracking-tight">
                Seu Tempo de Trabalho Líquido & Poder de Compra
              </h3>
              <p className="text-xs text-muted-foreground">
                Baseado na sua receita líquida real deste mês ({formatBRL(finCalculado.totalReceitaLiquida)})
                e jornada de {finCalculado.horasTrabalho}h/mês configurada no seu perfil.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-3 shadow-xs">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3 text-primary" /> Hora Líquida
                </span>
                <p className="text-base font-bold text-foreground">
                  {finCalculado.valorHora > 0 ? formatBRL(finCalculado.valorHora) : "R$ 0,00"}
                  <span className="text-[10px] font-normal text-muted-foreground">/h</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  ≈ {finCalculado.valorMinuto > 0 ? formatBRL(finCalculado.valorMinuto) : "R$ 0,00"}/min
                </p>
              </div>

              <div className="rounded-xl border bg-card p-3 shadow-xs">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Wallet className="size-3 text-success" /> Sobra Livre Real
                </span>
                <p className="text-base font-bold text-success">
                  {formatBRL(finCalculado.sobraLivre)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Comprometido: {formatBRL(finCalculado.totalComprometido)}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-xl border bg-card p-3 shadow-xs">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShoppingCart className="size-3 text-primary" /> Na Lista
                </span>
                <p className="text-base font-bold text-foreground">
                  {formatBRL(totalEstimadoPendentes)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {pendentes.length} pendente(s)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {alertasVencidos.length > 0 && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-3">
            <BellRing className="mt-0.5 size-4 text-destructive" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-destructive">
                {alertasVencidos.length} alerta(s) no prazo
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {alertasVencidos.map((i) => i.nome).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={lista} onValueChange={(v) => setLista(v as "compras" | "unicos")}>
        <TabsList className="h-9">
          <TabsTrigger value="compras" className="text-xs">
            Lista de compras
          </TabsTrigger>
          <TabsTrigger value="unicos" className="text-xs">
            Itens únicos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <form
        className="mt-4 space-y-2.5 rounded-xl border bg-card p-3.5 shadow-xs"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar.mutate();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_90px_130px_140px_auto]">
          <div>
            <Label className="sr-only">Item</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do item (ex.: Arroz, Tênis, Furadeira…)"
            />
          </div>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaId)}>
            <SelectTrigger aria-label="Categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            inputMode="numeric"
            placeholder="Qtd"
            aria-label="Quantidade"
          />
          <Input
            value={valorEstimadoInput}
            onChange={(e) => setValorEstimadoInput(e.target.value)}
            inputMode="decimal"
            placeholder="Valor R$ un."
            aria-label="Valor estimado"
          />
          <Select value={horizonte} onValueChange={(v) => setHorizonte(v as any)}>
            <SelectTrigger aria-label="Horizonte">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="imediato">Imediato (Mês)</SelectItem>
              <SelectItem value="longo_prazo">Longo Prazo</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={adicionar.isPending}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>

        {/* Prévia em tempo real da gamificação ao digitar valor estimado */}
        {(() => {
          const valNum = Number(valorEstimadoInput.replace(",", ".")) * (Number(quantidade) || 1);
          const impacto = calcularImpacto(valNum);
          if (!impacto) return null;
          return (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary font-medium">
              <Clock className="size-4 shrink-0" />
              <span>
                Custo de trabalho estimado: <strong>{impacto.tempoFormatado}</strong>
                {impacto.percentualSobra !== null && (
                  <>
                    {" "}
                    · Consome <strong>{impacto.percentualSobra}%</strong> da sua sobra livre no mês (restam {formatBRL(finCalculado.sobraLivre)})
                  </>
                )}
              </span>
            </div>
          );
        })()}

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
          <Input
            value={linkCompra}
            onChange={(e) => setLinkCompra(e.target.value)}
            type="url"
            placeholder="Link de compra ou referência (Instagram, TikTok, Amazon...)"
          />
          <Input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação para quem vai aprovar"
          />
          <Input
            type="date"
            value={alertaEm}
            onChange={(e) => setAlertaEm(e.target.value)}
            aria-label="Alertar em"
            title="Alertar em"
          />
          {maxAprovacoes >= 1 && (
            <Select value={aprovacoesNecessarias} onValueChange={setAprovacoesNecessarias}>
              <SelectTrigger className="w-36" aria-label="Aprovações necessárias">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem aprovação</SelectItem>
                {Array.from({ length: maxAprovacoes }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} aprovação(ões)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </form>

      {/* Barra de Filtros: Horizonte e Categorias */}
      <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-card/60 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Horizonte:</span>
          <Button
            size="sm"
            variant={filtroHorizonte === "todos" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFiltroHorizonte("todos")}
          >
            Todos os prazos
          </Button>
          <Button
            size="sm"
            variant={filtroHorizonte === "imediato" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFiltroHorizonte("imediato")}
          >
            Imediatos (Consumo do mês)
          </Button>
          <Button
            size="sm"
            variant={filtroHorizonte === "longo_prazo" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFiltroHorizonte("longo_prazo")}
          >
            Longo Prazo (Desejos / Projetos)
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Categoria:</span>
          <Button
            size="sm"
            variant={filtro === "todas" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFiltro("todas")}
          >
            Todas
          </Button>
          {CATEGORIAS.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={filtro === c.id ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFiltro(c.id)}
            >
              <c.icon className="size-3.5 mr-1" /> {c.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {daLista.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ShoppingCart className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum item aqui ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendentes.length > 0 && (
              <div className="divide-y overflow-hidden rounded-xl border bg-card">
                {pendentes.map((i) => (
                  <Linha key={i.id} item={i} />
                ))}
              </div>
            )}
            {comprados.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">
                  Concluídos ({comprados.length})
                </p>
                <div className="divide-y overflow-hidden rounded-xl border bg-card">
                  {comprados.map((i) => (
                    <Linha key={i.id} item={i} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
