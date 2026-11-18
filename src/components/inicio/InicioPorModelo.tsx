import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { CartaoCarregando } from "@/components/CartaoCarregando";
import { SugestoesEconomia } from "@/components/SugestoesEconomia";
import { MinhasContasCard } from "@/components/MinhasContasCard";
import { LimitesResumoCard } from "@/components/LimitesResumoCard";
import { JornadaInicioCard } from "@/components/JornadaInicioCard";
import { SaudeFinanceiraCard } from "@/components/SaudeFinanceiraCard";
import { ExtratoPorDia } from "@/components/ExtratoPorDia";
import { BLOCOS, MODELOS, blocosDaAba, modeloPorId, type BlocoId, type EscolhaInicio, type ModeloId } from "@/lib/modelos-inicio";

const ResumoPrevisaoHome = lazy(() =>
  import("@/components/ResumoPrevisaoHome").then((m) => ({ default: m.ResumoPrevisaoHome })),
);
const VisaoGeralHome = lazy(() => import("@/components/VisaoGeralHome").then((m) => ({ default: m.VisaoGeralHome })));

/**
 * 18/11/2026: Início do site pelo MESMO modelo escolhido no app (lib/modelos-inicio.ts, cópia idêntica).
 * Topo fixo: ações rápidas e o "Vai sobrar" (Previsão do mês). Abaixo, as abas do modelo com os blocos ligados.
 * Bloco que o site mostra em outra tela vira um atalho pequeno para ela.
 */
const TITULO = new Map(BLOCOS.map((b) => [b.id, b.titulo]));

/** Destino no site dos blocos que não têm cartão próprio no Início. */
const ATALHO: Partial<Record<BlocoId, { to: string; hash?: string }>> = {
  categorias: { to: "/para-onde-vai" },
  aneis: { to: "/para-onde-vai" },
  terminam: { to: "/dashboard", hash: "parcelamentos-terminando" },
  "terminam-curto": { to: "/dashboard", hash: "parcelamentos-terminando" },
  andamento: { to: "/dashboard", hash: "parcelamentos-terminando" },
  parcelas: { to: "/dashboard" },
  divida: { to: "/dashboard" },
  fixas: { to: "/dashboard" },
  fluxo: { to: "/dashboard", hash: "fluxo-caixa" },
  evolucao: { to: "/relatorios" },
  maiores: { to: "/relatorios" },
  comparativo: { to: "/relatorios" },
  quem: { to: "/dashboard" },
  caixinhas: { to: "/caixinhas" },
  vencimentos: { to: "/calendario" },
  proximo: { to: "/calendario" },
};

/** Mesmo componente para blocos equivalentes (aparece uma vez por aba). */
function chaveDe(b: BlocoId): string {
  if (b === "previsao" || b === "previsao-curta") return "previsao";
  if (b === "saude" || b === "blocos") return "saude";
  if (b === "contas" || b === "cartoes" || b === "cartoes-curto") return "contas";
  if (b === "hoje" || b === "proximos") return "extrato";
  return b;
}

function Bloco({ id }: { id: BlocoId }): ReactNode {
  switch (chaveDe(id)) {
    case "previsao":
      return null; // já está no topo
    case "saude":
      return <SaudeFinanceiraCard />;
    case "contas":
      return <MinhasContasCard />;
    case "limites":
      return <LimitesResumoCard />;
    case "jornada":
      return <JornadaInicioCard />;
    case "sugestoes":
      return <SugestoesEconomia className="overflow-hidden" />;
    case "historico":
      return (
        <Suspense fallback={<CartaoCarregando />}>
          <VisaoGeralHome parte="inicio" />
        </Suspense>
      );
    case "extrato":
      return (
        <Card>
          <CardContent className="p-4">
            <ExtratoPorDia />
          </CardContent>
        </Card>
      );
    case "atalhos":
      return null; // ações rápidas ficam no topo
    default: {
      const alvo = ATALHO[id];
      if (!alvo) return null;
      return (
        <Link
          to={alvo.to as any}
          {...(alvo.hash ? { hash: alvo.hash } : {})}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/40"
        >
          <span className="font-medium">{TITULO.get(id)}</span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      );
    }
  }
}

export function InicioPorModelo({ escolha, topo }: { escolha: EscolhaInicio; topo: ReactNode }) {
  const modelo = modeloPorId(escolha.modelo);
  const [abaId, setAbaId] = useState(modelo.abas[0]?.id ?? "");
  const aba = modelo.abas.find((a) => a.id === abaId) ?? modelo.abas[0];
  const vistos = new Set<string>();
  const blocos = aba ? blocosDaAba(escolha, aba).filter((b) => (vistos.has(chaveDe(b)) ? false : (vistos.add(chaveDe(b)), true))) : [];

  return (
    <div className="space-y-6">
      {topo}
      <Suspense fallback={<CartaoCarregando />}>
        <div data-tour="inicio-sobra">
          <ResumoPrevisaoHome className="overflow-hidden" />
        </div>
      </Suspense>
      {modelo.abas.length > 1 && (
        <div role="tablist" aria-label="Abas do Início" className="inline-flex flex-wrap rounded-full bg-muted p-1 text-sm">
          {modelo.abas.map((a) => (
            <button
              key={a.id}
              role="tab"
              type="button"
              aria-selected={a.id === aba?.id}
              onClick={() => setAbaId(a.id)}
              className={`min-h-9 rounded-full px-4 font-semibold transition-colors ${a.id === aba?.id ? "bg-card text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground"}`}
            >
              {a.titulo}
            </button>
          ))}
        </div>
      )}
      {aba?.abreAgenda ? (
        <Link to="/calendario" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Abrir a Agenda <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          {blocos.map((b) => {
            const el = Bloco({ id: b });
            return el ? <div key={b} className="min-w-0">{el}</div> : null;
          })}
        </div>
      )}
    </div>
  );
}

/** Botão e janela de personalização: escolher o modelo e, por aba, ligar, desligar e ordenar os blocos. */
export function PersonalizarInicio({ escolha, salvar }: { escolha: EscolhaInicio; salvar: (e: EscolhaInicio) => void }) {
  const modelo = modeloPorId(escolha.modelo);
  const trocarModelo = (id: ModeloId) => salvar({ ...escolha, modelo: id });
  const definirAba = (abaId: string, lista: BlocoId[]) =>
    salvar({ ...escolha, ajustes: { ...escolha.ajustes, [escolha.modelo]: { ...(escolha.ajustes[escolha.modelo] ?? {}), [abaId]: lista } } });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-4" aria-hidden /> Personalizar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Personalizar o Início</DialogTitle>
          <DialogDescription>A escolha é sua e vale no site e no app. Quem divide o workspace tem a própria.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === modelo.id}
              onClick={() => trocarModelo(m.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${m.id === modelo.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
            >
              <span className="block text-sm font-semibold">{m.nome}</span>
              <span className="block text-xs text-muted-foreground">{m.descricao}</span>
            </button>
          ))}
        </div>
        {modelo.abas.length > 0 && (
          <div className="space-y-4">
            {modelo.abas
              .filter((a) => !a.abreAgenda)
              .map((a) => {
                const ligados = blocosDaAba(escolha, a);
                const desligados = BLOCOS.map((b) => b.id).filter((b) => !ligados.includes(b));
                const mover = (i: number, d: number) => {
                  const l = [...ligados];
                  const j = i + d;
                  if (j < 0 || j >= l.length) return;
                  [l[i], l[j]] = [l[j]!, l[i]!];
                  definirAba(a.id, l);
                };
                return (
                  <section key={a.id} className="space-y-1.5">
                    <h3 className="text-sm font-semibold">{a.titulo || "Blocos"}</h3>
                    <ul className="divide-y rounded-xl border">
                      {ligados.map((b, i) => (
                        <li key={b} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                          <Switch checked onCheckedChange={() => definirAba(a.id, ligados.filter((x) => x !== b))} aria-label={`Desligar ${TITULO.get(b)}`} />
                          <span className="min-w-0 flex-1 truncate">{TITULO.get(b)}</span>
                          <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" disabled={i === ligados.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Adicionar bloco</summary>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {desligados.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => definirAba(a.id, [...ligados, b])}
                            className="rounded-full border px-2.5 py-1 hover:bg-muted"
                          >
                            + {TITULO.get(b)}
                          </button>
                        ))}
                      </div>
                    </details>
                  </section>
                );
              })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
