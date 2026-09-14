import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { cpfToEmail, isValidCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Control ALL" },
      {
        name: "description",
        content:
          "Acesse o painel de finanças pessoais do casal: receitas, despesas, parcelas, cartões e investimentos em um só lugar.",
      },
      { property: "og:title", content: "Entrar — Control ALL" },
      {
        property: "og:description",
        content: "Controle compartilhado de receitas, despesas, parcelamentos e investimentos.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido");
      return;
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cpfToEmail(cpf),
      password: senha,
    });
    setLoading(false);
    if (error || !data.user) {
      toast.error("CPF ou senha incorretos");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("senha_temporaria, ativo")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.ativo === false) {
      await supabase.auth.signOut();
      toast.error("Usuário inativo. Fale com um administrador.");
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: profile?.senha_temporaria ? "/nova-senha" : "/inicio" });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="gradient-brand mb-4 flex size-14 items-center justify-center rounded-2xl shadow-soft">
            <Wallet className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Control ALL</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com seu CPF para acessar o painel
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
        >
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              autoComplete="username"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              className="h-11"
            />
            {cpf.length > 0 && onlyDigits(cpf).length === 11 && !isValidCpf(cpf) && (
              <p className="text-xs text-destructive">CPF inválido</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Entrar
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
                Esqueci minha senha
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Recuperação de senha</DialogTitle>
                <DialogDescription>
                  Como o acesso é feito por CPF (sem e-mail cadastrado), a redefinição é feita por
                  um administrador. Peça a um admin para abrir <strong>Usuários e Privilégios</strong>{" "}
                  e redefinir sua senha — você receberá uma senha provisória e será obrigado a criar
                  uma nova no próximo login.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </form>
      </div>
    </main>
  );
}
