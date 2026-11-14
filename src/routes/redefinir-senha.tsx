import { InputSenha } from "@/components/ui/input-senha";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft } from "lucide-react";
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
      { title: "Nova senha | Control ALL" },
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
      toast.error("Link inválido. Peça um novo em Esqueci minha senha.");
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
      <div className="w-full max-w-md">
        <Link
          to="/entrar"
          className="mb-10 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar para o login
        </Link>

        <div className="mb-8 space-y-3 text-center">
          <h1 className="text-4xl font-extrabold tracking-[-0.03em]">Nova senha</h1>
          <p className="text-base text-muted-foreground">Use pelo menos 8 caracteres.</p>
        </div>

        {!search.token ? (
          <p className="rounded-3xl border bg-card p-8 text-center text-sm text-destructive shadow-card">
            Link inválido ou incompleto. Peça um novo em{" "}
            <Link to="/esqueci-senha" className="underline">
              Esqueci minha senha
            </Link>
            .
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border bg-card p-8 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <InputSenha
                id="senha"
                name="new-password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <InputSenha
                id="confirmar"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Redefinir senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
