import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type AuthorizationDetails = {
  client?: { name?: string };
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthAuthorizationApi = {
  getAuthorizationDetails: (id: string) => OAuthResult<AuthorizationDetails>;
  approveAuthorization: (id: string) => OAuthResult<AuthorizationDetails>;
  denyAuthorization: (id: string) => OAuthResult<AuthorizationDetails>;
};

function oauthApi(): OAuthAuthorizationApi {
  return (supabase.auth as typeof supabase.auth & { oauth: OAuthAuthorizationApi }).oauth;
}

function safeNext(pathname: string, search: string) {
  const next = `${pathname}${search}`;
  return next.startsWith("/") && !next.startsWith("//") ? next : "/inicio";
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar agente — Control ALL" },
      { name: "description", content: "Autorize um agente a consultar seus dados no Control ALL." },
      { property: "og:title", content: "Autorizar agente — Control ALL" },
      {
        property: "og:description",
        content: "Autorização segura para integrações de agentes do Control ALL.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Autorização não informada.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/entrar",
        search: { next: safeNext(location.pathname, location.searchStr) },
      });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id");
    if (!authorizationId) throw new Error("Autorização não informada.");
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-card">
        <h1 className="text-xl font-semibold">Não foi possível abrir a autorização</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String(error.message)}</p>
      </section>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "este agente";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const result = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    const target = result.data?.redirect_url ?? result.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O serviço de autorização não informou para onde continuar.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-card">
        <div className="mb-5 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-xl font-semibold">Conectar {clientName}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          O agente poderá consultar o resumo mensal, as despesas e os investimentos acessíveis à sua
          conta.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Negar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            Autorizar
          </Button>
        </div>
      </section>
    </main>
  );
}
