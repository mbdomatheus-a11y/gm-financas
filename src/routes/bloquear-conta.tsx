import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { bloquearContaPorToken } from "@/lib/seguranca-conta.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/bloquear-conta")({
  validateSearch: (s: Record<string, unknown>): { token?: string } =>
    typeof s["token"] === "string" ? { token: s["token"] } : {},
  head: () => ({
    meta: [{ title: "Bloqueio emergencial — Control ALL" }, { name: "robots", content: "noindex" }],
  }),
  component: BloquearConta,
});

function BloquearConta() {
  const { token } = Route.useSearch();
  const bloquear = useServerFn(bloquearContaPorToken);
  const [estado, setEstado] = useState<"pronto" | "enviando" | "concluido" | "erro">("pronto");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6 text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="text-xl font-bold">Bloqueio emergencial</h1>
          {estado === "concluido" ? (
            <>
              <p>Sua conta foi bloqueada e novas entradas foram interrompidas.</p>
              <a className="text-sm underline" href="mailto:privacidade@controlall.com.br">
                Contatar a administração
              </a>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Use esta opção somente se você não reconhece a alteração de senha. O administrador
                do site será avisado.
              </p>
              {estado === "erro" && (
                <p className="text-sm text-destructive">
                  O link é inválido, expirou ou já foi utilizado.
                </p>
              )}
              <Button
                variant="destructive"
                disabled={!token || estado === "enviando"}
                onClick={async () => {
                  setEstado("enviando");
                  try {
                    await bloquear({ data: { token: token! } });
                    setEstado("concluido");
                  } catch {
                    setEstado("erro");
                  }
                }}
              >
                Bloquear minha conta
              </Button>
            </>
          )}
          <div>
            <Link to="/entrar" className="text-xs text-muted-foreground underline">
              Voltar ao login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
