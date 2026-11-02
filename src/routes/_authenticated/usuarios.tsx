import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { ConvitesCard } from "@/components/ConvitesCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePermissoes } from "@/hooks/useAuthData";
import { definirTempoInatividade, obterTempoInatividade } from "@/lib/inatividade.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e Privilégios — Control ALL" },
      {
        name: "description",
        content: "Convites e configurações comuns a todos os usuários. A gestão de contas fica na Administração.",
      },
      { property: "og:title", content: "Usuários e Privilégios — Control ALL" },
      { property: "og:description", content: "Convites e configurações comuns." },
    ],
  }),
  component: UsuariosPage,
});

/** Configurações comuns a todos os usuários: convites e prazo de inatividade. A gestão de contas (admin) fica em Administração. */
function UsuariosPage() {
  const qc = useQueryClient();
  const { isSiteAdmin } = usePermissoes();
  const obterTempo = useServerFn(obterTempoInatividade);
  const definirTempo = useServerFn(definirTempoInatividade);
  const { data: tempoSessao } = useQuery({
    queryKey: ["inatividade-minutos"],
    queryFn: () => obterTempo(),
  });
  const [tempoDigitado, setTempoDigitado] = useState<string | null>(null);
  const salvarTempo = useMutation({
    mutationFn: () =>
      definirTempo({ data: { minutos: Number(tempoDigitado ?? tempoSessao?.minutos ?? 5) } }),
    onSuccess: () => {
      toast.success("Prazo de inatividade atualizado para todos os usuários.");
      setTempoDigitado(null);
      qc.invalidateQueries({ queryKey: ["inatividade-minutos"] });
    },
    onError: (erro: any) => toast.error(erro.message ?? "Não foi possível alterar o prazo."),
  });

  return (
    <AppLayout title="Usuários e Privilégios" description="Configurações comuns a todos os usuários">
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-52 flex-1">
              <label htmlFor="inatividade-minutos" className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="size-4" /> Desconectar por inatividade
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Aviso no último minuto. Prazo para todos os usuários, entre 2 e 120 minutos.
                {!isSiteAdmin ? " Só a administração do site pode alterar." : ""}
              </p>
            </div>
            <Input
              id="inatividade-minutos"
              type="number"
              min={2}
              max={120}
              className="w-24"
              disabled={!isSiteAdmin}
              value={tempoDigitado ?? String(tempoSessao?.minutos ?? 5)}
              onChange={(e) => setTempoDigitado(e.target.value)}
            />
            <Button
              size="sm"
              disabled={
                !isSiteAdmin ||
                salvarTempo.isPending ||
                !tempoDigitado ||
                Number(tempoDigitado) < 2 ||
                Number(tempoDigitado) > 120
              }
              onClick={() => salvarTempo.mutate()}
            >
              Salvar prazo
            </Button>
          </CardContent>
        </Card>
        <ConvitesCard />
      </div>
    </AppLayout>
  );
}
