import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Receipt,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCartoes, useDespesas, useFaturasMes } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { usePersistedState } from "@/hooks/usePersistedState";
import { aplicarRegrasFaturaMes } from "@/lib/fatura-mes";
import { lancamentosPorCompetencias } from "@/lib/recorrencia";
import { formatBRL, formatDate, monthKey, monthLabelLong, toBRL, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Control ALL" },
      {
        name: "description",
        content:
          "Calendário com faturas a vencer, notas fiscais lançadas, fim de garantias e itens aprovados da lista de compras.",
      },
    ],
  }),
  component: CalendarioPage,
});

type Tipo = "fatura" | "nota" | "garantia" | "lista";

type Evento = {
  id: string;
  tipo: Tipo;
  data: string; // YYYY-MM-DD
  titulo: string;
  valor?: number | undefined;
  detalhe?: string | undefined;
  ref?: any;
};

const TIPOS: Record<Tipo, { rotulo: string; cor: string; ponto: string; icone: typeof CreditCard }> = {
  fatura: {
    rotulo: "Faturas",
    cor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    ponto: "bg-amber-500",
    icone: CreditCard,
  },
  nota: {
    rotulo: "Notas fiscais",
    cor: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    ponto: "bg-sky-500",
    icone: Receipt,
  },
  garantia: {
    rotulo: "Fim de garantia",
    cor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    ponto: "bg-rose-500",
    icone: ShieldCheck,
  },
  lista: {
    rotulo: "Lista aprovada",
    cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    ponto: "bg-emerald-500",
    icone: ShoppingCart,
  },
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ultimoDiaDoMes(chave: string): number {
  const [a, m] = chave.split("-").map(Number);
  return new Date(a!, m!, 0).getDate();
}

function somarMes(chave: string, delta: number): string {
  const [a, m] = chave.split("-").map(Number);
  return monthKey(new Date(a!, m! - 1 + delta, 1));
}

function CalendarioPage() {
  const qc = useQueryClient();
  const cotacao = useCotacao();
  const hojeISO = toISODate(new Date());
  const [mes, setMes] = useState(monthKey(new Date()));
  const [diaSel, setDiaSel] = useState<string>(hojeISO);
  const [ativos, setAtivos] = usePersistedState<Tipo[]>("calendario.filtros", [
    "fatura",
    "nota",
    "garantia",
    "lista",
  ]);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [visao, setVisao] = useState<"mes" | "ano">("mes");

  const { data: despesas = [] } = useDespesas();
  const { data: faturasMes = [] } = useFaturasMes();
  const { data: cartoes = [] } = useCartoes();

  const { data: notas = [] } = useQuery({
    queryKey: ["calendario-notas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("id,estabelecimento,descricao,data_compra,garantia_fim,valor_total");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: listaItens = [] } = useQuery({
    queryKey: ["calendario-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("id,nome,quantidade,valor_estimado,alerta_em,updated_at,comprado,aprovacoes_necessarias,aprovado_por");
      if (error) throw error;
      return data ?? [];
    },
  });

  const gerarEventos = (mes: string): Evento[] => {
    const out: Evento[] = [];
    // Faturas do mês: soma por cartão, vencendo no dia de vencimento do cartão.
    const lanc = aplicarRegrasFaturaMes(
      lancamentosPorCompetencias(despesas as any[], [mes]),
      faturasMes as any[],
    );
    const porCartao = new Map<string, any[]>();
    for (const l of lanc as any[]) {
      const cid = l.despesa?.cartao_id;
      if (!cid) continue;
      if (!porCartao.has(cid)) porCartao.set(cid, []);
      porCartao.get(cid)!.push(l);
    }
    for (const [cid, itens] of porCartao) {
      const c = (cartoes as any[]).find((x) => x.id === cid);
      if (!c) continue;
      const dia = Math.min(Number(c.dia_vencimento) || 10, ultimoDiaDoMes(mes));
      const total = itens.reduce(
        (t, l) => t + toBRL(Number(l.valor), l.moeda ?? l.despesa?.moeda ?? "BRL", cotacao),
        0,
      );
      const paga = itens.every((l) => l.paga);
      out.push({
        id: `fatura:${cid}:${mes}`,
        tipo: "fatura",
        data: `${mes}-${String(dia).padStart(2, "0")}`,
        titulo: `Fatura ${c.apelido || c.titular || "cartão"}${c.final ? ` •${c.final}` : ""}`,
        valor: total,
        detalhe: `${itens.length} lançamento(s)${paga ? " · paga" : ""}`,
        ref: { cartao: c, itens },
      });
    }
    for (const n of notas as any[]) {
      if (n.data_compra && n.data_compra.slice(0, 7) === mes) {
        out.push({
          id: `nota:${n.id}`,
          tipo: "nota",
          data: n.data_compra,
          titulo: `Nota: ${n.estabelecimento || n.descricao || "compra"}`,
          valor: Number(n.valor_total) || 0,
          ref: n,
        });
      }
      if (n.garantia_fim && n.garantia_fim.slice(0, 7) === mes) {
        out.push({
          id: `garantia:${n.id}`,
          tipo: "garantia",
          data: n.garantia_fim,
          titulo: `Garantia termina: ${n.estabelecimento || n.descricao || "compra"}`,
          valor: Number(n.valor_total) || 0,
          ref: n,
        });
      }
    }
    for (const it of listaItens as any[]) {
      const nec = Number(it.aprovacoes_necessarias) || 0;
      const aprov = (it.aprovado_por ?? []).length;
      if (it.comprado || nec <= 0 || aprov < nec) continue;
      const data = it.alerta_em || String(it.updated_at ?? "").slice(0, 10);
      if (!data || data.slice(0, 7) !== mes) continue;
      out.push({
        id: `lista:${it.id}`,
        tipo: "lista",
        data,
        titulo: `Aprovado: ${it.nome}${it.quantidade > 1 ? ` (x${it.quantidade})` : ""}`,
        valor: it.valor_estimado != null ? Number(it.valor_estimado) : undefined,
        detalhe: "Item aprovado da lista de compras",
        ref: it,
      });
    }
    return out;
  };

  const ano = mes.slice(0, 4);
  const eventosAno = useMemo(
    () => Array.from({ length: 12 }, (_, i) => gerarEventos(`${ano}-${String(i + 1).padStart(2, "0")}`)).flat(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [despesas, faturasMes, cartoes, notas, listaItens, ano, cotacao],
  );

  const visiveis = eventosAno.filter((e) => ativos.includes(e.tipo));
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of visiveis) {
      if (!m.has(e.data)) m.set(e.data, []);
      m.get(e.data)!.push(e);
    }
    return m;
  }, [visiveis]);

  const celulas = useMemo(() => {
    const [a, m] = mes.split("-").map(Number);
    const primeiro = new Date(a!, m! - 1, 1).getDay();
    const dias = ultimoDiaDoMes(mes);
    const arr: (string | null)[] = Array(primeiro).fill(null);
    for (let d = 1; d <= dias; d++) arr.push(`${mes}-${String(d).padStart(2, "0")}`);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [mes]);

  const eventosDoDia = porDia.get(diaSel) ?? [];
  const totalFaturasMes = visiveis
    .filter((e) => e.tipo === "fatura" && e.data.slice(0, 7) === mes)
    .reduce((t, e) => t + (e.valor ?? 0), 0);

  function irParaMes(novo: string) {
    setMes(novo);
    const hoje = monthKey(new Date());
    setDiaSel(novo === hoje ? hojeISO : `${novo}-01`);
  }

  function alternarTipo(t: Tipo) {
    setAtivos((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  }

  return (
    <AppLayout
      title="Calendário"
      description="Faturas, notas fiscais, garantias e lista de compras em um só lugar"
    >
      <div className="mb-3 inline-flex rounded-xl border bg-muted/40 p-1" role="group" aria-label="Tipo de visão">
        {(["mes", "ano"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisao(v)}
            aria-pressed={visao === v}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              visao === v ? "bg-background text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            {v === "mes" ? "Mês" : "Ano (12 meses)"}
          </button>
        ))}
      </div>

      {visao === "ano" && (
        <div className="mb-3 flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => irParaMes(somarMes(mes, -12))} aria-label="Ano anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-20 text-center text-base font-semibold">{ano}</h2>
          <Button variant="outline" size="icon" onClick={() => irParaMes(somarMes(mes, 12))} aria-label="Próximo ano">
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">Toque num mês para abrir, ou num dia para ver o que tem nele.</span>
        </div>
      )}

      <div className={cn("mb-3 flex flex-wrap items-center gap-2", visao === "ano" && "hidden")}>
        <Button variant="outline" size="icon" onClick={() => irParaMes(somarMes(mes, -1))} aria-label="Mês anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-44 text-center text-base font-semibold capitalize">
          {monthLabelLong(mes)}
        </h2>
        <Button variant="outline" size="icon" onClick={() => irParaMes(somarMes(mes, 1))} aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => irParaMes(monthKey(new Date()))}>
          Hoje
        </Button>
        <Input
          type="month"
          value={mes}
          onChange={(e) => e.target.value && irParaMes(e.target.value)}
          className="ml-auto h-9 w-40"
          aria-label="Ir para o mês"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(TIPOS) as Tipo[]).map((t) => {
          const on = ativos.includes(t);
          const I = TIPOS[t].icone;
          return (
            <button
              key={t}
              type="button"
              onClick={() => alternarTipo(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity",
                TIPOS[t].cor,
                !on && "opacity-40",
              )}
              aria-pressed={on}
            >
              <I className="size-3.5" /> {TIPOS[t].rotulo}
            </button>
          );
        })}
        {totalFaturasMes > 0 && (
          <span className="ml-auto self-center text-xs text-muted-foreground">
            Faturas do mês: <strong className="text-foreground">{formatBRL(totalFaturasMes)}</strong>
          </span>
        )}
      </div>

      {visao === "ano" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => {
            const chave = `${ano}-${String(i + 1).padStart(2, "0")}`;
            const [a, m] = chave.split("-").map(Number);
            const primeiro = new Date(a!, m! - 1, 1).getDay();
            const dias = ultimoDiaDoMes(chave);
            const cels: (string | null)[] = Array(primeiro).fill(null);
            for (let d = 1; d <= dias; d++) cels.push(`${chave}-${String(d).padStart(2, "0")}`);
            const qtd = visiveis.filter((e) => e.data.slice(0, 7) === chave).length;
            return (
              <Card key={chave} className={cn(chave === monthKey(new Date()) && "border-primary")}>
                <CardContent className="p-3">
                  <button
                    type="button"
                    onClick={() => {
                      irParaMes(chave);
                      setVisao("mes");
                    }}
                    className="mb-2 flex w-full items-center justify-between text-left"
                  >
                    <span className="text-sm font-semibold capitalize">
                      {new Date(a!, m! - 1, 1).toLocaleDateString("pt-BR", { month: "long" })}
                    </span>
                    {qtd > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {qtd} evento{qtd > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
                    {DIAS_SEMANA.map((d) => (
                      <div key={d}>{d[0]}</div>
                    ))}
                    {cels.map((dia, k) => {
                      if (!dia) return <div key={`v${k}`} />;
                      const evs = porDia.get(dia) ?? [];
                      const tipos = Array.from(new Set(evs.map((e) => e.tipo)));
                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => {
                            setMes(chave);
                            setDiaSel(dia);
                            setVisao("mes");
                          }}
                          className={cn(
                            "flex h-8 flex-col items-center justify-center rounded text-[11px] hover:bg-muted",
                            dia === hojeISO && "bg-primary/10 font-bold text-primary",
                          )}
                          aria-label={`${formatDate(dia)}${evs.length ? `, ${evs.length} evento(s)` : ""}`}
                        >
                          {Number(dia.slice(8, 10))}
                          <span className="flex h-1.5 gap-px">
                            {tipos.slice(0, 3).map((t) => (
                              <span key={t} className={cn("size-1 rounded-full", TIPOS[t].ponto)} />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className={cn(visao === "ano" && "hidden")}>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((dia, i) => {
              if (!dia) return <div key={`v${i}`} className="min-h-14 rounded-md bg-muted/20 sm:min-h-24" />;
              const evs = porDia.get(dia) ?? [];
              const ehHoje = dia === hojeISO;
              const sel = dia === diaSel;
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => setDiaSel(dia)}
                  className={cn(
                    "flex min-h-14 flex-col items-stretch gap-0.5 rounded-md border p-1 text-left transition-colors hover:bg-muted/50 sm:min-h-24",
                    sel && "border-primary ring-1 ring-primary",
                    ehHoje && "bg-primary/10",
                  )}
                >
                  <span className={cn("text-xs font-semibold", ehHoje && "text-primary")}>
                    {Number(dia.slice(8, 10))}
                  </span>
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {evs.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn("truncate rounded border px-1 py-px text-[10px]", TIPOS[e.tipo].cor)}
                        title={e.titulo}
                      >
                        {e.titulo}
                      </span>
                    ))}
                    {evs.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{evs.length - 3} mais</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {evs.slice(0, 4).map((e) => (
                      <span key={e.id} className={cn("size-1.5 rounded-full", TIPOS[e.tipo].ponto)} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className={cn("mt-4", visao === "ano" && "hidden")}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4" /> {formatDate(diaSel)}
        </h3>
        {eventosDoDia.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nada registrado neste dia.
          </p>
        ) : (
          <div className="space-y-2">
            {eventosDoDia.map((e) => {
              const I = TIPOS[e.tipo].icone;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEditando(e)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:opacity-90",
                    TIPOS[e.tipo].cor,
                  )}
                >
                  <I className="size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.titulo}</p>
                    {e.detalhe && <p className="truncate text-[11px] opacity-80">{e.detalhe}</p>}
                  </div>
                  {e.valor != null && (
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatBRL(e.valor)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <EditarEventoDialog
        evento={editando}
        onClose={() => setEditando(null)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["calendario-notas"] });
          void qc.invalidateQueries({ queryKey: ["calendario-lista"] });
          void qc.invalidateQueries({ queryKey: ["lista-compras"] });
          void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("notas") });
          setEditando(null);
        }}
      />
    </AppLayout>
  );
}

function EditarEventoDialog({
  evento,
  onClose,
  onSaved,
}: {
  evento: Evento | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dataCompra, setDataCompra] = useState("");
  const [garantiaFim, setGarantiaFim] = useState("");
  const [valor, setValor] = useState("");
  const [alerta, setAlerta] = useState("");
  const [chave, setChave] = useState<string | null>(null);

  // Reinicia os campos quando abre outro evento.
  if (evento && chave !== evento.id) {
    setChave(evento.id);
    setDataCompra(evento.ref?.data_compra ?? "");
    setGarantiaFim(evento.ref?.garantia_fim ?? "");
    setValor(evento.ref?.valor_total != null ? String(evento.ref.valor_total).replace(".", ",") : "");
    setAlerta(evento.ref?.alerta_em ?? "");
  }
  if (!evento && chave !== null) setChave(null);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!evento) return;
      if (evento.tipo === "nota" || evento.tipo === "garantia") {
        const v = Number(valor.replace(/\./g, "").replace(",", "."));
        const { error } = await supabase
          .from("notas_fiscais")
          .update({
            data_compra: dataCompra || evento.ref.data_compra,
            garantia_fim: garantiaFim || null,
            valor_total: Number.isFinite(v) ? v : evento.ref.valor_total,
          })
          .eq("id", evento.ref.id);
        if (error) throw error;
      } else if (evento.tipo === "lista") {
        const { error } = await supabase
          .from("lista_compras")
          .update({ alerta_em: alerta || null })
          .eq("id", evento.ref.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Lançamento atualizado.");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar."),
  });

  const marcarComprado = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lista_compras")
        .update({ comprado: true, comprado_em: new Date().toISOString() })
        .eq("id", evento!.ref.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item marcado como comprado.");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar."),
  });

  return (
    <Dialog open={!!evento} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {evento && (
          <>
            <DialogHeader>
              <DialogTitle>{evento.titulo}</DialogTitle>
              <DialogDescription>
                {formatDate(evento.data)}
                {evento.valor != null ? ` · ${formatBRL(evento.valor)}` : ""}
              </DialogDescription>
            </DialogHeader>

            {evento.tipo === "fatura" && (
              <div className="space-y-2">
                <div className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
                  {(evento.ref.itens as any[]).map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="truncate">{l.despesa?.descricao}</span>
                      <span className="shrink-0 tabular-nums">{formatBRL(Number(l.valor))}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Para editar lançamentos ou o dia de vencimento do cartão, use as telas abaixo.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/despesas">Abrir Despesas</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/cartoes">Abrir Cartões</Link>
                  </Button>
                </div>
              </div>
            )}

            {(evento.tipo === "nota" || evento.tipo === "garantia") && (
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Data da compra</Label>
                  <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim da garantia</Label>
                  <Input type="date" value={garantiaFim} onChange={(e) => setGarantiaFim(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor total (R$)</Label>
                  <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
              </div>
            )}

            {evento.tipo === "lista" && (
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Data prevista da compra</Label>
                  <Input type="date" value={alerta} onChange={(e) => setAlerta(e.target.value)} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => marcarComprado.mutate()}
                  disabled={marcarComprado.isPending}
                >
                  Marcar como comprado
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              {evento.tipo !== "fatura" && (
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  Salvar
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
