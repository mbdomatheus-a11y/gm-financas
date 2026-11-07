import { Link } from "@tanstack/react-router";
import { ChevronRight, Wallet } from "lucide-react";

import { IconeConta } from "@/components/IconeConta";
import { Card, CardContent } from "@/components/ui/card";
import { useContasComSaldo } from "@/hooks/useContas";
import { useDespesas, useReceitas } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { cn } from "@/lib/utils";

/**
 * Minhas contas (07/11/2026), para a home: lista compacta das contas ativas com saldo e link
 * para /contas. Não aparece enquanto a migration de contas não rodou.
 */
export function MinhasContasCard({
  limite = 5,
  className,
}: {
  limite?: number;
  className?: string | undefined;
}) {
  const { formatar } = usePrivacidadeValores("contas");
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const { linhas, total, isLoading, tabelaPendente } = useContasComSaldo(receitas, despesas);

  if (tabelaPendente) return null;

  return (
    <Card className={cn("rounded-3xl", className)}>
      <CardContent className="p-5 sm:p-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Minhas contas</p>
            {linhas.length > 0 && (
              <p
                className={cn(
                  "text-2xl font-bold tracking-tight tabular-nums",
                  total < 0 && "text-destructive",
                )}
              >
                {formatar(total)}
              </p>
            )}
          </div>
          <Link
            to="/contas"
            className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
          >
            Ver contas <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : linhas.length === 0 ? (
          <Link
            to="/contas"
            className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <Wallet className="size-4 shrink-0" aria-hidden="true" />
            Cadastre suas contas e a carteira para ver o saldo de cada uma.
          </Link>
        ) : (
          <ul className="divide-y">
            {linhas.slice(0, limite).map(({ conta, saldo }) => (
              <li key={conta.id} className="flex items-center gap-3 py-2.5">
                <IconeConta conta={conta} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-sm">{conta.nome}</span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    saldo < 0 && "text-destructive",
                  )}
                >
                  {formatar(saldo)}
                </span>
              </li>
            ))}
            {linhas.length > limite && (
              <li className="pt-2.5 text-xs text-muted-foreground">
                e mais {linhas.length - limite}
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
