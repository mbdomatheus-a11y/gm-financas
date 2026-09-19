import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { solicitarRecuperacaoSenha } from "@/lib/recuperacao-senha.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Control ALL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EsqueciSenhaPage,
});

/**
 * Recuperação de senha self-service — endpoint público. Sempre mostra a
 * mesma mensagem de sucesso (não revela se o e-mail existe) e não funciona
 * pra contas antigas por CPF (e-mail sintético, sem inbox real) — pra essas
 * a orientação continua sendo pedir a um administrador.
 */
function EsqueciSenhaPage() {
  const solicitar = useServerFn(solicitarRecuperacaoSenha);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setLoading(true);
    try {
      await solicitar({ data: { email: email.trim() } });
      setEnviado(true);
    } catch {
      // Server function já não deveria lançar nesse fluxo, mas por segurança
      // trata igual a um sucesso silencioso (nunca revela detalhes).
      setEnviado(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          to="/entrar"
          className="mb-6 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Voltar para o login
        </Link>

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="gradient-brand mb-4 flex size-14 items-center justify-center rounded-2xl shadow-soft">
            <KeyRound className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Recuperar senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o e-mail da sua conta pra receber um link de redefinição
          </p>
        </div>

        {enviado ? (
          <div className="space-y-3 rounded-2xl border bg-card p-6 text-center shadow-card">
            <MailCheck className="mx-auto size-8 text-primary" />
            <p className="text-sm">
              Se esse e-mail tiver uma conta (criada por convite, com e-mail real), você vai
              receber um link em poucos minutos. Contas antigas criadas por CPF não recebem
              e-mail — nesse caso, peça a um administrador para redefinir sua senha em{" "}
              <strong>Usuários e Privilégios</strong>.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enviar link de recuperação
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
