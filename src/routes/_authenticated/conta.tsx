import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Trash2 } from "lucide-react";
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
import { useServerFn } from "@tanstack/react-start";
import { excluirMinhaConta } from "@/lib/conta-exclusao.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const excluirConta = useServerFn(excluirMinhaConta);
  const [dialogExclusao, setDialogExclusao] = useState(false);
  const [modoExclusao, setModoExclusao] = useState<"recuperavel" | "definitiva">("recuperavel");
  const [confirmacao1, setConfirmacao1] = useState("");
  const [confirmacao2, setConfirmacao2] = useState("");

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

  const excluir = useMutation({
    mutationFn: () =>
      excluirConta({
        data: {
          modo: modoExclusao,
          confirmacao1: confirmacao1 as "DELETAR",
          confirmacao2: confirmacao2 as "Confirmo Delete",
        },
      }),
    onSuccess: async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/entrar", replace: true });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir a conta"),
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

        <Card className="border-destructive/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <Trash2 className="size-4" /> Excluir minha conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Você pode guardar uma cópia recuperável por 90 dias ou excluir a conta sem
              possibilidade de recuperação. Contas administrativas não podem usar esta opção.
            </p>
            <Button
              variant="destructive"
              disabled={isAdmin}
              title={isAdmin ? "Administradores não podem excluir a própria conta" : undefined}
              onClick={() => setDialogExclusao(true)}
            >
              Excluir minha conta
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogExclusao} onOpenChange={setDialogExclusao}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão da conta</DialogTitle>
            <DialogDescription>Esta ação encerra seu acesso imediatamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={modoExclusao === "recuperavel" ? "default" : "outline"} onClick={() => setModoExclusao("recuperavel")}>Guardar por 90 dias</Button>
              <Button variant={modoExclusao === "definitiva" ? "destructive" : "outline"} onClick={() => setModoExclusao("definitiva")}>Sem recuperação</Button>
            </div>
            <Field label='Digite "DELETAR"'>
              <Input value={confirmacao1} onChange={(e) => setConfirmacao1(e.target.value)} />
            </Field>
            <Field label='Digite "Confirmo Delete"'>
              <Input value={confirmacao2} onChange={(e) => setConfirmacao2(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogExclusao(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={confirmacao1 !== "DELETAR" || confirmacao2 !== "Confirmo Delete" || excluir.isPending} onClick={() => excluir.mutate()}>Excluir conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
