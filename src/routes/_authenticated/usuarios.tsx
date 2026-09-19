import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, ShieldCheck, Trash2, UserPlus, Users, Users2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { ConvitesCard } from "@/components/ConvitesCard";
import { AdminConvitesCard } from "@/components/AdminConvitesCard";
import { PermissoesUsuariosCard } from "@/components/PermissoesUsuariosCard";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProfilesList, useRolesList } from "@/hooks/useFinance";
import { usePermissoes } from "@/hooks/useAuthData";
import {
  adminCreateUser,
  adminExcluirUsuario,
  adminListarUsuarios,
  adminResetPassword,
} from "@/lib/admin.functions";
import { maskCpf, onlyDigits, isValidCpf } from "@/lib/cpf";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e Privilégios — Control ALL" },
      {
        name: "description",
        content: "Área administrativa para criar usuários, definir privilégios e redefinir senhas.",
      },
      { property: "og:title", content: "Usuários e Privilégios — Control ALL" },
      { property: "og:description", content: "Gestão de acessos e permissões por módulo." },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const qc = useQueryClient();
  const { isAdmin } = usePermissoes();
  const { data: perfis = [] } = useProfilesList();
  const { data: roles = [] } = useRolesList();

  const criar = useServerFn(adminCreateUser);
  const resetar = useServerFn(adminResetPassword);
  const listarRoster = useServerFn(adminListarUsuarios);
  const excluirUsuario = useServerFn(adminExcluirUsuario);

  const { data: roster = [], isLoading: carregandoRoster } = useQuery({
    queryKey: ["admin-roster"],
    enabled: isAdmin,
    queryFn: async () => listarRoster(),
  });

  const [open, setOpen] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: "", cpf: "", role: "comum" });
  const [reset, setReset] = useState<{ id: string; nome: string } | null>(null);
  const [senha, setSenha] = useState("");
  const [editar, setEditar] = useState<{ id: string; nome: string } | null>(null);
  const [excluir, setExcluir] = useState<{ id: string; nome: string } | null>(null);
  const [confirmacao1, setConfirmacao1] = useState("");
  const [confirmacao2, setConfirmacao2] = useState("");

  const roleDe = (id: string) => roles.find((r: any) => r.user_id === id)?.role ?? "comum";

  const criarUsuario = useMutation({
    mutationFn: async () => {
      const cpf = onlyDigits(novo.cpf);
      if (!isValidCpf(cpf)) throw new Error("CPF inválido");
      if (novo.nome.trim().length < 2) throw new Error("Informe o nome completo");
      return await criar({
        data: { nome: novo.nome.trim(), cpf, role: novo.role as "admin" | "comum" },
      });
    },
    onSuccess: (res: any) => {
      toast.success("Usuário criado");
      setSenhaGerada(res?.senhaTemporaria ?? null);
      setOpen(false);
      setNovo({ nome: "", cpf: "", role: "comum" });
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar usuário"),
  });

  const redefinir = useMutation({
    mutationFn: async () => {
      if (!reset) return;
      if (senha.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres");
      await resetar({ data: { userId: reset.id, senha } });
    },
    onSuccess: () => {
      toast.success("Senha redefinida — o usuário deverá trocá-la no próximo acesso");
      setReset(null);
      setSenha("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const salvarNome = useMutation({
    mutationFn: async () => {
      if (!editar) return;
      const nome = editar.nome.trim();
      if (nome.length < 2) throw new Error("Informe o nome completo");
      const { error } = await supabase.from("profiles").update({ nome }).eq("id", editar.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nome atualizado");
      setEditar(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("profiles").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const excluirMutation = useMutation({
    mutationFn: async () => {
      if (!excluir) return;
      await excluirUsuario({
        data: {
          userId: excluir.id,
          confirmacao1: confirmacao1 as "DELETAR",
          confirmacao2: confirmacao2 as "Confirmo Delete",
        },
      });
    },
    onSuccess: () => {
      toast.success("Conta excluída. A cópia para recuperação ficará disponível por 90 dias.");
      setExcluir(null);
      setConfirmacao1("");
      setConfirmacao2("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir a conta"),
  });

  if (!isAdmin) {
    return (
      <AppLayout title="Usuários e Privilégios">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Esta área é restrita aos administradores do casal.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Usuários e Privilégios"
      description={`${perfis.length} usuário(s) cadastrado(s)`}
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" /> Novo usuário
        </Button>
      }
    >
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ConvitesCard />

        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users2 className="size-4" /> Cadastro de todos os usuários
            </p>
            <p className="text-xs text-muted-foreground">
              Só cadastro (nome, CPF, contato) — os dados financeiros de cada grupo continuam
              visíveis só pra quem está naquele grupo.
            </p>
            {carregandoRoster ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {roster.map((u: any) => (
                  <div key={u.id} className="rounded-lg border px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{u.nome}</span>
                      <Badge
                        variant={u.ativo ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {u.ativo ? "ativo" : "inativo"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      CPF {u.cpfMascarado}
                      {u.email ? ` · ${u.email}` : ""}
                      {u.telefone ? ` · ${u.telefone}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Grupo: {u.grupoNome ?? "—"} · desde {formatDate(u.criadoEm)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-[10px]">
                        {u.role === "admin" ? "Administrador" : "Usuário comum"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        disabled={!u.solicitanteEhPrincipal || u.role === "admin"}
                        title={
                          u.role === "admin"
                            ? "Contas administrativas não podem ser excluídas"
                            : !u.solicitanteEhPrincipal
                              ? "Somente o administrador principal pode excluir usuários"
                              : "Excluir usuário"
                        }
                        onClick={() => setExcluir({ id: u.id, nome: u.nome })}
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 space-y-3">
        {perfis.map((p: any) => {
          const role = roleDe(p.id);
          return (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      CPF {maskCpf(p.cpf)}
                      {p.senha_temporaria ? " · senha temporária pendente" : ""}
                    </p>
                  </div>
                  <Badge variant={role === "admin" ? "default" : "secondary"}>
                    {role === "admin" ? "Administrador" : "Comum"}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch
                      checked={p.ativo}
                      onCheckedChange={(v) => toggleAtivo.mutate({ id: p.id, ativo: v })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditar({ id: p.id, nome: p.nome })}
                  >
                    <Pencil className="size-4" /> Editar nome
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReset({ id: p.id, nome: p.nome })}
                  >
                    <KeyRound className="size-4" /> Redefinir senha
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-4">
        <AdminConvitesCard />
      </div>

      <PermissoesUsuariosCard />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Nome completo">
              <Input
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              />
            </Field>
            <Field label="CPF">
              <Input
                inputMode="numeric"
                value={maskCpf(novo.cpf)}
                onChange={(e) => setNovo({ ...novo, cpf: onlyDigits(e.target.value).slice(0, 11) })}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="Privilégio">
              <Select value={novo.role} onValueChange={(v) => setNovo({ ...novo, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comum">Usuário comum</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Uma senha provisória única será gerada e exibida uma única vez após a criação. O
              usuário precisará definir a própria senha no primeiro acesso.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => criarUsuario.mutate()} disabled={criarUsuario.isPending}>
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!senhaGerada} onOpenChange={(o) => !o && setSenhaGerada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha provisória</DialogTitle>
            <DialogDescription>
              Anote e entregue esta senha ao usuário agora — ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <p className="select-all rounded-lg border bg-muted/60 px-3 py-3 text-center font-mono text-lg">
            {senhaGerada}
          </p>
          <DialogFooter>
            <Button onClick={() => setSenhaGerada(null)}>Já anotei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir senha de {reset?.nome}</DialogTitle>
          </DialogHeader>
          <Field label="Nova senha temporária">
            <Input
              type="text"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => redefinir.mutate()} disabled={redefinir.isPending}>
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editar} onOpenChange={(o) => !o && setEditar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nome</DialogTitle>
          </DialogHeader>
          <Field label="Nome completo">
            <Input
              value={editar?.nome ?? ""}
              onChange={(e) => setEditar(editar ? { ...editar, nome: e.target.value } : null)}
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => salvarNome.mutate()} disabled={salvarNome.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir a conta de {excluir?.nome}</DialogTitle>
            <DialogDescription>
              O acesso será removido e uma cópia recuperável do cadastro ficará guardada por
              90 dias. Contas administrativas nunca podem ser excluídas por esta tela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label='Digite "DELETAR"'>
              <Input value={confirmacao1} onChange={(e) => setConfirmacao1(e.target.value)} />
            </Field>
            <Field label='Digite "Confirmo Delete"'>
              <Input value={confirmacao2} onChange={(e) => setConfirmacao2(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluir(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={
                confirmacao1 !== "DELETAR" ||
                confirmacao2 !== "Confirmo Delete" ||
                excluirMutation.isPending
              }
              onClick={() => excluirMutation.mutate()}
            >
              Excluir conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
