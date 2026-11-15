import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Repeat, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/useAuthData";
import { useCartoes, useDespesas, useReceitas } from "@/hooks/useFinance";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Lançamentos (15/11/2026): uma tela só para achar, editar e excluir entradas e gastos, igual à aba
 * Lançamentos do app. Busca por descrição, valor ou data; filtros; seleção de vários; Desfazer por 5 s.
 * Receitas e Despesas continuam no menu com as telas completas.
 */
export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({ meta: [{ title: "Lançamentos | Control ALL" }] }),
  component: LancamentosPage,
});

type Filtro = "todos" | "entradas" | "gastos" | "fixas" | "cartao";
const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "entradas", rotulo: "Entradas" },
  { id: "gastos", rotulo: "Gastos" },
  { id: "fixas", rotulo: "Contas fixas" },
  { id: "cartao", rotulo: "Cartão" },
];

type Item = {
  chave: string;
  id: string;
  tipo: "despesa" | "receita";
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  cartao: string | null;
  fixa: boolean;
};

// Exclusão com Desfazer: a remoção espera 5 s fora do componente, então vale mesmo se a pessoa sair da tela.
const pendentes = new Map<string, ReturnType<typeof setTimeout>>();

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dataBR = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

function LancamentosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const { data: despesas = [] } = useDespesas();
  const { data: receitas = [] } = useReceitas();
  const { data: cartoes = [] } = useCartoes();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [escondidos, setEscondidos] = useState<Set<string>>(new Set());

  const nomeCartao = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cartoes as any[]) m.set(c.id, c.apelido || [c.bandeira, c.final].filter(Boolean).join(" ") || "Cartão");
    return m;
  }, [cartoes]);

  const itens = useMemo<Item[]>(() => {
    const lista: Item[] = [];
    for (const d of despesas as any[]) {
      lista.push({
        chave: `d:${d.id}`,
        id: d.id,
        tipo: "despesa",
        descricao: d.descricao || d.estabelecimento || "Gasto",
        valor: Number(d.valor_total) || 0,
        data: d.data_compra ?? "",
        categoria: d.categoria ?? "",
        cartao: d.cartao_id ? nomeCartao.get(d.cartao_id) ?? "Cartão" : null,
        fixa: d.tipo === "fixa" || !!d.recorrencia_inicio,
      });
    }
    for (const r of receitas as any[]) {
      lista.push({
        chave: `r:${r.id}`,
        id: r.id,
        tipo: "receita",
        descricao: r.descricao || "Entrada",
        valor: Number(r.valor) || 0,
        data: r.data_recebimento ?? "",
        categoria: r.categoria ?? "",
        cartao: null,
        fixa: !!r.recorrente,
      });
    }
    return lista.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }, [despesas, receitas, nomeCartao]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    const termoNum = busca.replace(/[^\d,]/g, "").replace(",", ".");
    return itens.filter((i) => {
      if (escondidos.has(i.chave)) return false;
      if (filtro === "entradas" && i.tipo !== "receita") return false;
      if (filtro === "gastos" && i.tipo !== "despesa") return false;
      if (filtro === "fixas" && !i.fixa) return false;
      if (filtro === "cartao" && !i.cartao) return false;
      if (!termo) return true;
      return (
        semAcento(`${i.descricao} ${i.categoria} ${i.cartao ?? ""}`).includes(termo) ||
        dataBR(i.data).includes(busca.trim()) ||
        (!!termoNum && i.valor.toFixed(2).includes(termoNum))
      );
    });
  }, [itens, busca, filtro, escondidos]);

  const podeExcluir = (i: Item) => can(i.tipo === "despesa" ? "despesas" : "receitas", "excluir");

  function alternar(chave: string) {
    setSelecao((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  }

  function editar(i: Item) {
    if (i.tipo === "despesa") void navigate({ to: "/despesas", search: { editar: i.id } as never });
    else void navigate({ to: "/receitas", search: { editar: i.id } as never });
  }

  function excluir(lista: Item[]) {
    const permitidos = lista.filter(podeExcluir);
    if (permitidos.length === 0) {
      toast.error("Você não tem permissão para excluir estes lançamentos.");
      return;
    }
    if (permitidos.length > 1 && !window.confirm(`Excluir ${permitidos.length} lançamentos?`)) return;
    const chaves = permitidos.map((i) => i.chave);
    const lote = chaves.join("|");
    setEscondidos((s) => new Set([...s, ...chaves]));
    setSelecao(new Set());
    pendentes.set(
      lote,
      setTimeout(async () => {
        pendentes.delete(lote);
        const idsD = permitidos.filter((i) => i.tipo === "despesa").map((i) => i.id);
        const idsR = permitidos.filter((i) => i.tipo === "receita").map((i) => i.id);
        const erros: string[] = [];
        if (idsD.length) {
          const { error } = await supabase.from("despesas").delete().in("id", idsD);
          if (error) erros.push(error.message);
        }
        if (idsR.length) {
          const { error } = await supabase.from("receitas").delete().in("id", idsR);
          if (error) erros.push(error.message);
        }
        if (erros.length) toast.error(`Não foi possível excluir: ${erros[0]}`);
        void qc.invalidateQueries();
      }, 5000),
    );
    toast.success(permitidos.length === 1 ? "Lançamento excluído" : `${permitidos.length} lançamentos excluídos`, {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          const t = pendentes.get(lote);
          if (t) clearTimeout(t);
          pendentes.delete(lote);
          setEscondidos((s) => {
            const n = new Set(s);
            for (const c of chaves) n.delete(c);
            return n;
          });
        },
      },
    });
  }

  const selecionados = visiveis.filter((i) => selecao.has(i.chave));
  const todosMarcados = visiveis.length > 0 && selecionados.length === visiveis.length;

  return (
    <AppLayout title="Lançamentos" description="Ache, edite ou exclua entradas e gastos">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, valor ou data"
            aria-label="Buscar lançamentos"
            className="h-12 w-full rounded-2xl border bg-card pl-11 pr-11 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {busca && (
            <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
                filtro === f.id ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
          <label className="flex min-h-10 cursor-pointer items-center gap-3">
            <Checkbox
              checked={todosMarcados}
              onCheckedChange={(v) => setSelecao(v ? new Set(visiveis.map((i) => i.chave)) : new Set())}
              aria-label="Selecionar todos"
            />
            Selecionar todos
          </label>
          <span>{visiveis.length} {visiveis.length === 1 ? "registro" : "registros"}</span>
        </div>

        <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl border border-border/60 bg-card">
          {visiveis.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Nada encontrado.</li>}
          {visiveis.slice(0, 400).map((i) => (
            <li key={i.chave} className="flex items-center gap-3 px-4 py-3">
              <Checkbox checked={selecao.has(i.chave)} onCheckedChange={() => alternar(i.chave)} aria-label={`Selecionar ${i.descricao}`} />
              <button type="button" onClick={() => editar(i)} className="min-w-0 flex-1 text-left" aria-label={`Editar ${i.descricao}`}>
                <span className="flex items-center gap-1.5 truncate font-semibold">
                  {i.descricao}
                  {i.fixa && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Repete todo mês" />}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[dataBR(i.data), i.tipo === "receita" ? "Entrada" : "Gasto", i.categoria, i.cartao].filter(Boolean).join(" · ")}
                </span>
              </button>
              <span className={cn("shrink-0 font-bold tabular-nums", i.tipo === "receita" ? "text-success" : "text-foreground")}>
                {i.tipo === "receita" ? "+ " : "− "}
                {formatBRL(i.valor).replace("-", "")}
              </span>
              {podeExcluir(i) && (
                <button type="button" onClick={() => excluir([i])} aria-label={`Excluir ${i.descricao}`} className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {visiveis.length > 400 && <p className="text-center text-xs text-muted-foreground">Mostrando 400 de {visiveis.length}. Use a busca para achar o resto.</p>}

        {selecionados.length > 0 && (
          <div className="sticky bottom-24 z-20 lg:bottom-6">
            <Button variant="destructive" className="h-12 w-full rounded-2xl text-base font-bold" onClick={() => excluir(selecionados)}>
              Excluir selecionados ({selecionados.length})
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
