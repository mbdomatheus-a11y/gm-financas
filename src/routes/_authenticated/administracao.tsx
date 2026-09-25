import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/useAuthData";
import {
  adminEncerrarComunicado,
  adminListarComunicados,
  adminAtualizarLayout,
  adminCriarComunicado,
  adminListarLayouts,
  adminListarLogs,
  adminMetricas,
  adminObterLayoutUrl,
} from "@/lib/admin-avancado.functions";
import {
  adminListarModulos,
  adminSalvarConfiguracaoAcesso,
  adminSalvarModulo,
  obterConfiguracaoAcesso,
} from "@/lib/configuracoes-site.functions";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminListarSolicitacoesPrivacidade,
  adminTratarSolicitacaoPrivacidade,
} from "@/lib/privacidade.functions";
import { confirmarLogo, prepararUploadLogo } from "@/lib/identidade-site.functions";

export const Route = createFileRoute("/_authenticated/administracao")({ component: Admin });
function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function Admin() {
  const { isSiteAdmin } = usePermissoes();
  const qc = useQueryClient();
  const layoutsFn = useServerFn(adminListarLayouts),
    privFn = useServerFn(adminListarSolicitacoesPrivacidade),
    metricsFn = useServerFn(adminMetricas),
    logsFn = useServerFn(adminListarLogs),
    atualizar = useServerFn(adminAtualizarLayout),
    obterLayoutUrl = useServerFn(adminObterLayoutUrl),
    tratar = useServerFn(adminTratarSolicitacaoPrivacidade),
    criar = useServerFn(adminCriarComunicado),
    prepararLogo = useServerFn(prepararUploadLogo),
    confirmar = useServerFn(confirmarLogo);
  const obterConfig = useServerFn(obterConfiguracaoAcesso),
    salvarConfig = useServerFn(adminSalvarConfiguracaoAcesso),
    listarModulos = useServerFn(adminListarModulos),
    salvarModulo = useServerFn(adminSalvarModulo),
    listarComunicados = useServerFn(adminListarComunicados),
    encerrarComunicado = useServerFn(adminEncerrarComunicado);
  const logoInput = useRef<HTMLInputElement>(null);
  const { data: layouts = [] } = useQuery({
    queryKey: ["admin-layouts"],
    enabled: isSiteAdmin,
    queryFn: () => layoutsFn(),
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ["admin-privacidade"],
    enabled: isSiteAdmin,
    queryFn: () => privFn(),
  });
  const { data: metricas } = useQuery({
    queryKey: ["admin-metricas"],
    enabled: isSiteAdmin,
    queryFn: () => metricsFn(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["admin-logs"],
    enabled: isSiteAdmin,
    queryFn: () => logsFn(),
  });
  const [titulo, setTitulo] = useState("");
  const [msg, setMsg] = useState("");
  const { data: config } = useQuery({
    queryKey: ["configuracao-acesso-publica"],
    enabled: isSiteAdmin,
    queryFn: () => obterConfig(),
  });
  const { data: gestaoModulos } = useQuery({
    queryKey: ["admin-modulos"],
    enabled: isSiteAdmin,
    queryFn: () => listarModulos(),
  });
  const { data: comunicados = [] } = useQuery({
    queryKey: ["admin-comunicados"],
    enabled: isSiteAdmin,
    queryFn: () => listarComunicados(),
  });
  const salvarAcesso = useMutation({
    mutationFn: (valor: { modoLogin: "cpf" | "email" | "ambos"; segundoFatorEmail: boolean }) =>
      salvarConfig({ data: { ...valor, sessaoMaximaMinutos: 60 } }),
    onSuccess: () => {
      toast.success("Configuração de acesso salva.");
      qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const mudarModulo = useMutation({
    mutationFn: (valor: { modulo: any; habilitado: boolean; userId: string | null }) =>
      salvarModulo({ data: valor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-modulos"] }),
    onError: (e) => toast.error(e.message),
  });
  const limparAviso = useMutation({
    mutationFn: (id: string) => encerrarComunicado({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-comunicados"] });
      qc.invalidateQueries({ queryKey: ["comunicados-pendentes"] });
    },
  });
  const atualizarLayout = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "corrigida" | "descartada" }) =>
      atualizar({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Solicitação atualizada e arquivo descartado.");
      qc.invalidateQueries({ queryKey: ["admin-layouts"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    },
    onError: (error) => toast.error(error.message),
  });
  async function abrirLayout(id: string) {
    const aba = window.open("", "_blank");
    if (!aba) {
      toast.error("Permita abrir uma nova aba para consultar o arquivo.");
      return;
    }
    try {
      const { url } = await obterLayoutUrl({ data: { id } });
      aba.location.replace(url);
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    } catch (error) {
      aba.close();
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o arquivo.");
    }
  }
  const concluirPedido = useMutation({
    mutationFn: (id: string) => tratar({ data: { id, status: "concluida" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-privacidade"] }),
  });
  const comunicado = useMutation({
    mutationFn: () => criar({ data: { titulo, mensagem: msg, exigeAceite: true } }),
    onSuccess: () => {
      toast.success("Aviso publicado com aceite registrado.");
      setTitulo("");
      setMsg("");
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    },
  });
  async function subirLogo(files: FileList | null) {
    const arquivo = files?.[0];
    if (!arquivo) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
      toast.error("Envie JPG, PNG, WEBP ou GIF de até 5 MB.");
      return;
    }
    try {
      const envio = await prepararLogo({ data: { nome: arquivo.name } });
      const { error } = await supabase.storage
        .from("site_assets")
        .uploadToSignedUrl(envio.path, envio.token, arquivo);
      if (error) throw error;
      await confirmar({ data: { path: envio.path } });
      qc.invalidateQueries({ queryKey: ["identidade-visual-site"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast.success("Logo atualizada em todo o site.");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível atualizar a logo.");
    } finally {
      if (logoInput.current) logoInput.current.value = "";
    }
  }
  if (!isSiteAdmin)
    return (
      <AppLayout title="Administração">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Área restrita ao administrador do site.
          </CardContent>
        </Card>
      </AppLayout>
    );
  return (
    <AppLayout
      title="Administração do site"
      description="Indicadores quantitativos, sem acesso a dados financeiros"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <b>{metricas?.total ?? 0}</b>
            <p className="text-xs text-muted-foreground">usuários cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <b>{metricas?.ativos ?? 0}</b>
            <p className="text-xs text-muted-foreground">contas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <b>{metricas?.tempoMedioMin ?? 0} min</b>
            <p className="text-xs text-muted-foreground">tempo médio de sessão</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Atividade e espaço por usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Usuário</th>
                  <th className="p-2">Situação</th>
                  <th className="p-2">Última atividade</th>
                  <th className="p-2">Arquivos</th>
                  <th className="p-2">Espaço</th>
                </tr>
              </thead>
              <tbody>
                {(metricas?.usuarios ?? []).map(
                  (usuario: {
                    id: string;
                    nome: string;
                    ativo: boolean;
                    ultimaAtividadeEm: string | null;
                    arquivos: number;
                    bytesArmazenados: number;
                  }) => (
                    <tr key={usuario.id} className="border-b last:border-0">
                      <td className="p-2">{usuario.nome}</td>
                      <td className="p-2">{usuario.ativo ? "Ativa" : "Inativa"}</td>
                      <td className="p-2">
                        {usuario.ultimaAtividadeEm
                          ? new Date(usuario.ultimaAtividadeEm).toLocaleString("pt-BR")
                          : "Sem acesso registrado"}
                      </td>
                      <td className="p-2">{usuario.arquivos}</td>
                      <td className="p-2">{formatarTamanho(usuario.bytesArmazenados)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Atividade medida por abertura de sessão e interação no aplicativo. Espaço atribuído pelo
            proprietário técnico do arquivo, sem acesso ao conteúdo. Arquivos sem proprietário
            atribuído: {formatarTamanho(metricas?.armazenamentoNaoAtribuidoBytes ?? 0)}.
          </p>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Composição dos grupos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(metricas?.grupos ?? []).map((g: any) => (
            <div key={g.id} className="rounded-lg border p-3">
              <b className="text-sm">{g.nome}</b>
              <p className="text-xs text-muted-foreground">{g.membros.length} integrante(s)</p>
              <div className="mt-2 space-y-1">
                {g.membros.map((m: any) => (
                  <p key={m.id} className="text-xs">
                    {m.nome}{" "}
                    <span className="text-muted-foreground">
                      {m.email ?? "sem e-mail"} · {m.ativo ? "ativo" : "inativo"}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {config && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">Acesso e autenticação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Identificador permitido no login</p>
              <Select
                value={config.modo_login}
                onValueChange={(v) =>
                  salvarAcesso.mutate({
                    modoLogin: v as any,
                    segundoFatorEmail: config.segundo_fator_email,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">Somente CPF</SelectItem>
                  <SelectItem value="email">Somente e-mail</SelectItem>
                  <SelectItem value="ambos">CPF ou e-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              2FA por e-mail
              <Switch
                checked={config.segundo_fator_email}
                onCheckedChange={(v) =>
                  salvarAcesso.mutate({ modoLogin: config.modo_login, segundoFatorEmail: v })
                }
              />
            </label>
            <div className="rounded-lg border p-3 text-sm">
              <b>Sessão máxima</b>
              <p className="text-xs text-muted-foreground">
                1 hora, além do limite de inatividade.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {gestaoModulos && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">Módulos globais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              O administrador do site sempre enxerga todos. Desative globalmente e libere apenas
              para usuários de teste quando necessário.
            </p>
            {gestaoModulos.modulos.map((m: any) => (
              <div key={m.modulo} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <b className="text-sm">{m.nome}</b>
                  <Switch
                    checked={m.habilitado}
                    onCheckedChange={(v) =>
                      mudarModulo.mutate({ modulo: m.modulo, habilitado: v, userId: null })
                    }
                  />
                </div>
                {!m.habilitado && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gestaoModulos.usuarios.map((u: any) => {
                      const ex = gestaoModulos.excecoes.find(
                        (x: any) => x.user_id === u.id && x.modulo === m.modulo,
                      );
                      return (
                        <Button
                          key={u.id}
                          size="sm"
                          variant={ex?.habilitado ? "default" : "outline"}
                          onClick={() =>
                            mudarModulo.mutate({
                              modulo: m.modulo,
                              habilitado: !ex?.habilitado,
                              userId: u.id,
                            })
                          }
                        >
                          {u.nome}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="font-semibold">Logo do Control ALL</h2>
            <p className="text-xs text-muted-foreground">
              A imagem será usada na Home, login e áreas internas.
            </p>
          </div>
          <input
            ref={logoInput}
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => subirLogo(e.target.files)}
          />
          <Button variant="outline" onClick={() => logoInput.current?.click()}>
            Enviar ou trocar logo
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Banner de aviso</h2>
            <Input
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <Textarea
              placeholder="Mensagem para todos os usuários"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <Button disabled={!titulo || !msg} onClick={() => comunicado.mutate()}>
              Publicar e exigir aceite
            </Button>
            <p className="text-xs text-muted-foreground">
              O aviso deixa de aparecer automaticamente após 72 horas.
            </p>
            {comunicados
              .filter((c: any) => c.ativo)
              .map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs"
                >
                  <span>{c.titulo}</span>
                  <Button size="sm" variant="ghost" onClick={() => limparAviso.mutate(c.id)}>
                    Encerrar para todos
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Solicitações de privacidade</h2>
            {pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>
            ) : (
              pedidos.map((p: any) => (
                <div className="rounded-lg border p-3" key={p.id}>
                  <b>{p.email}</b>
                  <p className="text-xs">
                    {p.telefone} · {p.status}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.motivo || "Sem detalhe"}</p>
                  {p.status !== "concluida" && (
                    <Button size="sm" className="mt-2" onClick={() => concluirPedido.mutate(p.id)}>
                      Concluir
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Faturas enviadas para modelagem</h2>
            {layouts.filter((l: any) => l.status === "pendente" || l.status === "em_modelagem").length > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {layouts.filter((l: any) => l.status === "pendente" || l.status === "em_modelagem").length} pendente(s)
              </span>
            )}
          </div>
          {layouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo aguardando análise.</p>
          ) : (
            layouts.map((l: any) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                key={l.id}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <b>{l.arquivo_nome}</b>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        l.status === "corrigida"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : l.status === "em_modelagem"
                          ? "bg-blue-500/10 text-blue-600"
                          : l.status === "descartada"
                          ? "bg-rose-500/10 text-rose-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {l.status === "corrigida"
                        ? "Concluído"
                        : l.status === "em_modelagem"
                        ? "Em análise"
                        : l.status === "descartada"
                        ? "Descartado"
                        : "Pendente"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enviado por: {l.profiles?.nome || l.profiles?.email || "Usuário"} · {l.banco_informado || "Banco não inf."} {l.cartao_final ? `(Final ${l.cartao_final})` : ""} · {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                  {l.resposta_admin && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      Resposta/Status: {l.resposta_admin}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.status !== "corrigida" && l.status !== "descartada" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void abrirLayout(l.id)}>
                        Baixar / Abrir
                      </Button>
                      {l.status !== "em_modelagem" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => atualizarLayout.mutate({ id: l.id, status: "em_modelagem" as any })}
                        >
                          Em análise
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => atualizarLayout.mutate({ id: l.id, status: "corrigida" as any })}
                      >
                        Concluído & Apagar PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => atualizarLayout.mutate({ id: l.id, status: "descartada" as any })}
                      >
                        Descartar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardContent className="space-y-2 p-4">
          <h2 className="font-semibold">Log administrativo</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            logs.map((l: any) => (
              <div className="border-b py-2 text-xs" key={l.id}>
                <b>{l.acao.replaceAll("_", " ")}</b>
                <span className="ml-2 text-muted-foreground">
                  {l.profiles?.nome ?? l.profiles?.email ?? "Usuário removido"} ·{" "}
                  {new Date(l.criado_em).toLocaleString("pt-BR")}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
