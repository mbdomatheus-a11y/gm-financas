import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/AppLayout";
import { ConvitesCard } from "@/components/ConvitesCard";
import { PermissoesUsuariosCard } from "@/components/PermissoesUsuariosCard";
import { Field } from "@/routes/_authenticated/receitas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, usePermissoes } from "@/hooks/useAuthData";
import { maskCpf } from "@/lib/cpf";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Control ALL" },
      {
        name: "description",
        content: "Veja seus dados de acesso, altere sua senha e encerre a sessão com segurança.",
      },
      { property: "og:title", content: "Minha conta — Control ALL" },
      { property: "og:description", content: "Dados de acesso e segurança da sua conta." },
    ],
  }),
  component: ContaPage,
});

function ContaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: perfil } = useProfile();
  const { isAdmin } = usePermissoes();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");

  const alterar = useMutation({
    mutationFn: async () => {
      if (senha.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres");
      if (senha !== confirma) throw new Error("As senhas não conferem");
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      if (perfil?.id) {
        await supabase.from("profiles").update({ senha_temporaria: false }).eq("id", perfil.id);
      }
    },
    onSuccess: () => {
      toast.success("Senha atualizada");
      setSenha("");
      setConfirma("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/entrar", replace: true });
  }

  return (
    <AppLayout title="Minha conta" description="Dados de acesso e segurança">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Seus dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{perfil?.nome ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPF</span>
              <span className="font-medium">{perfil?.cpf ? maskCpf(perfil.cpf) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Perfil</span>
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {isAdmin ? "Administrador" : "Usuário comum"}
              </Badge>
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={sair}>
              <LogOut className="size-4" /> Sair da conta
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4" /> Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nova senha">
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Field>
            <Field label="Confirmar nova senha">
              <Input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
              />
            </Field>
            <Button
              className="w-full"
              onClick={() => alterar.mutate()}
              disabled={alterar.isPending}
            >
              Salvar nova senha
            </Button>
          </CardContent>
        </Card>

        <ConvitesCard />
        {isAdmin && <PermissoesUsuariosCard compact />}
      </div>
    </AppLayout>
  );
}
