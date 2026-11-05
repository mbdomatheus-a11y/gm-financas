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
    meta: [{ title: "Bloqueio emergencial | Control ALL" }, { name: "robots", content: "noindex" }],
  }),
  component: BloquearConta,
});

function BloquearConta() {
  const { token } = Route.useSearch();
  const bloquear = useServerFn(bloquearContaPorToken);
  const [estado, setEstado] = useState<"pronto" | "confirmar" | "enviando" | "concluido" | "erro">("pronto");
  const [protocolo, setProtocolo] = useState<string | null>(null);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
      <div className="mb-8 space-y-3 text-center">
        <ShieldAlert className="mx-auto size-10 text-destructive" />
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">Bloqueio emergencial</h1>
        <p className="text-base text-muted-foreground">Encerra todos os acessos à sua conta.</p>
      </div>
      <Card>
        <CardContent className="space-y-5 p-8 text-center">
          {estado === "concluido" ? (
            <>
              <p className="text-sm leading-relaxed">Sua conta foi bloqueada. Ninguém consegue fazer um novo acesso, e os links de troca de senha foram cancelados. Um acesso já aberto em outro aparelho pode durar até 1 hora.</p>
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
                Use só se você não reconhece a troca de senha ou a alteração feita na conta.
                Só o suporte desbloqueia, depois de confirmar sua identidade.
              </p>
              {estado === "confirmar" && (
                <p className="rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
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
                size="lg"
                className="w-full"
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
        </CardContent>
      </Card>
      <div className="mt-6 text-center">
        <Link to="/entrar" className="text-sm text-muted-foreground hover:text-foreground">
          Voltar para o login
        </Link>
      </div>
      </div>
    </main>
  );
}
