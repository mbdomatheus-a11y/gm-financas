import { createFileRoute, Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentoLegalView } from "@/components/DocumentoLegalView";
import { abrirPreferenciasCookies } from "@/components/AvisoPrivacidade";
import { COOKIES } from "@/lib/textos-legais";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Política de Cookies — Control ALL" },
      {
        name: "description",
        content:
          "Quais cookies o Control ALL usa, para que servem, por quanto tempo ficam e como mudar a sua escolha. Não usamos cookies de publicidade.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="p-6">
            <DocumentoLegalView
              doc={COOKIES}
              depois={
                <div className="flex flex-col gap-3 border-t pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground">
                    Mais detalhes na <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
                  </p>
                  <Button onClick={abrirPreferenciasCookies}>
                    <Cookie className="size-4" /> Preferências de cookies
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </main>
  );
}
