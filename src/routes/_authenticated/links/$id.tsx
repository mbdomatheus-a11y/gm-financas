import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { TextoFormatado } from "@/components/TextoFormatado";
import { Card, CardContent } from "@/components/ui/card";
import { abrirLinkAdmin } from "@/lib/links-admin.functions";

export const Route = createFileRoute("/_authenticated/links/$id")({
  head: () => ({ meta: [{ title: "Link | Control ALL" }, { name: "robots", content: "noindex" }] }),
  component: LinkPage,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LinkPage() {
  const { id } = Route.useParams();
  const abrir = useServerFn(abrirLinkAdmin);
  const valido = UUID.test(id);
  const { data, isLoading } = useQuery({
    queryKey: ["link-admin", id],
    queryFn: () => abrir({ data: { id } }),
    enabled: valido,
  });
  const ok = data?.status === "ok" ? data : null;
  return (
    <AppLayout title={ok?.titulo ?? "Link"} description="Conteúdo publicado pela administração">
      <Card>
        <CardContent className="p-5">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {ok && <TextoFormatado texto={ok.conteudo} />}
          {data?.status === "expirado" && <p className="text-sm">Este link expirou.</p>}
          {(!valido || data?.status === "nao_encontrado") && <p className="text-sm">Link não encontrado.</p>}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
