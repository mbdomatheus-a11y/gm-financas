import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Bell,
  CalendarClock,
  CreditCard,
  Gauge,
  Landmark,
  Mail,
  MailOpen,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { cn } from "@/lib/utils";

/**
 * Caixa de avisos (08/11/2026), espelho da tela Avisos do app (src/app/mais/avisos.tsx).
 * Agrupada por Hoje, Ontem, Esta semana e Antes; não lidas em destaque; no hover: marcar como
 * lida/não lida, arquivar e excluir (com desfazer por alguns segundos). Filtro "Arquivadas".
 */
type Aviso = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  criado_em: string;
  lida_em: string | null;
  arquivada_em?: string | null;
  destino?: string | null;
};

const ICONES: Record<string, { icone: LucideIcon; cor: string }> = {
  fatura: { icone: CreditCard, cor: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
  parcela: { icone: CalendarClock, cor: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  garantia: { icone: ShieldCheck, cor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  limite: { icone: Gauge, cor: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
  open_finance: { icone: Landmark, cor: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  convite: { icone: UserPlus, cor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300" },
  regra_ciclo: { icone: RefreshCw, cor: "bg-teal-500/15 text-teal-600 dark:text-teal-300" },
};
const ICONE_PADRAO = { icone: Bell, cor: "bg-muted text-muted-foreground" };

/** Rota do site por tipo (o destino gravado é a rota do app). */
const ROTA_SITE: Record<string, string> = {
  fatura: "/cartoes",
  parcela: "/despesas",
  garantia: "/notas",
  limite: "/limites",
  open_finance: "/pluggy",
  convite: "/compartilhar",
  regra_ciclo: "/configuracoes",
};

export function grupoDaData(iso: string, agora = new Date()): "Hoje" | "Ontem" | "Esta semana" | "Antes" {
  const d = new Date(iso);
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const t = d.getTime();
  if (t >= inicioHoje) return "Hoje";
  if (t >= inicioHoje - 86400000) return "Ontem";
  if (t >= inicioHoje - 6 * 86400000) return "Esta semana";
  return "Antes";
}
const ORDEM = ["Hoje", "Ontem", "Esta semana", "Antes"] as const;

function horaCurta(iso: string) {
  const d = new Date(iso);
  const g = grupoDaData(iso);
  if (g === "Hoje" || g === "Ontem") return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const db = () => supabase as any;

export function CaixaAvisos() {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<"todas" | "nao_lidas" | "arquivadas">("todas");
  const [escondidos, setEscondidos] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const chave = ["caixa-avisos", user?.id, filtro];

  const { data: lista = [], isLoading, error } = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    queryFn: async (): Promise<Aviso[]> => {
      let q = db()
        .from("notificacoes_usuario")
        .select("id,tipo,titulo,mensagem,criado_em,lida_em,arquivada_em,destino")
        .eq("user_id", user!.id)
        .order("criado_em", { ascending: false })
        .limit(200);
      q = filtro === "arquivadas" ? q.not("arquivada_em", "is", null) : q.is("arquivada_em", null);
      if (filtro === "nao_lidas") q = q.is("lida_em", null);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const grupos = useMemo(() => {
    const m = new Map<string, Aviso[]>();
    for (const a of lista.filter((x) => !escondidos.includes(x.id))) {
      const g = grupoDaData(a.criado_em);
      m.set(g, [...(m.get(g) ?? []), a]);
    }
    return ORDEM.filter((g) => m.has(g)).map((g) => ({ titulo: g, itens: m.get(g)! }));
  }, [lista, escondidos]);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["caixa-avisos", user?.id] });

  async function atualizar(id: string, campos: Record<string, unknown>) {
    const { error } = await db().from("notificacoes_usuario").update(campos).eq("id", id);
    if (error) toast.error("Não consegui salvar. Tente de novo.");
    await recarregar();
  }

  function alternarLida(a: Aviso) {
    void atualizar(a.id, { lida_em: a.lida_em ? null : new Date().toISOString() });
  }

  function arquivar(a: Aviso) {
    const arquivando = !a.arquivada_em;
    setEscondidos((e) => [...e, a.id]);
    void atualizar(a.id, { arquivada_em: arquivando ? new Date().toISOString() : null }).then(() =>
      setEscondidos((e) => e.filter((x) => x !== a.id)),
    );
    toast(arquivando ? "Aviso arquivado" : "Aviso de volta na caixa", {
      duration: 5000,
      action: { label: "Desfazer", onClick: () => void atualizar(a.id, { arquivada_em: a.arquivada_em ?? null }) },
    });
  }

  function excluir(a: Aviso) {
    setEscondidos((e) => [...e, a.id]);
    const t = setTimeout(async () => {
      timers.current.delete(a.id);
      const { error } = await db().from("notificacoes_usuario").delete().eq("id", a.id);
      if (error) toast.error("Não consegui excluir.");
      await recarregar();
      setEscondidos((e) => e.filter((x) => x !== a.id));
    }, 5000);
    timers.current.set(a.id, t);
    toast("Aviso excluído", {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          clearTimeout(timers.current.get(a.id));
          timers.current.delete(a.id);
          setEscondidos((e) => e.filter((x) => x !== a.id));
        },
      },
    });
  }

  function abrir(a: Aviso) {
    if (!a.lida_em) void atualizar(a.id, { lida_em: new Date().toISOString() });
    const rota = ROTA_SITE[a.tipo];
    if (rota) void navigate({ to: rota as never });
  }

  async function marcarTodas() {
    if (!user?.id) return;
    await db().from("notificacoes_usuario").update({ lida_em: new Date().toISOString() }).eq("user_id", user.id).is("lida_em", null);
    await recarregar();
  }

  const naoLidas = lista.filter((a) => !a.lida_em && !a.arquivada_em).length;

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
        {(
          [
            ["todas", "Todas"],
            ["nao_lidas", "Não lidas"],
            ["arquivadas", "Arquivadas"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filtro === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {rotulo}
          </button>
        ))}
        {filtro !== "arquivadas" && naoLidas > 0 && (
          <button type="button" onClick={() => void marcarTodas()} className="ml-auto text-xs font-medium text-primary hover:underline">
            Marcar todas como lidas
          </button>
        )}
      </div>

      {isLoading && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando avisos...</p>}
      {error && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Não consegui carregar os avisos.</p>}
      {!isLoading && !error && grupos.length === 0 && (
        <div className="rounded-3xl border bg-card px-6 py-12 text-center">
          <Bell className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{filtro === "arquivadas" ? "Nada arquivado" : "Tudo em dia"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Os avisos chegam aqui assim que acontecem.</p>
        </div>
      )}

      {grupos.map((g) => (
        <div key={g.titulo} className="mb-6">
          <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h3>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {g.itens.map((a) => {
              const { icone: Icone, cor } = ICONES[a.tipo] ?? ICONE_PADRAO;
              const nova = !a.lida_em;
              return (
                <li key={a.id} className={cn("group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50", nova && "bg-primary/5")}>
                  <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", cor)}>
                    <Icone className="size-4" aria-hidden="true" />
                  </span>
                  <button type="button" onClick={() => abrir(a)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", nova ? "font-semibold" : "font-medium")}>{a.titulo}</span>
                      {nova && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{a.mensagem}</span>
                  </button>
                  <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground group-hover:invisible">{horaCurta(a.criado_em)}</span>
                  <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border bg-background p-1 shadow-sm group-hover:flex group-focus-within:flex">
                    <BotaoAcao rotulo={nova ? "Marcar como lida" : "Marcar como não lida"} onClick={() => alternarLida(a)}>
                      {nova ? <MailOpen className="size-4" /> : <Mail className="size-4" />}
                    </BotaoAcao>
                    <BotaoAcao rotulo={a.arquivada_em ? "Desarquivar" : "Arquivar"} onClick={() => arquivar(a)}>
                      {a.arquivada_em ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                    </BotaoAcao>
                    <BotaoAcao rotulo="Excluir" perigo onClick={() => excluir(a)}>
                      <Trash2 className="size-4" />
                    </BotaoAcao>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function BotaoAcao({ rotulo, onClick, perigo, children }: { rotulo: string; onClick: () => void; perigo?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        perigo && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}
