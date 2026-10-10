import { HistoricoConvitesGrupo, SairDoGrupoCard } from "@/components/ConvitesGrupo";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Car, LogOut, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/AppLayout";
import { ConvitesCard } from "@/components/ConvitesCard";
import { ConviteAmigosBanner } from "@/components/ConviteAmigosBanner";
import { PermissoesUsuariosCard } from "@/components/PermissoesUsuariosCard";
import { ConciliacaoFaturasCard } from "@/components/ConciliacaoFaturasCard";
import { IaLancamentoModoGrupoCard } from "@/components/IaLancamentoModoGrupoCard";
import { Field } from "@/routes/_authenticated/receitas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { ExcluirContaCard } from "@/components/ExcluirContaCard";
import { useProfile, usePermissoes, useModulosGlobais } from "@/hooks/useAuthData";
import { maskCpf, onlyDigits } from "@/lib/cpf";
import { useServerFn } from "@tanstack/react-start";
import { alterarMinhaSenha, atualizarMeusDados } from "@/lib/seguranca-conta.functions";
import {
  aceitarConviteGrupo,
  convidarParaMeuGrupo,
  listarMembrosMeuGrupo,
  revogarAcessoMembro,
} from "@/lib/grupos.functions";
import { usePreferencias } from "@/hooks/usePreferencias";
import { proximaVirada } from "@/lib/periodo-vigente";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/conta")({
  validateSearch: (s: Record<string, unknown>): { conviteGrupo?: string } =>
    typeof s["conviteGrupo"] === "string" ? { conviteGrupo: s["conviteGrupo"] } : {},
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
  const { conviteGrupo } = Route.useSearch();
  const qc = useQueryClient();
  const { data: perfil } = useProfile();
  const { isAdmin, isSiteAdmin } = usePermissoes();
  // Item 13 (2026-10-05): a opção de destaque do Veículo só existe se o módulo
  // Veículo estiver ativo para quem está logado (admin vê o mesmo que o usuário).
  const { habilitado: moduloHabilitado } = useModulosGlobais();
  const moduloVeiculoAtivo = moduloHabilitado("veiculo");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const alterarSenha = useServerFn(alterarMinhaSenha);
  const convidarGrupo = useServerFn(convidarParaMeuGrupo);
  const aceitarGrupo = useServerFn(aceitarConviteGrupo);
  const [emailGrupo, setEmailGrupo] = useState("");

  const atualizarDados = useServerFn(atualizarMeusDados);
  const [editandoDados, setEditandoDados] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formDataNascimento, setFormDataNascimento] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formHorasMes, setFormHorasMes] = useState("160");

  // Item 5 (backlog 2026-09-27): "mês do sistema" — dia de virada customizado
  // usado por `useCompetenciaVigente()` no Dashboard e na Início. Sem
  // configuração salva (dia_virada null), o comportamento é o mês calendário
  // normal, igual a antes desta funcionalidade existir.
  const { prefs: preferencias, save: salvarPreferencias } = usePreferencias();
  const [usarDiaVirada, setUsarDiaVirada] = useState(false);
  const [diaViradaInput, setDiaViradaInput] = useState("");

  useEffect(() => {
    setUsarDiaVirada(preferencias.dia_virada != null);
    setDiaViradaInput(preferencias.dia_virada != null ? String(preferencias.dia_virada) : "");
  }, [preferencias.dia_virada]);

  const salvarMesSistema = () => {
    if (!usarDiaVirada) {
      salvarPreferencias.mutate(
        { dia_virada: null },
        { onSuccess: () => toast.success("Mês do sistema voltou ao calendário normal.") },
      );
      return;
    }
    const dia = Number(diaViradaInput);
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
      toast.error("Informe um dia de virada entre 1 e 28.");
      return;
    }
    salvarPreferencias.mutate(
      { dia_virada: dia },
      { onSuccess: () => toast.success("Mês do sistema atualizado.") },
    );
  };

  // Bloco 7 (plano-mega-2026-09-14.md): destaque da soma do módulo Veículo
  // no card "Veículo" da Início — preferência de perfil, desligada por padrão.
  const [destacarVeiculo, setDestacarVeiculo] = useState(false);
  useEffect(() => {
    setDestacarVeiculo(!!preferencias.destacar_veiculo_inicio);
  }, [preferencias.destacar_veiculo_inicio]);

  function salvarDestaqueVeiculo(valor: boolean) {
    setDestacarVeiculo(valor);
    salvarPreferencias.mutate(
      { destacar_veiculo_inicio: valor },
      {
        onSuccess: () =>
          toast.success(
            valor
              ? "Soma do Veículo agora aparece destacada na Início."
              : "Destaque do Veículo desativado.",
          ),
      },
    );
  }

  useEffect(() => {
    if (perfil) {
      setFormNome(perfil.nome ?? "");
      setFormEmail(perfil.email ?? "");
      setFormTelefone(perfil.telefone ?? "");
      setFormDataNascimento(perfil.data_nascimento ?? "");
      setFormCpf(perfil.cpf ? maskCpf(perfil.cpf) : "");
      setFormHorasMes(String((perfil as any)?.horas_trabalho_mes ?? 160));
    }
  }, [perfil]);

  const salvarDados = useMutation({
    mutationFn: async () => {
      await atualizarDados({
        data: {
          nome: formNome,
          email: formEmail,
          telefone: formTelefone || null,
          dataNascimento: formDataNascimento || null,
          cpf: formCpf ? onlyDigits(formCpf) : null,
          horasTrabalhoMes: Number(formHorasMes) || 160,
        },
      });
    },
    onSuccess: () => {
      toast.success("Dados cadastrais atualizados com sucesso.");
      setEditandoDados(false);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível atualizar os dados."),
  });

  const alterar = useMutation({
    mutationFn: async () => {
      if (!senhaAtual) throw new Error("Informe sua senha atual");
      if (senha.length < 8) throw new Error("A nova senha deve ter ao menos 8 caracteres");
      if (senha !== confirma) throw new Error("As senhas não conferem");
      await alterarSenha({ data: { senhaAtual, senha } });
    },
    onSuccess: () => {
      toast.success("Senha atualizada com sucesso");
      setSenhaAtual("");
      setSenha("");
      setConfirma("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const enviarConviteGrupo = useMutation({
    mutationFn: () => convidarGrupo({ data: { email: emailGrupo } }),
    onSuccess: (r) => {
      setEmailGrupo("");
      if (r.emailEnviado) {
        toast.success("Convite de workspace enviado por e-mail.");
      } else if (r.link) {
        void navigator.clipboard?.writeText(r.link).catch(() => {});
        toast.warning(
          "O e-mail não pôde ser enviado, mas o convite foi criado. O link foi copiado: envie para a pessoa por outro meio (ex.: WhatsApp). Vale por 7 dias.",
          { duration: 20000 },
        );
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const confirmarGrupo = useMutation({
    mutationFn: () => aceitarGrupo({ data: { token: conviteGrupo! } }),
    onSuccess: () => {
      toast.success("Workspace integrado. Recarregando dados…");
      qc.clear();
      window.location.assign("/inicio");
    },
    onError: (e) => toast.error(e.message),
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
        <ConviteAmigosBanner className="lg:col-span-2" />
        {conviteGrupo && (
          <Card className="border-primary lg:col-span-2">
            <CardHeader>
              <CardTitle>Convite para workspace integrado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ao aceitar, você passa a fazer parte do mesmo grupo de quem convidou. A visão dos
                módulos compartilhados será única para todos os integrantes. Seu workspace atual fica guardado, sem alterações, e volta se você sair do grupo. Se seu workspace atual tiver outras pessoas, a união será bloqueada para protegê-las.
              </p>
              <Button onClick={() => confirmarGrupo.mutate()} disabled={confirmarGrupo.isPending}>
                Aceitar e integrar workspace
              </Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Meu grupo compartilhado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Convide uma pessoa que já possui conta. Ela verá claramente que o workspace passará a
              ser único antes de aceitar.
            </p>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
              <strong>Atenção:</strong> quem aceitar o convite passa a ver todos os dados desta conta
              (lançamentos, notas, cartões e demais módulos) e pode alterá-los. Convide só pessoas da
              sua confiança. Você pode revogar o acesso a qualquer momento abaixo.
            </p>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={emailGrupo}
              onChange={(e) => setEmailGrupo(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!emailGrupo.includes("@") || enviarConviteGrupo.isPending}
              onClick={() => enviarConviteGrupo.mutate()}
            >
              Enviar convite para integrar grupo
            </Button>
            <SairDoGrupoCard />
            <MembrosGrupo />
            <HistoricoConvitesGrupo />
          </CardContent>
        </Card>
        <ConciliacaoFaturasCard />
        {isAdmin && <IaLancamentoModoGrupoCard />}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Seus dados cadastrais</CardTitle>
            {!editandoDados ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => setEditandoDados(true)}
              >
                <Pencil className="size-3.5" /> Editar dados
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setEditandoDados(false)}
              >
                Cancelar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!editandoDados ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{perfil?.nome ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail</span>
                  <span className="font-medium">{perfil?.email ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone</span>
                  <span className="font-medium">{perfil?.telefone ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nascimento</span>
                  <span className="font-medium">
                    {perfil?.data_nascimento
                      ? new Date(perfil.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CPF</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {perfil?.cpf ? maskCpf(perfil.cpf) : "Não cadastrado"}
                    </span>
                    {perfil?.cpf ? (
                      <Badge variant="outline" className="border-success/40 text-[10px] text-success">
                        Login por CPF ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Opcional
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground">Jornada mensal de trabalho</span>
                    <p className="text-[11px] text-muted-foreground">
                      Base p/ cálculo de valor da hora na Lista de Compras
                    </p>
                  </div>
                  <span className="font-medium">
                    {(perfil as any)?.horas_trabalho_mes ?? 160}h / mês
                  </span>
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
              </>
            ) : (
              <div className="space-y-3">
                <Field label="Nome completo">
                  <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
                </Field>
                <Field label="E-mail de acesso">
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </Field>
                <Field label="Telefone / WhatsApp">
                  <Input
                    value={formTelefone}
                    onChange={(e) => setFormTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </Field>
                <Field label="Data de nascimento">
                  <Input
                    type="date"
                    value={formDataNascimento}
                    onChange={(e) => setFormDataNascimento(e.target.value)}
                  />
                </Field>
                <Field label="CPF (para habilitar login com CPF)">
                  <Input
                    inputMode="numeric"
                    value={maskCpf(formCpf)}
                    onChange={(e) => setFormCpf(onlyDigits(e.target.value).slice(0, 11))}
                    placeholder="000.000.000-00 (opcional)"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Ao salvar seu CPF, você pode utilizá-lo para acessar sua conta na tela de login.
                  </p>
                </Field>
                <Field label="Carga horária mensal de trabalho (horas/mês)">
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={formHorasMes}
                    onChange={(e) => setFormHorasMes(e.target.value)}
                    placeholder="160"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Usado para converter o custo de itens da Lista de Compras em tempo de trabalho (padrão: 160h).
                  </p>
                </Field>
                <Button
                  className="w-full"
                  onClick={() => salvarDados.mutate()}
                  disabled={salvarDados.isPending || !formNome.trim() || !formEmail.trim()}
                >
                  {salvarDados.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4" /> Mês do sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Por padrão, o Dashboard e a Início consideram o mês calendário (1º ao último dia). Se
              o seu ciclo financeiro não coincide com o calendário — por exemplo, seu cartão fecha
              todo dia 10 — configure um dia de virada: a partir dele, essas telas já passam a
              tratar o mês seguinte como "mês atual".
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!usarDiaVirada ? "default" : "outline"}
                size="sm"
                onClick={() => setUsarDiaVirada(false)}
              >
                Mês calendário normal
              </Button>
              <Button
                type="button"
                variant={usarDiaVirada ? "default" : "outline"}
                size="sm"
                onClick={() => setUsarDiaVirada(true)}
              >
                Dia de virada customizado
              </Button>
            </div>
            {usarDiaVirada && (
              <Field label="Dia de virada (1 a 28)">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={diaViradaInput}
                  onChange={(e) => setDiaViradaInput(e.target.value)}
                  className="max-w-[120px]"
                />
              </Field>
            )}
            {preferencias.dia_virada != null && (
              <p className="text-xs text-muted-foreground">
                Próxima virada:{" "}
                {proximaVirada(new Date(), preferencias.dia_virada).toLocaleDateString("pt-BR")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Vale por enquanto apenas para o Dashboard e a Início — as demais telas continuam
              considerando o mês calendário.
            </p>
            <Button onClick={salvarMesSistema} disabled={salvarPreferencias.isPending} size="sm">
              {salvarPreferencias.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>

        {moduloVeiculoAtivo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Car className="size-4" /> Destaque do módulo Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Quando ativado, o card "Veículo" na Início mostra em destaque a soma dos gastos do
              veículo no mês atual.
            </p>
            <div className="flex items-center gap-2">
              <Switch checked={destacarVeiculo} onCheckedChange={salvarDestaqueVeiculo} />
              <span className="text-xs text-muted-foreground">
                {destacarVeiculo ? "Ativado" : "Desativado"}
              </span>
            </div>
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4" /> Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Senha atual">
              <Input
                type="password"
                placeholder="Digite sua senha atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
            </Field>
            <Field label="Nova senha">
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>
            <Field label="Confirmar nova senha">
              <Input
                type="password"
                placeholder="Repita a nova senha"
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
        {isSiteAdmin && <PermissoesUsuariosCard compact />}

        <ExcluirContaCard className="border-destructive/30 lg:col-span-2" />
      </div>

    </AppLayout>
  );
}

function MembrosGrupo() {
  const qc = useQueryClient();
  const listar = useServerFn(listarMembrosMeuGrupo);
  const revogar = useServerFn(revogarAcessoMembro);
  const { data } = useQuery({ queryKey: ["membros-meu-grupo"], queryFn: () => listar() });
  const remover = useMutation({
    mutationFn: (userId: string) => revogar({ data: { userId } }),
    onSuccess: () => {
      toast.success("Acesso revogado. A pessoa não vê mais os dados deste grupo.");
      void qc.invalidateQueries({ queryKey: ["membros-meu-grupo"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível revogar."),
  });
  if (!data || data.membros.length === 0) return null;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-semibold">Pessoas com acesso ao seu grupo</p>
      {data.membros.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
          <span className="min-w-0 truncate">
            {m.nome}
            {m.email ? ` · ${m.email}` : ""}
            {m.ehDono ? " (dono)" : ""}
          </span>
          {data.souDono && !m.ehDono && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              disabled={remover.isPending}
              onClick={() => {
                if (window.confirm(`Revogar o acesso de ${m.nome} aos dados deste grupo?`)) remover.mutate(m.id);
              }}
            >
              Revogar acesso
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
