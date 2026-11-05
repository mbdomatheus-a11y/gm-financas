import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { solicitarRecuperacaoSenha } from "@/lib/recuperacao-senha.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha | Control ALL" },
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
      <div className="w-full max-w-md">
        <Link
          to="/entrar"
          className="mb-10 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar para o login
        </Link>

        <div className="mb-8 space-y-3 text-center">
          <h1 className="text-4xl font-extrabold tracking-[-0.03em]">Recuperar senha</h1>
          <p className="text-base text-muted-foreground">
            Enviaremos um link de redefinição para o seu e-mail.
          </p>
        </div>

        {enviado ? (
          <div className="space-y-4 rounded-3xl border bg-card p-8 text-center shadow-card">
            <MailCheck className="mx-auto size-8 text-primary" />
            <p className="text-sm leading-relaxed">
              Se houver uma conta com esse e-mail, o link chega em poucos minutos.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Contas antigas criadas por CPF não recebem e-mail. Nesse caso, peça a um
              administrador para redefinir sua senha em <strong>Usuários e Privilégios</strong>.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border bg-card p-8 shadow-card"
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
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enviar link de recuperação
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
