import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAvisoConta } from "@/components/boas-vindas/useAvisoConta";
import { useSession } from "@/hooks/useAuthData";
import { useContas } from "@/hooks/useContas";
import { useCartoes, useDespesas } from "@/hooks/useFinance";
import { useLimites } from "@/hooks/useLimites";
import { usePreferencias } from "@/hooks/usePreferencias";
import { listarCaixinhas } from "@/lib/poupar";

/**
 * Card "Primeiros passos" do Início (07/11/2026). Cada item é conferido pelos dados reais
 * da conta. Dispensável no X (guardado na conta, aviso "primeiros_passos") e some sozinho
 * quando os 4 passos estão feitos. O cartão de exemplo (dados fictícios) não conta.
 */

type Passo = {
  id: string;
  titulo: string;
  texto: string;
  feito: boolean;
  acao: string;
  para?: "/cartoes" | "/caixinhas" | "/limites";
  evento?: string;
};

const ehExemplo = (c: any) => c?.apelido === "Cartão Exemplo" && c?.final === "0000";

export function PrimeirosPassos({ className = "" }: { className?: string }) {
  const { user } = useSession();
  const { dispensado, carregando: avisoCarregando, dispensar } = useAvisoConta("primeiros_passos", user?.id);
  const cartoes = useCartoes();
  const contas = useContas();
  const despesas = useDespesas();
  const caixinhas = useQuery({ queryKey: ["caixinhas"], queryFn: listarCaixinhas, retry: false });
  const { limites, isLoading: limitesCarregando } = useLimites();
  const { prefs } = usePreferencias();

  const carregando =
    avisoCarregando || cartoes.isLoading || contas.isLoading || despesas.isLoading || caixinhas.isLoading || limitesCarregando;

  const passos: Passo[] = [
    {
      id: "forma",
      titulo: "Cadastre um cartão ou conta",
      texto: "Assim cada gasto cai na fatura ou no saldo certo.",
      feito: (cartoes.data ?? []).some((c: any) => !ehExemplo(c)) || contas.contas.length > 0,
      acao: "Cadastrar",
      para: "/cartoes",
    },
    {
      id: "despesa",
      titulo: "Lance sua primeira despesa",
      texto: "Fale ou digite. A IA classifica para você.",
      feito: (despesas.data ?? []).length > 0,
      acao: "Lançar agora",
      evento: "abrir-lancamento-rapido",
    },
    {
      id: "caixinha",
      titulo: "Crie uma caixinha",
      texto: "Separe um valor por mês para um objetivo.",
      feito: (caixinhas.data ?? []).length > 0,
      acao: "Criar caixinha",
      para: "/caixinhas",
    },
    {
      id: "limite",
      titulo: "Defina um limite ou o dia de virada",
      texto: "Receba aviso antes de estourar e feche o mês no dia do seu salário.",
      feito: limites.length > 0 || prefs.dia_virada != null,
      acao: "Definir limite",
      para: "/limites",
    },
  ];

  const feitos = passos.filter((p) => p.feito).length;
  if (carregando || dispensado || feitos === passos.length) return null;
  const proximo = passos.find((p) => !p.feito)!;
  const pct = (feitos / passos.length) * 100;

  return (
    <section
      aria-labelledby="primeiros-passos-titulo"
      className={`relative rounded-3xl border bg-card p-5 shadow-[0_20px_40px_-32px_rgba(14,26,43,0.45)] sm:p-6 ${className}`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 size-8 text-muted-foreground"
        aria-label="Dispensar primeiros passos"
        onClick={() => void dispensar()}
      >
        <X className="size-4" />
      </Button>
      <h2 id="primeiros-passos-titulo" className="pr-10 text-xl font-bold tracking-tight">
        Primeiros passos
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={passos.length}
          aria-valuenow={feitos}
          aria-label="Progresso dos primeiros passos"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {feitos} de {passos.length} concluídos
        </span>
      </div>

      <ol className="mt-5 space-y-2">
        {passos.map((p) => {
          const atual = p.id === proximo.id;
          return (
            <li
              key={p.id}
              className={`flex items-start gap-3 rounded-2xl p-3 ${atual ? "bg-primary/5 ring-1 ring-primary/30" : ""}`}
            >
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${
                  p.feito ? "border-success bg-success text-white" : atual ? "border-primary" : "border-muted-foreground/30"
                }`}
                aria-hidden="true"
              >
                {p.feito && <Check className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${p.feito ? "text-muted-foreground line-through" : ""}`}>
                  {p.titulo}
                  <span className="sr-only">{p.feito ? " (concluído)" : " (pendente)"}</span>
                </p>
                {atual && <p className="mt-0.5 text-xs text-muted-foreground">{p.texto}</p>}
                {atual && (
                  <div className="mt-3">
                    {p.para ? (
                      <Button asChild size="sm" className="rounded-full">
                        <Link to={p.para}>
                          {p.acao} <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => window.dispatchEvent(new Event(p.evento!))}
                      >
                        {p.acao} <ArrowRight className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
