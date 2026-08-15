import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/nova-senha")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — Finanças do Casal" },
      { name: "description", content: "Defina uma nova senha de acesso à sua conta." },
      { property: "og:title", content: "Criar nova senha — Finanças do Casal" },
      { property: "og:description", content: "Defina uma nova senha de acesso à sua conta." },
    ],
  }),
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
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
    if (senha === "admin123") {
      toast.error("Escolha uma senha diferente da provisória");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("profiles").update({ senha_temporaria: false }).eq("id", user!.id);
    await qc.invalidateQueries();
    setLoading(false);
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-card"
      >
        <div className="flex flex-col items-center text-center">
          <div className="gradient-brand mb-3 flex size-12 items-center justify-center rounded-2xl">
            <KeyRound className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Crie sua nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Por segurança, é necessário substituir a senha provisória antes de usar o app.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="s1">Nova senha</Label>
          <Input id="s1" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s2">Confirmar nova senha</Label>
          <Input
            id="s2"
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar e continuar
        </Button>
      </form>
    </main>
  );
}
