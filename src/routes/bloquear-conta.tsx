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
  const [estado, setEstado] = useState<"pronto" | "confirmar" | "enviando" | "concluido" | "erro">("pronto");
  const [protocolo, setProtocolo] = useState<string | null>(null);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6 text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="text-xl font-bold">Bloqueio emergencial</h1>
          {estado === "concluido" ? (
            <>
              <p>Sua conta foi bloqueada. Ninguém consegue entrar nela, e os links de troca de senha foram cancelados.</p>
              <p className="text-sm text-muted-foreground">
                Abrimos um chamado no suporte{protocolo ? ` (protocolo ${protocolo})` : ""} e enviamos a confirmação por e-mail.
                Só o suporte desbloqueia, depois de confirmar sua identidade.
              </p>
              <a className="text-sm underline" href="mailto:privacidade@controlall.com.br">
                Falar com o suporte
              </a>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Use esta opção só se você não reconhece o pedido de troca de senha ou a alteração feita na sua conta.
                O bloqueio encerra todos os acessos e só o suporte consegue desbloquear, depois de confirmar sua identidade.
              </p>
              {estado === "confirmar" && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  Tem certeza? Toque de novo em "Confirmar bloqueio" para bloquear a conta agora.
                </p>
              )}
              {estado === "erro" && (
                <p className="text-sm text-destructive">
                  O link é inválido, expirou ou já foi utilizado.
                </p>
              )}
              <Button
                variant="destructive"
                disabled={!token || estado === "enviando"}
                onClick={async () => {
                  // Dupla confirmação: o primeiro toque só pede confirmação.
                  if (estado !== "confirmar") {
                    setEstado("confirmar");
                    return;
                  }
                  setEstado("enviando");
                  try {
                    const r = await bloquear({ data: { token: token! } });
                    setProtocolo((r as { protocolo?: string | null })?.protocolo ?? null);
                    setEstado("concluido");
                  } catch {
                    setEstado("erro");
                  }
                }}
              >
                {estado === "confirmar" || estado === "enviando" ? "Confirmar bloqueio" : "Bloquear minha conta"}
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
