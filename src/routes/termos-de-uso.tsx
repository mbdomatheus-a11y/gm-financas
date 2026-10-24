import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentoLegalView } from "@/components/DocumentoLegalView";
import { MODULOS_TERMOS, TERMOS } from "@/lib/textos-legais";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Control ALL" },
      {
        name: "description",
        content:
          "Termos de Uso do Control ALL (site e app): o que o serviço oferece, regras de uso, segurança da conta, IA, Open Finance e quem vê o quê em cada módulo.",
      },
    ],
  }),
  component: TermosPage,
});

// Texto em src/lib/textos-legais.ts (fonte única, também copiada no vault do Obsidian).

function TermosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="p-6">
            <DocumentoLegalView
              doc={TERMOS}
              depois={
                <section id="termos-anexo" className="scroll-mt-24 space-y-3 text-sm leading-6">
                  <h2 className="text-base font-semibold">Anexo: módulos, dados guardados e quem vê</h2>
                  <div className="space-y-3">
                    {MODULOS_TERMOS.map((m) => (
                      <div key={m.nome} className="rounded-lg border p-3">
                        <h3 className="font-semibold">{m.nome}</h3>
                        <p><span className="text-muted-foreground">O que guarda: </span>{m.guarda}</p>
                        <p><span className="text-muted-foreground">Quem vê: </span>{m.quemVe}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground">
                    Veja também a <Link to="/privacidade" className="underline">Política de Privacidade</Link> e a{" "}
                    <Link to="/cookies" className="underline">Política de Cookies</Link>.
                  </p>
                </section>
              }
            />
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </main>
  );
}
