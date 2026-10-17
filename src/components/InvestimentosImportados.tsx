import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Landmark } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIsSiteAdmin } from "@/hooks/useAuthData";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { pluggyListarPatrimonio } from "@/lib/pluggy.functions";

/** Investimentos lidos pelo Open Finance (somente leitura). Visível só para a administração. */
export function InvestimentosImportados() {
  const { data: ehAdmin } = useIsSiteAdmin();
  const listar = useServerFn(pluggyListarPatrimonio);
  const { formatar } = usePrivacidadeValores();
  const { data } = useQuery({
    queryKey: ["pluggy-patrimonio"],
    queryFn: () => listar(),
    enabled: !!ehAdmin,
    retry: false,
  });

  const itens = data?.investimentos ?? [];
  if (!ehAdmin || itens.length === 0) return null;
  const total = itens.reduce((s: number, i: any) => s + (Number(i.saldo) || 0), 0);

  return (
    <Card className="mt-4">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Landmark className="size-3.5" aria-hidden="true" /> Importados pelo Open Finance
        </CardTitle>
        <p className="text-2xl font-bold tabular-nums tracking-tight">{formatar(total)}</p>
        <p className="text-xs text-muted-foreground">
          {itens.length} aplicação(ões) lida(s) do banco. Atualizam a cada sincronização.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {itens.map((i: any) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate">
                {i.nome ?? "Investimento"}
                <span className="text-xs text-muted-foreground">
                  {" "}· {i.tipo ?? ""}
                  {i.instituicao ? ` · ${i.instituicao}` : ""}
                </span>
              </span>
              {i.rentabilidade_anual != null && <Badge variant="outline">{i.rentabilidade_anual}% a.a.</Badge>}
              <span className="shrink-0 tabular-nums">{formatar(Number(i.saldo) || 0)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
