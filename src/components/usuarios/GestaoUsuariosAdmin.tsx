import { adminReativarUsuario } from "@/lib/admin.functions";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { revogarAcessoMembro } from "@/lib/grupos.functions";
import {
  Clock3,
  KeyRound,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import { toast } from "sonner";

import { diasRestantes } from "@/components/ExclusaoAgendadaModal";
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
  adminListarUsuarios,
  adminResetPassword,
} from "@/lib/admin.functions";
import {
  adminAgendarExclusaoUsuario,
  adminCancelarExclusaoUsuario,
} from "@/lib/exclusao-agendada.functions";
import { maskCpf, onlyDigits, isValidCpf } from "@/lib/cpf";
import { formatDate } from "@/lib/format";
import { definirTempoInatividade, obterTempoInatividade } from "@/lib/inatividade.functions";

export function GestaoUsuariosAdmin() {
  const qc = useQueryClient();
  const revogarFn = useServerFn(revogarAcessoMembro);
  const revogarGrupo = useMutation({
    mutationFn: (userId: string) => revogarFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Acesso ao grupo revogado.");
      void qc.invalidateQueries({ queryKey: ["admin-roster"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível revogar."),
  });
  const { isSiteAdmin } = usePermissoes();
  const { data: perfis = [] } = useProfilesList();
  const { data: roles = [] } = useRolesList();

  const criar = useServerFn(adminCreateUser);
  const resetar = useServerFn(adminResetPassword);
  const listarRoster = useServerFn(adminListarUsuarios);
  const excluirUsuario = useServerFn(adminAgendarExclusaoUsuario);
  const cancelarExclusao = useServerFn(adminCancelarExclusaoUsuario);
  const obterTempo = useServerFn(obterTempoInatividade);
  const definirTempo = useServerFn(definirTempoInatividade);
  const { data: tempoSessao } = useQuery({
    queryKey: ["inatividade-minutos"],
    queryFn: () => obterTempo(),
  });
  const [tempoDigitado, setTempoDigitado] = useState<string | null>(null);
  const salvarTempo = useMutation({
    mutationFn: () =>
      definirTempo({ data: { minutos: Number(tempoDigitado ?? tempoSessao?.minutos ?? 5) } }),
    onSuccess: () => {
      toast.success("Prazo de inatividade atualizado para todos os usuários.");
      setTempoDigitado(null);
      qc.invalidateQueries({ queryKey: ["inatividade-minutos"] });
    },
    onError: (erro: any) => toast.error(erro.message ?? "Não foi possível alterar o prazo."),
  });

  const { data: roster = [], isLoading: carregandoRoster } = useQuery({
    queryKey: ["admin-roster"],
    enabled: isSiteAdmin,
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
      toast.success("Senha redefinida. O usuário deverá trocá-la no próximo acesso.");
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

  const reativarUsuario = useServerFn(adminReativarUsuario);
  const toggleAtivo = useMutation({
    // Pelo servidor: ao reativar também tira o bloqueio de acesso (conta bloqueada pelo titular).
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await reativarUsuario({ data: { userId: id, ativo } });
    },
    onSuccess: (_r, v) => {
      toast.success(v.ativo ? "Usuário reativado." : "Usuário desativado.");
      qc.invalidateQueries();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível alterar. Só a administração do site pode ativar ou desativar contas.");
      qc.invalidateQueries();
    },
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
      toast.success("Exclusão agendada. A conta será removida em 90 dias, e o usuário pode cancelar ao entrar.");
      setExcluir(null);
      setConfirmacao1("");
      setConfirmacao2("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível agendar a exclusão"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-muted-foreground">{perfis.length} usuário(s) cadastrado(s)</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" /> Novo usuário
        </Button>
      </div>
      <div className="grid gap-4">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-base font-bold">
                <Users2 className="size-4 text-muted-foreground" aria-hidden="true" /> Cadastro de todos os usuários
              </p>
              <p className="text-sm text-muted-foreground">
                Só nome, CPF e contato. Os dados financeiros ficam visíveis apenas dentro de cada grupo.
              </p>
            </div>
            {carregandoRoster ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <div className="max-h-[70vh] divide-y overflow-y-auto rounded-2xl border">
                {roster.map((u: any) => (
                  <div key={u.id} className="px-4 py-3 text-xs transition-colors hover:bg-muted/40">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(u.nome ?? "").trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium">{u.nome}</span>
                          <Badge
                            variant={u.ativo ? "secondary" : "destructive"}
                            className="shrink-0 rounded-full text-xs font-medium"
                          >
                            {u.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <p className="truncate text-muted-foreground">{u.email || "sem e-mail"}</p>
                        <p className="tabular-nums text-muted-foreground">
                          CPF {u.cpfMascarado}
                          {u.telefone ? ` · ${u.telefone}` : ""}
                        </p>
                        <p className="text-muted-foreground">
                          Grupo {u.grupoNome ?? "não definido"} · desde <span className="tabular-nums">{formatDate(u.criadoEm)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 pl-12">
                      <Badge
                        variant={u.role === "admin" ? "default" : "outline"}
                        className="mr-auto rounded-full text-xs font-medium"
                      >
                        {u.role === "admin" ? "Administrador" : "Usuário comum"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={u.ativo ? "outline" : "default"}
                        className="h-7 text-xs"
                        disabled={toggleAtivo.isPending || u.role === "admin"}
                        title={
                          u.role === "admin"
                            ? "Contas administrativas não podem ser inativadas aqui"
                            : u.ativo
                              ? "Bloqueia o login desta pessoa"
                              : "Libera o login desta pessoa"
                        }
                        onClick={() => {
                          const acao = u.ativo ? "bloquear o login" : "reativar a conta";
                          if (window.confirm(`Tem certeza que quer ${acao} de ${u.nome}?`))
                            toggleAtivo.mutate({ id: u.id, ativo: !u.ativo });
                        }}
                      >
                        {u.ativo ? "Bloquear login" : "Reativar conta"}
                      </Button>
                      {u.grupoId && roster.filter((r: any) => r.grupoId === u.grupoId).length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={revogarGrupo.isPending}
                          title="Tira esta pessoa do grupo compartilhado (o dono do grupo não pode ser removido)"
                          onClick={() => {
                            if (window.confirm(`Revogar o acesso de ${u.nome} ao grupo compartilhado?`))
                              revogarGrupo.mutate(u.id);
                          }}
                        >
                          Revogar do grupo
                        </Button>
                      )}
                      {u.exclusaoPrevistaEm && (
                        <Badge variant="destructive" className="rounded-full text-xs font-medium tabular-nums">
                          Exclusão em {diasRestantes(u.exclusaoPrevistaEm)} dias
                        </Badge>
                      )}
                      {u.exclusaoPrevistaEm ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!u.solicitanteEhPrincipal}
                          onClick={async () => {
                            try {
                              await cancelarExclusao({ data: { userId: u.id } });
                              toast.success("Exclusão cancelada.");
                              qc.invalidateQueries();
                            } catch (e: any) {
                              toast.error(e.message ?? "Não foi possível cancelar");
                            }
                          }}
                        >
                          Cancelar exclusão
                        </Button>
                      ) : (
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 space-y-3">
        <div className="space-y-1">
          <p className="text-base font-bold">Usuários do seu grupo</p>
          <p className="text-sm text-muted-foreground">Acesso, nome e senha de cada pessoa.</p>
        </div>
        <div className="divide-y rounded-2xl border bg-card">
        {perfis.map((p: any) => {
          const role = roleDe(p.id);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(p.nome ?? "").trim().charAt(0).toUpperCase() || <Users className="size-4" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      CPF {maskCpf(p.cpf)}
                      {p.senha_temporaria ? " · senha temporária pendente" : ""}
                    </p>
                  </div>
                  <Badge className="rounded-full text-xs font-medium" variant={role === "admin" ? "default" : "secondary"}>
                    {role === "admin" ? "Administrador" : "Comum"}
                  </Badge>
                  <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    aria-label={`Editar nome de ${p.nome}`}
                    title="Editar nome"
                    onClick={() => setEditar({ id: p.id, nome: p.nome })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    aria-label={`Redefinir senha de ${p.nome}`}
                    title="Redefinir senha"
                    onClick={() => setReset({ id: p.id, nome: p.nome })}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                    <Switch
                      className="ml-2"
                      aria-label={`Conta de ${p.nome} ativa`}
                      checked={p.ativo}
                      onCheckedChange={(v) => toggleAtivo.mutate({ id: p.id, ativo: v })}
                    />
                  </div>
            </div>
          );
        })}
        </div>
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
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
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
              Anote e entregue esta senha ao usuário agora. Ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <p className="select-all rounded-2xl border bg-muted/60 px-4 py-4 text-center font-mono text-lg tracking-wider">
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
            <DialogTitle>Agendar exclusão da conta de {excluir?.nome}</DialogTitle>
            <DialogDescription>
              A conta e todos os dados serão removidos em 90 dias. Até lá a pessoa continua
              entrando, vê um aviso com o tempo restante e pode cancelar a exclusão. Contas
              administrativas nunca podem ser excluídas por esta tela.
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
            <Button variant="outline" onClick={() => setExcluir(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={
                confirmacao1 !== "DELETAR" ||
                confirmacao2 !== "Confirmo Delete" ||
                excluirMutation.isPending
              }
              onClick={() => excluirMutation.mutate()}
            >
              Agendar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
