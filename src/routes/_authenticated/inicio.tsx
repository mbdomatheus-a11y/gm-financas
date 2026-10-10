import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  DatabaseBackup,
  Headphones,
  Lock,
  Settings,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { GamificacaoFinanceira } from "@/components/GamificacaoFinanceira";
import { Card, CardContent } from "@/components/ui/card";
import { VisaoGeralHome } from "@/components/VisaoGeralHome";
import { useModulosGlobais, usePermissoes } from "@/hooks/useAuthData";
import { useVeiculos } from "@/hooks/useFinance";
import { usePreferencias } from "@/hooks/usePreferencias";
import {
  ADMIN_ONLY_CARD,
  ADMIN_ONLY_TAG,
  AREAS,
  MODULOS_INFO,
  ORDEM_AREAS,
  type AreaId,
} from "@/lib/areas";
import { currentMonthKey, formatBRL, monthKey } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início | Control ALL" },
      { name: "description", content: "Escolha o que deseja acessar." },
      { property: "og:title", content: "Início | Control ALL" },
      { property: "og:description", content: "Central de acesso do Control ALL." },
    ],
  }),
  component: InicioPage,
});

const CHIP =
  "rounded-full border px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10";

function InicioPage() {
  const { can, isAdmin, isSiteAdmin } = usePermissoes();
  const { habilitado, liberadoGeral } = useModulosGlobais();
  const { prefs: preferencias } = usePreferencias();
  const { data: veiculos = [] } = useVeiculos();
  const podeVerResumoFinancas = habilitado("financas") && can("despesas", "ver");
  // Resumo e metas abrem sozinhos no computador e ficam recolhidos no celular.
  const [resumoAberto, setResumoAberto] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  // Soma do mês atual dos eventos do veículo com custo, só quando a
  // preferência de destaque está ativa (plano-mega-2026-09-14.md, bloco 7).
  const somaVeiculoMes = useMemo(() => {
    if (!preferencias.destacar_veiculo_inicio) return null;
    const mesAtual = currentMonthKey();
    let soma = 0;
    for (const v of veiculos as any[]) {
      for (const e of v.veiculo_eventos ?? []) {
        if (e.custo != null && monthKey(e.data) === mesAtual) soma += Number(e.custo);
      }
    }
    return soma;
  }, [preferencias.destacar_veiculo_inicio, veiculos]);

  const atalhos = [
    { to: "/calendario" as const, label: "Calendário", icon: CalendarDays, ok: true },
    { to: "/compartilhar" as const, label: "Compartilhar", icon: Share2, ok: can("compartilhar", "ver") },
    { to: "/configuracoes" as const, label: "Configurações", icon: Settings, ok: true },
    { to: "/suporte" as const, label: "Suporte", icon: Headphones, ok: true },
  ].filter((a) => a.ok);

  const itensAdmin = [
    { to: "/usuarios" as const, label: "Usuários e Privilégios", icon: Users, ok: isAdmin },
    { to: "/backup" as const, label: "Backup e Reset", icon: DatabaseBackup, ok: isAdmin },
    { to: "/administracao" as const, label: "Administração do site", icon: ShieldCheck, ok: isSiteAdmin },
  ].filter((a) => a.ok);

  /** Atalhos de um clique dentro do cartão de cada área. */
  function chips(area: AreaId): { to: string; label: string; soAdmin?: boolean }[] {
    if (area === "dinheiro") {
      return [
        can("despesas", "ver") && { to: "/despesas", label: "Despesas" },
        can("receitas", "ver") && { to: "/receitas", label: "Receitas" },
        can("cartoes", "ver") && { to: "/cartoes", label: "Cartões" },
      ].filter(Boolean) as { to: string; label: string }[];
    }
    if (area === "ferramentas") return [];
    return AREAS[area].modulos
      .filter((m) => habilitado(m))
      .map((m) => ({
        to: MODULOS_INFO[m].to,
        label: m === "links" ? "Anotações" : MODULOS_INFO[m].titulo,
        soAdmin: isSiteAdmin && !liberadoGeral(m),
      }));
  }

  return (
    <AppLayout title="Início" description="Escolha o que deseja acessar">
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {ORDEM_AREAS.map((id) => {
          const area = AREAS[id];
          const Icon = area.icon;
          const algumLiberado = area.modulos.some((m) => habilitado(m));
          if (!algumLiberado) {
            return (
              <Card key={id} className="cursor-not-allowed select-none opacity-60 grayscale" aria-disabled="true">
                <CardContent className="flex min-h-36 items-center gap-4 p-5">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <Icon className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{area.titulo}</h2>
                    <p className="flex items-center gap-1 text-xs italic text-muted-foreground">
                      <Lock className="size-3" /> Liberado em breve pelo administrador.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          }
          const lista = chips(id);
          const soAdminArea =
            isSiteAdmin && area.modulos.every((m) => !habilitado(m) || !liberadoGeral(m));
          return (
            <Card key={id} className={cn("lift h-full", soAdminArea && ADMIN_ONLY_CARD)}>
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <Link to={area.to} className="flex items-center gap-4">
                  <div className="gradient-brand flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-glow)]">
                    <Icon className="size-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                      {area.titulo}
                      {soAdminArea && <span className={ADMIN_ONLY_TAG}>Só admin</span>}
                    </h2>
                    <p className="text-sm text-muted-foreground">{area.descricao}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-primary" />
                </Link>
                {lista.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {lista.map((c) => (
                      <Link
                        key={c.to}
                        to={c.to as any}
                        className={cn(CHIP, c.soAdmin && "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:text-violet-300")}
                      >
                        {c.label}
                      </Link>
                    ))}
                    {id === "casa" && somaVeiculoMes != null && (
                      <span className="self-center text-xs font-semibold text-primary">
                        Veículo: {formatBRL(somaVeiculoMes)} este mês
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {atalhos.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Icon className="size-4" /> {a.label}
            </Link>
          );
        })}
      </div>

      {itensAdmin.length > 0 && (
        <div className="mb-8 space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Administração <span className={ADMIN_ONLY_TAG}>Só admin</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {itensAdmin.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.to} to={a.to}>
                  <Card className={cn("h-full transition-colors hover:bg-violet-500/10", ADMIN_ONLY_CARD)}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Icon className="size-5 text-violet-600 dark:text-violet-300" />
                      <span className="text-sm font-medium">{a.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {podeVerResumoFinancas && (
        <section>
          <button
            type="button"
            onClick={() => setResumoAberto((v) => !v)}
            aria-expanded={resumoAberto}
            className="mb-3 flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-left text-sm font-semibold"
          >
            Resumo do mês e metas
            <ChevronDown className={cn("size-4 transition-transform", resumoAberto && "rotate-180")} />
          </button>
          {resumoAberto && (
            <div className="space-y-6">
              <GamificacaoFinanceira />
              <VisaoGeralHome />
            </div>
          )}
        </section>
      )}
    </AppLayout>
  );
}
