import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Esqueleto de cartão enquanto os números carregam (evita mostrar valor parcial). */
export function CartaoCarregando({ className, alturaGrafico = "h-40" }: { className?: string; alturaGrafico?: string }) {
  return (
    <Card className={cn("mb-4 overflow-hidden", className)} aria-busy="true" aria-label="Carregando">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-72 max-w-full" />
        <Skeleton className={cn("w-full", alturaGrafico)} />
      </CardContent>
    </Card>
  );
}
