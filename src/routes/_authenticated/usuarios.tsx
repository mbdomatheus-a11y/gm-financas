import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
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
import { usePermissoes, type Modulo } from "@/hooks/useAuthData";
import { adminCreateUser, adminResetPassword, adminSetRole } from "@/lib/admin.functions";
import { maskCpf, onlyDigits, isValidCpf } from "@/lib/cpf";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e Privilégios — Finanças do Casal" },
      {
        name: "description",
        content: "Área administrativa para criar usuários, definir privilégios e redefinir senhas.",
      },
      { property: "og:title", content: "Usuários e Privilégios — Finanças do Casal" },
      { property: "og:description", content: "Gestão de acessos e permissões por módulo." },
    ],
  }),
  component: UsuariosPage,
});

const MODULOS: { key: Modulo; label: string }[] = [
  { key: "receitas", label: "Receitas" },
  { key: "despesas", label: "Despesas" },
  { key: "cartoes", label: "Cartões e Bancos" },
  { key: "investimentos", label: "Investimentos" },
  { key: "compartilhar", label: "Compartilhar" },
  { key: "personalizacao", label: "Personalização" },
];

function UsuariosPage() {
  const qc = useQueryClient();
  const { isAdmin } = usePermissoes();
  const { data: perfis = [] } = useProfilesList();
  const { data: roles = [] } = useRolesList();

  const criar = useServerFn(adminCreateUser);
  const resetar = useServerFn(adminResetPassword);
  const setRole = useServerFn(adminSetRole);

  const [open, setOpen] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: "", cpf: "", role: "comum" });
  const [reset, setReset] = useState<{ id: string; nome: string } | null>(null);
  const [senha, setSenha] = useState("");
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [editar, setEditar] = useState<{ id: string; nome: string } | null>(null);

  const { data: permissoes = [] } = useQuery({
    queryKey: ["permissoes-todas"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("permissoes").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const roleDe = (id: string) => roles.find((r: any) => r.user_id === id)?.role ?? "comum";
  const permDe = (id: string, modulo: string) =>
    permissoes.find((p: any) => p.user_id === id && p.modulo === modulo);

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

  const alterarRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "admin" | "comum" }) =>
      setRole({ data: { userId: id, role } }),
    onSuccess: () => {
      toast.success("Privilégio atualizado");
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

  const salvarPermissao = useMutation({
    mutationFn: async (row: {
      user_id: string;
      modulo: string;
      pode_ver: boolean;
      pode_editar: boolean;
      pode_excluir: boolean;
    }) => {
      const { error } = await supabase
        .from("permissoes")
        .upsert(row, { onConflict: "user_id,modulo" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissoes-todas"] }),
    onError: (e: any) => toast.error(e.message),
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
      <div className="space-y-3">
        {perfis.map((p: any) => {
          const role = roleDe(p.id);
          const aberto = detalhe === p.id;
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      alterarRole.mutate({ id: p.id, role: role === "admin" ? "comum" : "admin" })
                    }
                  >
                    <ShieldCheck className="size-4" />
                    {role === "admin" ? "Tornar comum" : "Tornar administrador"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDetalhe(aberto ? null : p.id)}>
                    {aberto ? "Ocultar privilégios" : "Editar privilégios"}
                  </Button>
                </div>

                {aberto && (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left font-medium">Módulo</th>
                          <th className="p-2 font-medium">Ver</th>
                          <th className="p-2 font-medium">Editar</th>
                          <th className="p-2 font-medium">Excluir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MODULOS.map((m) => {
                          const row = permDe(p.id, m.key);
                          const atual = {
                            user_id: p.id,
                            modulo: m.key,
                            pode_ver: row?.pode_ver ?? true,
                            pode_editar: row?.pode_editar ?? true,
                            pode_excluir: row?.pode_excluir ?? false,
                          };
                          return (
                            <tr key={m.key} className="border-t">
                              <td className="p-2">{m.label}</td>
                              {(["pode_ver", "pode_editar", "pode_excluir"] as const).map((campo) => (
                                <td key={campo} className="p-2 text-center">
                                  <Switch
                                    checked={atual[campo]}
                                    onCheckedChange={(v) =>
                                      salvarPermissao.mutate({ ...atual, [campo]: v })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Nome completo">
              <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
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
    </AppLayout>
  );
}
