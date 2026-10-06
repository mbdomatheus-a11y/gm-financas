import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { adminSalvarAvisoCalculadora, obterAvisoCalculadora } from "@/lib/aviso-calculadora.functions";

/** Item 17 (2026-10-05): admin liga/desliga o aviso "Sobre o módulo" da calculadora. */
export function AvisoCalculadoraAdminCard() {
  const qc = useQueryClient();
  const obter = useServerFn(obterAvisoCalculadora);
  const salvar = useServerFn(adminSalvarAvisoCalculadora);
  const { data } = useQuery({ queryKey: ["aviso-calculadora"], queryFn: () => obter() });
  const mudar = useMutation({
    mutationFn: (exibir: boolean) => salvar({ data: { exibir } }),
    onSuccess: () => {
      toast.success("Aviso da calculadora atualizado.");
      qc.invalidateQueries({ queryKey: ["aviso-calculadora"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar."),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="size-4" /> Aviso ao entrar na calculadora
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Mostra ou esconde, para todos os usuários, o aviso "Sobre o módulo Control ALL" que
          aparece no topo da tela Calculadora.
        </p>
        <Switch
          checked={data?.exibir ?? true}
          disabled={mudar.isPending || !data}
          onCheckedChange={(v) => mudar.mutate(v)}
          aria-label="Exibir aviso da calculadora"
        />
      </CardContent>
    </Card>
  );
}
