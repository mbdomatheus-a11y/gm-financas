import { InputSenha } from "@/components/ui/input-senha";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { definirSenhaProvisoria } from "@/lib/seguranca-conta.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/nova-senha")({
  head: () => ({
    meta: [
      { title: "Criar nova senha | Control ALL" },
      { name: "description", content: "Defina uma nova senha de acesso à sua conta." },
      { property: "og:title", content: "Criar nova senha | Control ALL" },
      { property: "og:description", content: "Defina uma nova senha de acesso à sua conta." },
    ],
  }),
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const alterarSenha = useServerFn(definirSenhaProvisoria);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (senha !== confirma) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (senha.length < 8) {
      toast.error("Use ao menos 8 caracteres para a nova senha");
      return;
    }

    setLoading(true);
    try {
      await alterarSenha({ data: { senha } });
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a senha");
      return;
    }
    await qc.invalidateQueries();
    setLoading(false);
    toast.success("Senha atualizada!");
    navigate({ to: "/inicio" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
      <div className="mb-8 space-y-3 text-center">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">Crie sua nova senha</h1>
        <p className="text-base text-muted-foreground">
          Troque a senha provisória para continuar.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border bg-card p-8 shadow-card"
      >
        <div className="space-y-2">
          <Label htmlFor="s1">Nova senha</Label>
          <InputSenha id="s1" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s2">Confirmar nova senha</Label>
          <InputSenha
            id="s2"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar e continuar
        </Button>
      </form>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="fixed right-4 top-4 gap-2 text-muted-foreground"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/entrar", replace: true });
        }}
      >
        <LogOut className="size-4" /> Sair
      </Button>
    </main>
  );
}
