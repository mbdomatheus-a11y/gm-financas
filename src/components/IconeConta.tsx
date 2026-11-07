import { Landmark, Wallet } from "lucide-react";

import { IconeBanco } from "@/components/IconeBanco";
import type { ContaBancaria } from "@/hooks/useContas";
import { cn } from "@/lib/utils";

/** Ícone da conta: logo do banco quando houver; carteira e contas sem banco ganham um selo neutro. */
export function IconeConta({
  conta,
  className,
}: {
  conta: ContaBancaria;
  className?: string | undefined;
}) {
  if (conta.bancos?.nome && conta.tipo !== "carteira")
    return (
      <IconeBanco
        nome={conta.bancos.nome}
        bancoId={conta.banco_id}
        {...(className ? { className } : {})}
      />
    );
  const Icone = conta.tipo === "carteira" ? Wallet : Landmark;
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground",
        className,
      )}
      style={conta.cor ? { backgroundColor: conta.cor, color: "white" } : undefined}
      aria-hidden="true"
    >
      <Icone className="size-4" />
    </span>
  );
}
