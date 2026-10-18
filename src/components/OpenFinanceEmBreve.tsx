import { Landmark } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/** Aviso na home: o app é gratuito hoje e a conexão automática com bancos ainda não existe. */
export function OpenFinanceEmBreve({ className = "" }: { className?: string }) {
  return (
    <Card className={`border-primary/30 ${className}`}>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Landmark className="size-4.5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Conexão automática com bancos: em breve</p>
          <p className="text-xs text-muted-foreground">
            Hoje o Control ALL é gratuito. Você lança seus gastos manualmente ou importa extratos e
            faturas. A integração com Open Finance ainda não está disponível para todos. Em breve,
            novidades.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
