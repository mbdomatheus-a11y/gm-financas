import { GraficoHome, opcaoGraficoValida } from "@/components/GraficoHome";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  DatabaseBackup,
  Headphones,
  LayoutGrid,
  Lock,
  Plus,
  Settings,
  Share2,
  ShieldCheck,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GamificacaoFinanceira } from "@/components/GamificacaoFinanceira";
import { Button } from "@/components/ui/button";
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
  type AreaId,
} from "@/lib/areas";
import { currentMonthKey, formatBRL, monthKey } from "@/lib/format";
import {
  WIDGETS,
  classeTamanho,
  layoutAutomatico,
  normalizarLayout,
  tamanhoPermitido,
  type ItemWidget,
  type TamanhoWidget,
  type WidgetId,
} from "@/lib/home-widgets";
import { cn } from "@/lib/utils";

const CHIP =
  "rounded-full border px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10";

function AreaCard({ id }: { id: AreaId }) {
  const { can, isSiteAdmin } = usePermissoes();
  const { habilitado, liberadoGeral } = useModulosGlobais();
  const { prefs } = usePreferencias();
  const { data: veiculos = [] } = useVeiculos();
  const area = AREAS[id];
  const Icon = area.icon;

  // Soma do mês do veículo, só quando a preferência de destaque está ativa.
  const somaVeiculoMes = useMemo(() => {
    if (id !== "casa" || !prefs.destacar_veiculo_inicio) return null;
    const mesAtual = currentMonthKey();
    let soma = 0;
    for (const v of veiculos as any[]) {
      for (const e of v.veiculo_eventos ?? []) {
        if (e.custo != null && monthKey(e.data) === mesAtual) soma += Number(e.custo);
      }
    }
    return soma;
  }, [id, prefs.destacar_veiculo_inicio, veiculos]);

  if (!area.modulos.some((m) => habilitado(m))) {
    return (
      <Card className="h-full cursor-not-allowed select-none opacity-60 grayscale" aria-disabled="true">
        <CardContent className="flex min-h-32 items-center gap-4 p-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{area.titulo}</h2>
            <p className="flex items-center gap-1 text-xs italic text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" /> Liberado em breve pelo administrador.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  let chips: { to: string; label: string; soAdmin?: boolean }[] = [];
  if (id === "dinheiro") {
    chips = [
      can("despesas", "ver") && { to: "/despesas", label: "Despesas" },
      can("receitas", "ver") && { to: "/receitas", label: "Receitas" },
      can("cartoes", "ver") && { to: "/cartoes", label: "Cartões" },
    ].filter(Boolean) as { to: string; label: string }[];
  } else if (id !== "ferramentas") {
    chips = area.modulos
      .filter((m) => habilitado(m))
      .map((m) => ({
        to: MODULOS_INFO[m].to,
        label: m === "links" ? "Anotações" : MODULOS_INFO[m].titulo,
        soAdmin: isSiteAdmin && !liberadoGeral(m),
      }));
  }
  const soAdminArea = isSiteAdmin && area.modulos.every((m) => !habilitado(m) || !liberadoGeral(m));

  return (
    <Card className={cn("lift h-full", soAdminArea && ADMIN_ONLY_CARD)}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <Link to={area.to} className="flex items-center gap-4">
          <div className="gradient-brand flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-glow)]">
            <Icon className="size-6 text-primary-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              {area.titulo}
              {soAdminArea && <span className={ADMIN_ONLY_TAG}>Só admin</span>}
            </h2>
            <p className="text-sm text-muted-foreground">{area.descricao}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
        </Link>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Link
                key={c.to}
                to={c.to as any}
                className={cn(
                  CHIP,
                  c.soAdmin && "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:text-violet-300",
                )}
              >
                {c.label}
              </Link>
            ))}
            {somaVeiculoMes != null && (
              <span className="self-center text-xs font-semibold text-primary">
                Veículo: {formatBRL(somaVeiculoMes)} este mês
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Atalhos() {
  const { can } = usePermissoes();
  const atalhos = [
    { to: "/calendario" as const, label: "Calendário", icon: CalendarDays, ok: true },
    { to: "/compartilhar" as const, label: "Compartilhar", icon: Share2, ok: can("compartilhar", "ver") },
    { to: "/configuracoes" as const, label: "Configurações", icon: Settings, ok: true },
    { to: "/suporte" as const, label: "Suporte", icon: Headphones, ok: true },
  ].filter((a) => a.ok);
  return (
    <Card className="h-full">
      <CardContent className="flex flex-wrap items-center gap-2 p-4">
        {atalhos.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Icon className="size-4" aria-hidden="true" /> {a.label}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AdminBloco() {
  const { isAdmin, isSiteAdmin } = usePermissoes();
  const itens = [
    { to: "/usuarios" as const, label: "Usuários e Privilégios", icon: Users, ok: isAdmin },
    { to: "/backup" as const, label: "Backup e Reset", icon: DatabaseBackup, ok: isAdmin },
    { to: "/administracao" as const, label: "Administração do site", icon: ShieldCheck, ok: isSiteAdmin },
  ].filter((a) => a.ok);
  return (
    <Card className={cn("h-full", ADMIN_ONLY_CARD)}>
      <CardContent className="space-y-2 p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Administração <span className={ADMIN_ONLY_TAG}>Só admin</span>
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {itens.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-violet-500/10"
              >
                <Icon className="size-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                <span className="text-sm font-medium">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function usePodeMostrar(): (id: WidgetId) => boolean {
  const { can, isAdmin, isSiteAdmin } = usePermissoes();
  const { habilitado } = useModulosGlobais();
  const financas = habilitado("financas") && can("despesas", "ver");
  return (id) => {
    if (id === "admin") return isAdmin || isSiteAdmin;
    if (id === "resumo" || id === "conquistas" || id === "grafico1" || id === "grafico2") return financas;
    return true;
  };
}

function Corpo({
  id,
  opcao,
  onOpcao,
}: {
  id: WidgetId;
  opcao?: string | undefined;
  onOpcao: (o: string) => void;
}) {
  if (id === "grafico1" || id === "grafico2")
    return <GraficoHome opcao={opcaoGraficoValida(opcao)} onOpcao={onOpcao} />;
  if (id === "dinheiro" || id === "casa" || id === "documentos" || id === "ferramentas")
    return <AreaCard id={id} />;
  if (id === "atalhos") return <Atalhos />;
  if (id === "admin") return <AdminBloco />;
  if (id === "conquistas") return <GamificacaoFinanceira />;
  return <VisaoGeralHome />;
}

const ROTULO_TAMANHO: Record<TamanhoWidget, string> = { p: "Pequeno", m: "Médio", g: "Grande" };

/**
 * Tela Início em widgets: cada bloco pode ser removido, readicionado, movido
 * e ter o tamanho ajustado (respeitando um mínimo). "Organizar automático"
 * volta ao layout padrão. A escolha fica salva na conta (preferencias_usuario).
 */
export function HomeWidgets() {
  const { prefs, save } = usePreferencias();
  const podeMostrar = usePodeMostrar();
  const salvo = useMemo(() => normalizarLayout(prefs.home_widgets), [prefs.home_widgets]);
  const [itens, setItens] = useState<ItemWidget[]>(salvo);
  const [editando, setEditando] = useState(false);
  useEffect(() => setItens(salvo), [salvo]);

  function aplicar(novo: ItemWidget[], auto = false) {
    setItens(novo);
    save.mutate({ home_widgets: auto ? null : novo });
  }
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= itens.length) return;
    const novo = [...itens];
    [novo[i], novo[j]] = [novo[j]!, novo[i]!];
    aplicar(novo);
  }
  const ausentes = (Object.keys(WIDGETS) as WidgetId[]).filter(
    (id) => !itens.some((x) => x.id === id) && podeMostrar(id),
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {editando && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => aplicar(layoutAutomatico(), true)}
            title="Volta a ordem e os tamanhos padrão"
          >
            <Wand2 className="mr-1 size-4" aria-hidden="true" /> Organizar automático
          </Button>
        )}
        <Button size="sm" variant={editando ? "default" : "outline"} onClick={() => setEditando((v) => !v)}>
          <LayoutGrid className="mr-1 size-4" aria-hidden="true" />
          {editando ? "Concluir" : "Personalizar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {itens.map((item, i) => {
          if (!podeMostrar(item.id)) return null;
          const info = WIDGETS[item.id];
          return (
            <section
              key={item.id}
              aria-label={info.titulo}
              className={cn(
                classeTamanho(item.tamanho),
                "relative min-w-0",
                editando && "rounded-xl ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
              )}
            >
              {editando && (
                <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1.5 text-xs">
                  <span className="mr-auto px-1 font-semibold">{info.titulo}</span>
                  {(["p", "m", "g"] as TamanhoWidget[]).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={item.tamanho === t ? "default" : "outline"}
                      className="h-7 px-2 text-xs"
                      disabled={!tamanhoPermitido(item.id, t)}
                      aria-pressed={item.tamanho === t}
                      onClick={() => aplicar(itens.map((x) => (x.id === item.id ? { ...x, tamanho: t } : x)))}
                    >
                      {ROTULO_TAMANHO[t]}
                    </Button>
                  ))}
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    disabled={i === 0}
                    aria-label={`Mover ${info.titulo} para antes`}
                    onClick={() => mover(i, -1)}
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    disabled={i === itens.length - 1}
                    aria-label={`Mover ${info.titulo} para depois`}
                    onClick={() => mover(i, 1)}
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label={`Remover ${info.titulo} da tela`}
                    onClick={() => aplicar(itens.filter((x) => x.id !== item.id))}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              )}
              <Corpo
                id={item.id}
                opcao={item.opcao}
                onOpcao={(o) => aplicar(itens.map((x) => (x.id === item.id ? { ...x, opcao: o } : x)))}
              />
            </section>
          );
        })}
      </div>

      {editando && ausentes.length > 0 && (
        <Card className="mt-4">
          <CardContent className="space-y-2 p-4">
            <h2 className="text-sm font-semibold">Adicionar widgets (gráficos e outros)</h2>
            <div className="flex flex-wrap gap-2">
              {ausentes.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant="outline"
                  onClick={() => aplicar([...itens, { id, tamanho: WIDGETS[id].padrao }])}
                >
                  <Plus className="mr-1 size-4" aria-hidden="true" /> {WIDGETS[id].titulo}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {editando && itens.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum widget na tela. Use "Organizar automático" para voltar ao padrão.
        </p>
      )}
    </div>
  );
}
