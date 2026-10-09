import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { LinksAdminPainel } from "@/components/LinksAdminPainel";
import { Card, CardContent } from "@/components/ui/card";
import { useIsSiteAdmin } from "@/hooks/useAuthData";
import { listarLinksAtivos } from "@/lib/links-admin.functions";

export const Route = createFileRoute("/_authenticated/links/")({
  validateSearch: (s: Record<string, unknown>): { aba?: "historico"; novo?: true } => ({
    ...(s["aba"] === "historico" ? { aba: "historico" as const } : {}),
    ...(s["novo"] === true || s["novo"] === "1" || s["novo"] === "true" ? { novo: true as const } : {}),
  }),
  head: () => ({ meta: [{ title: "Links | Control ALL" }] }),
  component: LinksPage,
});

function LinksPage() {
  const { aba, novo } = Route.useSearch();
  const { data: isSiteAdmin, isPending: carregandoAdmin } = useIsSiteAdmin();
  const listar = useServerFn(listarLinksAtivos);
  const { data = [], isLoading } = useQuery({
    queryKey: ["links-ativos"],
    queryFn: () => listar(),
    enabled: !carregandoAdmin && !isSiteAdmin,
  });
  if (carregandoAdmin) {
    return <AppLayout title="Links" description="Anotações">{null}</AppLayout>;
  }
  if (isSiteAdmin) {
    return (
      <AppLayout title="Links" description="Anotações com link: criar, histórico e unificar">
        <LinksAdminPainel abaInicial={aba ?? "ativas"} novo={!!novo} />
      </AppLayout>
    );
  }
  return (
    <AppLayout title="Links" description="Anotações publicadas pela administração">
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && data.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Nenhuma anotação disponível no momento.</CardContent>
          </Card>
        )}
        {data.map((l) => (
          <Link key={l.id} to="/links/$id" params={{ id: l.id }} className="block">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0 truncate font-medium">{l.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
