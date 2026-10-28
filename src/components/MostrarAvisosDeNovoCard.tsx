import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

/**
 * Minha conta (28/10/2026): o próprio usuário volta a ver os avisos que já fechou (boas-vindas, tour,
 * convites, cookies, primeiros passos...). Vale no site e no app; a página recarrega uma vez.
 */
export function MostrarAvisosDeNovoCard({ className }: { className?: string }) {
  const qc = useQueryClient();
  const redefinir = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("redefinir_meus_avisos");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pronto. Os avisos vão aparecer de novo.");
      void qc.invalidateQueries({ queryKey: ["avisos-redefinicao"] });
    },
    onError: () => toast.error("Não foi possível agora. Tente de novo em instantes."),
  });
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <RotateCcw className="size-4" /> Avisos e dicas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Mostra de novo as boas-vindas, o tour, as dicas e os convites que você já fechou, aqui e no app.
        </p>
        <Button variant="outline" className="w-full" disabled={redefinir.isPending} onClick={() => redefinir.mutate()}>
          Mostrar os avisos de novo
        </Button>
      </CardContent>
    </Card>
  );
}
