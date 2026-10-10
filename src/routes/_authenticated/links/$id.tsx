import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { TextoFormatado } from "@/components/TextoFormatado";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIsAdmin } from "@/hooks/useAuthData";
import { abrirLinkAdmin, adminConcluirLink } from "@/lib/links-admin.functions";

export const Route = createFileRoute("/_authenticated/links/$id")({
  head: () => ({ meta: [{ title: "Link | Control ALL" }, { name: "robots", content: "noindex" }] }),
  component: LinkPage,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LinkPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const abrir = useServerFn(abrirLinkAdmin);
  const concluir = useServerFn(adminConcluirLink);
  const { data: isAdmin } = useIsAdmin();
  const valido = UUID.test(id);
  const { data, isLoading } = useQuery({
    queryKey: ["link-admin", id],
    queryFn: () => abrir({ data: { id } }),
    enabled: valido,
  });
  const ok = data?.status === "ok" ? data : null;

  const alternar = useMutation({
    mutationFn: (concluida: boolean) => concluir({ data: { id, concluida } }),
    onSuccess: (_r, concluida) => {
      toast.success(concluida ? "Anotação marcada como analisada." : "Anotação reaberta.");
      qc.invalidateQueries({ queryKey: ["link-admin", id] });
      qc.invalidateQueries({ queryKey: ["admin-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copiar() {
    if (!ok) return;
    const texto = `${ok.titulo}\n\n${ok.conteudo}`;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Nota copiada com o título.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <AppLayout title={ok?.titulo ?? "Link"} description="Conteúdo publicado pela administração">
      <Card>
        <CardContent className="space-y-4 p-5">
          {ok && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={copiar}>
                <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Copiar nota toda
              </Button>
              {isAdmin && (
                <Button
                  type="button"
                  size="sm"
                  variant={ok.concluidaEm ? "outline" : "default"}
                  disabled={alternar.isPending}
                  onClick={() => alternar.mutate(!ok.concluidaEm)}
                >
                  {ok.concluidaEm ? (
                    <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  )}
                  {ok.concluidaEm ? "Reabrir nota" : "Concluir nota"}
                </Button>
              )}
              {ok.concluidaEm && (
                <span className="text-xs text-muted-foreground">
                  Analisada em {new Date(ok.concluidaEm).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          )}
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {ok && <TextoFormatado texto={ok.conteudo} />}
          {data?.status === "expirado" && <p className="text-sm">Este link expirou.</p>}
          {(!valido || data?.status === "nao_encontrado") && <p className="text-sm">Link não encontrado.</p>}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
