import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { redefinirSenhaComToken } from "@/lib/recuperacao-senha.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    ...(typeof s["token"] === "string" && s["token"] ? { token: s["token"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Nova senha — Control ALL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RedefinirSenhaPage,
});

/** Confirma a redefinição a partir do token recebido por e-mail (link de /esqueci-senha). */
function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const redefinir = useServerFn(redefinirSenhaComToken);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!search.token) {
      toast.error("Link inválido — peça um novo em Esqueci minha senha.");
      return;
    }
    if (senha.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      await redefinir({ data: { token: search.token, novaSenha: senha } });
      toast.success("Senha redefinida! Entre com a nova senha.");
      navigate({ to: "/entrar" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível redefinir a senha");
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
          <h1 className="text-2xl font-bold tracking-tight">Nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Escolha uma nova senha para sua conta</p>
        </div>

        {!search.token ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-destructive shadow-card">
            Link inválido ou incompleto. Peça um novo em{" "}
            <Link to="/esqueci-senha" className="underline">
              Esqueci minha senha
            </Link>
            .
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <Input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Redefinir senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
