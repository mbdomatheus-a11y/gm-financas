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
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Info className="size-4 text-muted-foreground" aria-hidden="true" /> Simulador da calculadora
        </CardTitle>
        <p className="text-sm text-muted-foreground">Aviso exibido ao abrir o Simulador de dose/diluição.</p>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-2xl border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Mostrar aviso de uso acadêmico</p>
              <p className="text-xs text-muted-foreground">Vale para todos os usuários, em Ferramentas.</p>
            </div>
        <Switch
          checked={data?.exibir ?? false}
          disabled={mudar.isPending || !data}
          onCheckedChange={(v) => mudar.mutate(v)}
          aria-label="Exibir aviso da calculadora"
        />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
