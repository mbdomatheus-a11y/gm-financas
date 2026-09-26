import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/useAuthData";
import { formatBRL } from "@/lib/format";
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
import {
  adminListarSolicitacoesPrivacidade,
  adminTratarSolicitacaoPrivacidade,
  adminListarChamados,
  adminAtualizarChamado,
  adminListarConvites,
} from "@/lib/central-solicitacoes.functions";
import {
  confirmarLogo,
  confirmarVideo,
  prepararUploadLogo,
  prepararUploadVideo,
} from "@/lib/identidade-site.functions";
import {
  adminSalvarEstatisticaPublica,
  obterEconomiaTotalAutomatica,
  obterEstatisticaPublica,
} from "@/lib/estatisticas-site.functions";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/administracao")({ component: Admin });

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_PRIVACIDADE: Record<string, { label: string; color: string }> = {
  recebida: { label: "Recebida", color: "bg-blue-500/10 text-blue-700" },
  em_analise: { label: "Em Análise", color: "bg-yellow-500/10 text-yellow-700" },
  em_atendimento: { label: "Em Atendimento", color: "bg-orange-500/10 text-orange-700" },
  aguardando_ti: { label: "Aguardando TI", color: "bg-purple-500/10 text-purple-700" },
  planejado: { label: "Planejado", color: "bg-indigo-500/10 text-indigo-700" },
  programado: { label: "Programado", color: "bg-teal-500/10 text-teal-700" },
  concluida: { label: "Concluída", color: "bg-emerald-500/10 text-emerald-700" },
  indeferida: { label: "Indeferida", color: "bg-rose-500/10 text-rose-700" },
};

const STATUS_CHAMADO: Record<string, { label: string; color: string }> = {
  recebido: { label: "Recebido", color: "bg-blue-500/10 text-blue-700" },
  em_atendimento: { label: "Em Atendimento", color: "bg-orange-500/10 text-orange-700" },
  aguardando_usuario: { label: "Aguardando usuário", color: "bg-yellow-500/10 text-yellow-700" },
  resolvido: { label: "Resolvido", color: "bg-emerald-500/10 text-emerald-700" },
  cancelado: { label: "Cancelado", color: "bg-rose-500/10 text-rose-700" },
};

const STATUS_LAYOUT: Record<string, { label: string; color: string }> = {
  recebida: { label: "Pendente", color: "bg-amber-500/10 text-amber-700" },
  em_modelagem: { label: "Em análise", color: "bg-blue-500/10 text-blue-700" },
  corrigida: { label: "Concluído", color: "bg-emerald-500/10 text-emerald-700" },
  descartada: { label: "Descartado", color: "bg-rose-500/10 text-rose-700" },
};

const STATUS_CONVITE: Record<string, { label: string; color: string }> = {
  usado: { label: "Usado", color: "bg-emerald-500/10 text-emerald-700" },
  pendente: { label: "Pendente", color: "bg-blue-500/10 text-blue-700" },
  expirado: { label: "Expirado", color: "bg-rose-500/10 text-rose-700" },
  cancelado: { label: "Cancelado", color: "bg-gray-500/10 text-gray-700" },
};

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────
function Admin() {
  const { isSiteAdmin } = usePermissoes();
  const qc = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  // Server functions
  const layoutsFn = useServerFn(adminListarLayouts);
  const metricsFn = useServerFn(adminMetricas);
  const logsFn = useServerFn(adminListarLogs);
  const atualizarFn = useServerFn(adminAtualizarLayout);
  const obterLayoutUrl = useServerFn(adminObterLayoutUrl);
  const criarComunicadoFn = useServerFn(adminCriarComunicado);
  const prepararLogo = useServerFn(prepararUploadLogo);
  const confirmar = useServerFn(confirmarLogo);
  const prepararVideo = useServerFn(prepararUploadVideo);
  const confirmarVideoFn = useServerFn(confirmarVideo);
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const salvarConfig = useServerFn(adminSalvarConfiguracaoAcesso);
  const listarModulos = useServerFn(adminListarModulos);
  const salvarModulo = useServerFn(adminSalvarModulo);
  const listarComunicadosFn = useServerFn(adminListarComunicados);
  const encerrarComunicadoFn = useServerFn(adminEncerrarComunicado);
  const privFn = useServerFn(adminListarSolicitacoesPrivacidade);
  const tratarPrivFn = useServerFn(adminTratarSolicitacaoPrivacidade);
  const chamadosFn = useServerFn(adminListarChamados);
  const atualizarChamadoFn = useServerFn(adminAtualizarChamado);
  const convitesFn = useServerFn(adminListarConvites);
  const economiaAutomaticaFn = useServerFn(obterEconomiaTotalAutomatica);
  const obterEstatisticaPublicaFn = useServerFn(obterEstatisticaPublica);
  const salvarEstatisticaFn = useServerFn(adminSalvarEstatisticaPublica);

  // State
  const [titulo, setTitulo] = useState("");
  const [msg, setMsg] = useState("");
  const [sessaoMin, setSessaoMin] = useState<number>(60);
  const [cotaConvitesInput, setCotaConvitesInput] = useState<number>(3);
  const [dialogPriv, setDialogPriv] = useState<{ id: string; status: string; email: string } | null>(null);
  const [respostaPriv, setRespostaPriv] = useState("");
  const [statusPriv, setStatusPriv] = useState("em_atendimento");
  const [dialogChamado, setDialogChamado] = useState<{ id: string; status: string } | null>(null);
  const [respostaChamado, setRespostaChamado] = useState("");
  const [statusChamado, setStatusChamado] = useState("em_atendimento");
  const [filtroLog, setFiltroLog] = useState("");
  const [consultaDesbloqueada, setConsultaDesbloqueada] = useState(false);
  const [senhaConsulta, setSenhaConsulta] = useState("");
  const [erroSenhaConsulta, setErroSenhaConsulta] = useState("");
  const [economiaExibidaInput, setEconomiaExibidaInput] = useState("");

  // Queries
  const { data: layouts = [] } = useQuery({
    queryKey: ["admin-layouts"],
    enabled: isSiteAdmin,
    queryFn: () => layoutsFn(),
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
  const { data: config } = useQuery<{ modo_login: "cpf" | "email" | "ambos"; segundo_fator_email: boolean; sessao_maxima_minutos: number; cota_convites: number } | undefined>({
    queryKey: ["configuracao-acesso-publica"],
    enabled: isSiteAdmin,
    queryFn: () => obterConfig() as any,
  });

  useEffect(() => {
    if (config?.sessao_maxima_minutos) {
      setSessaoMin(config.sessao_maxima_minutos);
    }
  }, [config?.sessao_maxima_minutos]);

  useEffect(() => {
    if (config?.cota_convites) {
      setCotaConvitesInput(config.cota_convites);
    }
  }, [config?.cota_convites]);

  const { data: gestaoModulos } = useQuery({
    queryKey: ["admin-modulos"],
    enabled: isSiteAdmin,
    queryFn: () => listarModulos(),
  });
  const { data: comunicados = [] } = useQuery({
    queryKey: ["admin-comunicados"],
    enabled: isSiteAdmin,
    queryFn: () => listarComunicadosFn(),
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ["admin-privacidade"],
    enabled: isSiteAdmin,
    queryFn: () => privFn(),
  });
  const { data: chamados = [] } = useQuery({
    queryKey: ["admin-chamados"],
    enabled: isSiteAdmin,
    queryFn: () => chamadosFn(),
  });
  const { data: convites = [] } = useQuery({
    queryKey: ["admin-convites"],
    enabled: isSiteAdmin,
    queryFn: () => convitesFn(),
  });
  const { data: economiaAutomatica } = useQuery({
    queryKey: ["admin-economia-total-automatica"],
    enabled: isSiteAdmin,
    queryFn: () => economiaAutomaticaFn(),
  });
  const { data: estatisticaPublica } = useQuery({
    queryKey: ["estatistica-publica-economia"],
    enabled: isSiteAdmin,
    queryFn: () => obterEstatisticaPublicaFn(),
  });
  const { data: identidadeVisual } = useQuery({
    queryKey: ["identidade-visual-site"],
    enabled: isSiteAdmin,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("identidade_visual_site")
        .select("logo_path, video_demonstracao_path")
        .eq("id", true)
        .maybeSingle();
      return data as { logo_path: string | null; video_demonstracao_path: string | null } | null;
    },
  });

  useEffect(() => {
    if (estatisticaPublica && estatisticaPublica.economiaTotalExibida !== null) {
      setEconomiaExibidaInput(String(estatisticaPublica.economiaTotalExibida));
    }
  }, [estatisticaPublica]);

  // Mutations
  const salvarAcesso = useMutation({
    mutationFn: (valor: { modoLogin: "cpf" | "email" | "ambos"; segundoFatorEmail: boolean; sessaoMaximaMinutos: number; cotaConvites: number }) =>
      salvarConfig({ data: valor }),
    onSuccess: () => { toast.success("Configuração de acesso salva."); qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const salvarEstatistica = useMutation({
    mutationFn: (valor: number | null) => salvarEstatisticaFn({ data: { valor } }),
    onSuccess: () => {
      toast.success("Estatística pública atualizada.");
      qc.invalidateQueries({ queryKey: ["estatistica-publica-economia"] });
      qc.invalidateQueries({ queryKey: ["estatistica-publica-economia-home"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mudarModulo = useMutation({
    mutationFn: (valor: { modulo: any; habilitado: boolean; userId: string | null }) => salvarModulo({ data: valor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-modulos"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Ação em massa: libera/bloqueia várias pessoas de uma vez pro mesmo
  // módulo, disparando cada chamada em paralelo e invalidando a lista só
  // uma vez no final (em vez de uma invalidação por pessoa).
  const mudarModuloEmMassa = useMutation({
    mutationFn: async (valor: { modulo: any; habilitado: boolean; userIds: string[] }) =>
      Promise.all(
        valor.userIds.map((userId) => salvarModulo({ data: { modulo: valor.modulo, habilitado: valor.habilitado, userId } })),
      ),
    onSuccess: (_data, valor) => {
      toast.success(`${valor.userIds.length} usuário(s) ${valor.habilitado ? "liberado(s)" : "bloqueado(s)"}.`);
      qc.invalidateQueries({ queryKey: ["admin-modulos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [buscaModulo, setBuscaModulo] = useState("");
  const [selecionadosPorModulo, setSelecionadosPorModulo] = useState<Record<string, Set<string>>>({});
  function alternarSelecaoUsuario(modulo: string, userId: string) {
    setSelecionadosPorModulo((atual) => {
      const conjunto = new Set(atual[modulo] ?? []);
      if (conjunto.has(userId)) conjunto.delete(userId);
      else conjunto.add(userId);
      return { ...atual, [modulo]: conjunto };
    });
  }

  const limparAviso = useMutation({
    mutationFn: (id: string) => encerrarComunicadoFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-comunicados"] }); qc.invalidateQueries({ queryKey: ["comunicados-pendentes"] }); },
  });

  const atualizarLayout = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "corrigida" | "descartada" | "em_modelagem" }) => atualizarFn({ data: { id, status: status as any } }),
    onSuccess: () => { toast.success("Solicitação atualizada."); qc.invalidateQueries({ queryKey: ["admin-layouts"] }); qc.invalidateQueries({ queryKey: ["admin-logs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const comunicadoMut = useMutation({
    mutationFn: () => criarComunicadoFn({ data: { titulo, mensagem: msg, exigeAceite: true } }),
    onSuccess: () => { toast.success("Aviso publicado."); setTitulo(""); setMsg(""); qc.invalidateQueries({ queryKey: ["admin-comunicados"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const tratarPriv = useMutation({
    mutationFn: (p: { id: string; status: any; resposta?: string | undefined }) =>
      tratarPrivFn({ data: p.resposta ? { id: p.id, status: p.status, resposta: p.resposta } : { id: p.id, status: p.status } }),
    onSuccess: () => { toast.success("Solicitação atualizada."); qc.invalidateQueries({ queryKey: ["admin-privacidade"] }); setDialogPriv(null); setRespostaPriv(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarChamado = useMutation({
    mutationFn: (p: { id: string; status: any; resposta?: string | undefined }) =>
      atualizarChamadoFn({ data: p.resposta ? { id: p.id, status: p.status, resposta: p.resposta } : { id: p.id, status: p.status } }),
    onSuccess: () => { toast.success("Chamado atualizado."); qc.invalidateQueries({ queryKey: ["admin-chamados"] }); setDialogChamado(null); setRespostaChamado(""); },
    onError: (e: any) => toast.error(e.message),
  });

  async function abrirLayout(id: string) {
    const aba = window.open("", "_blank");
    if (!aba) { toast.error("Permita abrir uma nova aba."); return; }
    try {
      const { url } = await obterLayoutUrl({ data: { id } });
      aba.location.replace(url);
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    } catch (e: any) { aba.close(); toast.error(e.message ?? "Não foi possível abrir o arquivo."); }
  }

  async function subirLogo(files: FileList | null) {
    const arquivo = files?.[0];
    if (!arquivo) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(arquivo.type) || arquivo.size > 5 * 1024 * 1024) { toast.error("Envie JPG, PNG, WEBP ou GIF de até 5 MB."); return; }
    try {
      const envio = await prepararLogo({ data: { nome: arquivo.name } });
      const { error } = await supabase.storage.from("site_assets").uploadToSignedUrl(envio.path, envio.token, arquivo);
      if (error) throw error;
      await confirmar({ data: { path: envio.path } });
      qc.invalidateQueries({ queryKey: ["identidade-visual-site"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast.success("Logo atualizada em todo o site.");
    } catch (e: any) { toast.error(e.message || "Não foi possível atualizar a logo."); }
    finally { if (logoInput.current) logoInput.current.value = ""; }
  }

  async function subirVideo(files: FileList | null) {
    const arquivo = files?.[0];
    if (!arquivo) return;
    if (!/^video\/(mp4|webm|quicktime)$/.test(arquivo.type) || arquivo.size > 100 * 1024 * 1024) { toast.error("Envie MP4, WEBM ou MOV de até 100 MB."); return; }
    try {
      const envio = await prepararVideo({ data: { nome: arquivo.name } });
      const { error } = await supabase.storage.from("site_videos").uploadToSignedUrl(envio.path, envio.token, arquivo);
      if (error) throw error;
      await confirmarVideoFn({ data: { path: envio.path } });
      qc.invalidateQueries({ queryKey: ["identidade-visual-site"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast.success("Vídeo de demonstração atualizado.");
    } catch (e: any) { toast.error(e.message || "Não foi possível atualizar o vídeo."); }
    finally { if (videoInput.current) videoInput.current.value = ""; }
  }

  async function removerVideo() {
    try {
      await confirmarVideoFn({ data: { path: null } });
      qc.invalidateQueries({ queryKey: ["identidade-visual-site"] });
      toast.success("Vídeo removido da home.");
    } catch (e: any) { toast.error(e.message || "Não foi possível remover o vídeo."); }
  }

  if (!isSiteAdmin)
    return (
      <AppLayout title="Administração">
        <Card><CardContent className="p-8 text-center text-muted-foreground">Área restrita ao administrador do site.</CardContent></Card>
      </AppLayout>
    );

  // Contadores de badge
  const layoutsPendentes = layouts.filter((l: any) => l.status === "recebida" || l.status === "em_modelagem").length;
  const privPendentes = pedidos.filter((p: any) => p.status === "recebida" || p.status === "em_atendimento" || p.status === "em_analise").length;
  const chamadosPendentes = chamados.filter((c: any) => c.status === "recebido" || c.status === "em_atendimento").length;
  const totalPendentes = layoutsPendentes + privPendentes + chamadosPendentes;

  const logsVisiveis = filtroLog
    ? logs.filter((l: any) => l.acao.includes(filtroLog.toLowerCase()) || l.profiles?.nome?.toLowerCase().includes(filtroLog.toLowerCase()))
    : logs;

  return (
    <AppLayout title="Administração do site" description="Painel de controle administrativo">
      <Tabs defaultValue="dados-gerais" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dados-gerais">Dados Gerais</TabsTrigger>
          <TabsTrigger value="consulta">Consulta</TabsTrigger>
          <TabsTrigger value="acesso">Acesso e Auth</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
          <TabsTrigger value="avisos">Avisos</TabsTrigger>
          <TabsTrigger value="privacidade">Privacidade LGPD</TabsTrigger>
          <TabsTrigger value="central" className="relative">
            Central de Solicitações
            {totalPendentes > 0 && (
              <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white font-bold">{totalPendentes}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">Logs de Auditoria</TabsTrigger>
        </TabsList>

        {/* ─── ABA 1: DADOS GERAIS ─── */}
        <TabsContent value="dados-gerais" className="space-y-4">
          {/* Métricas gerais */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><b>{metricas?.total ?? 0}</b><p className="text-xs text-muted-foreground">usuários cadastrados</p></CardContent></Card>
            <Card><CardContent className="p-4"><b>{metricas?.ativos ?? 0}</b><p className="text-xs text-muted-foreground">contas ativas</p></CardContent></Card>
            <Card><CardContent className="p-4"><b>{metricas?.tempoMedioMin ?? 0} min</b><p className="text-xs text-muted-foreground">tempo médio de sessão</p></CardContent></Card>
          </div>

          {/* Convites */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Convites</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm mb-3">
                <span><b>{(convites as any[]).filter((c: any) => c.status === "usado").length}</b> usados</span>
                <span><b>{(convites as any[]).filter((c: any) => c.status === "pendente").length}</b> pendentes</span>
                <span><b>{(convites as any[]).filter((c: any) => c.status === "cancelado").length}</b> cancelados</span>
                <span><b>{(convites as any[]).filter((c: any) => c.status === "expirado").length}</b> expirados</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Limite de {config?.cota_convites ?? 3} convites por usuário comum (ajustável na aba
                "Acesso e Auth"). Você, como admin do site, tem limite ilimitado.
              </p>
              <div className="mt-3 max-h-60 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="border-b"><th className="p-1.5">Criador</th><th className="p-1.5">Status</th><th className="p-1.5">Criado em</th><th className="p-1.5">Expira em</th></tr></thead>
                  <tbody>
                    {(convites as any[]).map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="p-1.5">{c.criador_nome}</td>
                        <td className="p-1.5">
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CONVITE[c.status]?.color ?? ""}`}>
                            {STATUS_CONVITE[c.status]?.label ?? c.status}
                          </span>
                        </td>
                        <td className="p-1.5">{new Date(c.criado_em).toLocaleDateString("pt-BR")}</td>
                        <td className="p-1.5">{new Date(c.expira_em).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 2026-09-26: removido o card "Saldo mensal por grupo" — decisão do
              proprietário: o administrador do site não deve ver dados
              financeiros (receita/despesa/saldo) de nenhum grupo além do seu
              próprio, nem agregados. A composição de grupos (nomes e membros)
              continua disponível sem nenhum valor financeiro. */}

          {/* Composição dos grupos */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Composição dos grupos</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {(metricas?.grupos ?? []).map((g: any) => (
                <div key={g.id} className="rounded-lg border p-3">
                  <b className="text-sm">{g.nome}</b>
                  <p className="text-xs text-muted-foreground">{g.membros.length} integrante(s)</p>
                  <div className="mt-2 space-y-1">
                    {g.membros.map((m: any) => (
                      <p key={m.id} className="text-xs">{m.nome}{" "}<span className="text-muted-foreground">{m.email ?? "sem e-mail"} · {m.ativo ? "ativo" : "inativo"}</span></p>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 2: CONSULTA ─── */}
        <TabsContent value="consulta" className="space-y-4">
          {!consultaDesbloqueada ? (
            <Card>
              <CardContent className="p-6 space-y-4 max-w-sm mx-auto">
                <div className="text-center space-y-1">
                  <div className="flex justify-center mb-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10">
                      <svg className="size-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                  </div>
                  <p className="font-semibold">Área protegida</p>
                  <p className="text-xs text-muted-foreground">Confirme sua senha para acessar os dados de atividade dos usuários.</p>
                </div>
                <Input
                  type="password"
                  placeholder="Sua senha de acesso"
                  value={senhaConsulta}
                  onChange={(e) => { setSenhaConsulta(e.target.value); setErroSenhaConsulta(""); }}
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    const { error } = await supabase.auth.signInWithPassword({
                      email: (await supabase.auth.getUser()).data.user?.email ?? "",
                      password: senhaConsulta,
                    });
                    if (error) { setErroSenhaConsulta("Senha incorreta."); } else { setConsultaDesbloqueada(true); setSenhaConsulta(""); }
                  }}
                />
                {erroSenhaConsulta && <p className="text-xs text-rose-600">{erroSenhaConsulta}</p>}
                <Button
                  className="w-full"
                  disabled={!senhaConsulta}
                  onClick={async () => {
                    const { data: userResult } = await supabase.auth.getUser();
                    const { error } = await supabase.auth.signInWithPassword({
                      email: userResult.user?.email ?? "",
                      password: senhaConsulta,
                    });
                    if (error) { setErroSenhaConsulta("Senha incorreta."); } else { setConsultaDesbloqueada(true); setSenhaConsulta(""); }
                  }}
                >
                  Confirmar e acessar
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Atividade e espaço por usuário</CardTitle>
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setConsultaDesbloqueada(false)}>
                    🔒 Bloquear novamente
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">Usuário</th>
                      <th className="p-2">Situação</th>
                      <th className="p-2">Última atividade</th>
                      <th className="p-2">Arquivos</th>
                      <th className="p-2">Espaço</th>
                      <th className="p-2">Grupo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(metricas?.usuarios ?? []).map((u: any) => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="p-2">{u.nome}</td>
                        <td className="p-2">{u.ativo ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">Ativa</Badge> : <Badge variant="secondary" className="bg-rose-500/10 text-rose-700">Inativa</Badge>}</td>
                        <td className="p-2 text-xs text-muted-foreground">{u.ultimaAtividadeEm ? new Date(u.ultimaAtividadeEm).toLocaleString("pt-BR") : "Sem acesso"}</td>
                        <td className="p-2">{u.arquivos}</td>
                        <td className="p-2">{formatarTamanho(u.bytesArmazenados)}</td>
                        <td className="p-2 text-xs text-muted-foreground">{u.grupoNome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Sem CPF exibido por segurança. Armazenamento não atribuído: {formatarTamanho(metricas?.armazenamentoNaoAtribuidoBytes ?? 0)}.
              </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── ABA 3: ACESSO E AUTENTICAÇÃO ─── */}
        <TabsContent value="acesso" className="space-y-4">
          {config && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Configurações de acesso e autenticação</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Identificador no login</p>
                  <Select
                    value={config.modo_login}
                    onValueChange={(v) => salvarAcesso.mutate({ modoLogin: v as any, segundoFatorEmail: config.segundo_fator_email, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                    onCheckedChange={(v) => salvarAcesso.mutate({ modoLogin: config.modo_login, segundoFatorEmail: v, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  />
                </label>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Sessão máxima (minutos)</p>
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    value={sessaoMin}
                    onChange={(e) => setSessaoMin(Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    onClick={() => salvarAcesso.mutate({ modoLogin: config.modo_login, segundoFatorEmail: config.segundo_fator_email, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  >
                    Salvar sessão
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Cota de convites por usuário</p>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={cotaConvitesInput}
                    onChange={(e) => setCotaConvitesInput(Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    onClick={() => salvarAcesso.mutate({ modoLogin: config.modo_login, segundoFatorEmail: config.segundo_fator_email, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  >
                    Salvar cota de convites
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Vale para todo mundo. Você (admin do site) sempre pode convidar sem limite,
                    independente deste valor.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-sm">Log de tentativas de login</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Identificadores com falhas de acesso registradas pelo sistema.</p>
              <p className="text-sm text-muted-foreground">Bloqueios automáticos ocorrem após 3 tentativas falhas consecutivas (15 min).</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 4: MÓDULOS ─── */}
        <TabsContent value="modulos" className="space-y-4">
          {gestaoModulos && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Módulos globais e exceções por usuário</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Matheus (admin master) sempre enxerga todos os módulos. Desative globalmente e libere para usuários de teste individualmente.
                </p>
                <Input
                  placeholder="Buscar usuário por nome ou e-mail…"
                  value={buscaModulo}
                  onChange={(e) => setBuscaModulo(e.target.value)}
                  className="max-w-sm"
                />
                {gestaoModulos.modulos.map((m: any) => {
                  const excecoesDoModulo = gestaoModulos.excecoes.filter((x: any) => x.modulo === m.modulo);
                  const liberados = excecoesDoModulo.filter((x: any) => x.habilitado).length;
                  const usuariosFiltrados = gestaoModulos.usuarios.filter((u: any) => {
                    const termo = buscaModulo.trim().toLowerCase();
                    if (!termo) return true;
                    return u.nome?.toLowerCase().includes(termo) || u.email?.toLowerCase().includes(termo);
                  });
                  const selecionados = selecionadosPorModulo[m.modulo] ?? new Set<string>();
                  return (
                    <div key={m.modulo} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <b className="text-sm">{m.nome}</b>
                          {!m.habilitado && (
                            <Badge variant="secondary" className="text-[10px]">
                              {liberados} usuário(s) com exceção liberada
                            </Badge>
                          )}
                        </div>
                        <Switch
                          checked={m.habilitado}
                          onCheckedChange={(v) => mudarModulo.mutate({ modulo: m.modulo, habilitado: v, userId: null })}
                        />
                      </div>
                      {!m.habilitado && (
                        <div className="mt-2 space-y-2">
                          {selecionados.size > 0 && (
                            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2">
                              <span className="text-xs text-muted-foreground">
                                {selecionados.size} selecionado(s)
                              </span>
                              <Button
                                size="sm"
                                variant="default"
                                disabled={mudarModuloEmMassa.isPending}
                                onClick={() =>
                                  mudarModuloEmMassa.mutate({ modulo: m.modulo, habilitado: true, userIds: [...selecionados] })
                                }
                              >
                                Liberar selecionados
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={mudarModuloEmMassa.isPending}
                                onClick={() =>
                                  mudarModuloEmMassa.mutate({ modulo: m.modulo, habilitado: false, userIds: [...selecionados] })
                                }
                              >
                                Bloquear selecionados
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelecionadosPorModulo((atual) => ({ ...atual, [m.modulo]: new Set() }))}
                              >
                                Limpar seleção
                              </Button>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {usuariosFiltrados.length === 0 && (
                              <p className="text-xs text-muted-foreground">Nenhum usuário encontrado para "{buscaModulo}".</p>
                            )}
                            {usuariosFiltrados.map((u: any) => {
                              const ex = excecoesDoModulo.find((x: any) => x.user_id === u.id);
                              const selecionado = selecionados.has(u.id);
                              return (
                                <div key={u.id} className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    className="size-3.5"
                                    checked={selecionado}
                                    onChange={() => alternarSelecaoUsuario(m.modulo, u.id)}
                                    aria-label={`Selecionar ${u.nome}`}
                                  />
                                  <Button
                                    size="sm"
                                    variant={ex?.habilitado ? "default" : "outline"}
                                    onClick={() => mudarModulo.mutate({ modulo: m.modulo, habilitado: !ex?.habilitado, userId: u.id })}
                                  >
                                    {u.nome}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── ABA 5: PERSONALIZAÇÃO ─── */}
        <TabsContent value="personalizacao" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2 className="font-semibold">Logo do Control ALL</h2>
                <p className="text-xs text-muted-foreground">A imagem será usada na Home, login e áreas internas. JPG, PNG, WEBP ou GIF, até 5 MB.</p>
              </div>
              <input
                ref={logoInput}
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => subirLogo(e.target.files)}
              />
              <Button variant="outline" onClick={() => logoInput.current?.click()}>Enviar ou trocar logo</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2 className="font-semibold">Vídeo de demonstração da home</h2>
                <p className="text-xs text-muted-foreground">
                  Exibido na seção "Demonstração" da home pública. MP4, WEBM ou MOV, até 100 MB.
                  {identidadeVisual?.video_demonstracao_path ? " Há um vídeo publicado agora." : " Nenhum vídeo publicado ainda."}
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  ref={videoInput}
                  className="hidden"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => subirVideo(e.target.files)}
                />
                <Button variant="outline" onClick={() => videoInput.current?.click()}>
                  {identidadeVisual?.video_demonstracao_path ? "Trocar vídeo" : "Enviar vídeo"}
                </Button>
                {identidadeVisual?.video_demonstracao_path && (
                  <Button variant="ghost" className="text-muted-foreground" onClick={removerVideo}>Remover</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Economia total conquistada (exibida na home)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Valor automático: soma de todas as despesas fixas (recorrentes) marcadas como
                "Economia Conquistada" por qualquer usuário do site — só uma referência.{" "}
                {economiaAutomatica ? (
                  <>
                    Hoje soma{" "}
                    <span className="font-semibold text-foreground">
                      {formatBRL(economiaAutomatica.total)}
                    </span>{" "}
                    ({economiaAutomatica.quantidade}{" "}
                    {economiaAutomatica.quantidade === 1 ? "despesa" : "despesas"}).
                  </>
                ) : (
                  "Calculando…"
                )}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="economia-exibida">
                    Valor a exibir publicamente (R$)
                  </label>
                  <Input
                    id="economia-exibida"
                    className="w-48"
                    inputMode="decimal"
                    placeholder="Ex.: 15000"
                    value={economiaExibidaInput}
                    onChange={(e) => setEconomiaExibidaInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    economiaAutomatica && setEconomiaExibidaInput(String(economiaAutomatica.total))
                  }
                  disabled={!economiaAutomatica}
                >
                  Usar valor automático
                </Button>
                <Button
                  onClick={() => {
                    const normalizado = economiaExibidaInput.replace(",", ".");
                    const numero = normalizado.trim() === "" ? null : Number(normalizado);
                    if (numero !== null && (Number.isNaN(numero) || numero < 0)) {
                      toast.error("Informe um valor válido.");
                      return;
                    }
                    salvarEstatistica.mutate(numero);
                  }}
                  disabled={salvarEstatistica.isPending}
                >
                  Salvar e exibir no site
                </Button>
                {estatisticaPublica?.economiaTotalExibida !== null && estatisticaPublica?.economiaTotalExibida !== undefined && (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => { setEconomiaExibidaInput(""); salvarEstatistica.mutate(null); }}
                    disabled={salvarEstatistica.isPending}
                  >
                    Ocultar da home
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Enquanto nenhum valor for salvo aqui, esta estatística não aparece na home pública.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 6: AVISOS ─── */}
        <TabsContent value="avisos" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Novo banner de aviso</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <Textarea placeholder="Mensagem para todos os usuários" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <Button disabled={!titulo || !msg} onClick={() => comunicadoMut.mutate()}>Publicar e exigir aceite</Button>
              <p className="text-xs text-muted-foreground">O aviso deixa de aparecer automaticamente após 72 horas.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Avisos ativos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {comunicados.filter((c: any) => c.ativo).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum aviso ativo.</p>
              ) : (
                comunicados.filter((c: any) => c.ativo).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                    <div>
                      <b>{c.titulo}</b>
                      <p className="text-muted-foreground">{new Date(c.criado_em).toLocaleString("pt-BR")}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => limparAviso.mutate(c.id)}>Encerrar</Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {comunicados.filter((c: any) => !c.ativo).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Histórico de avisos</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-60 overflow-auto">
                {comunicados.filter((c: any) => !c.ativo).map((c: any) => (
                  <div key={c.id} className="border-b py-2 text-xs text-muted-foreground">
                    <b className="text-foreground">{c.titulo}</b> · encerrado · {new Date(c.criado_em).toLocaleString("pt-BR")}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── ABA 7: PRIVACIDADE LGPD ─── */}
        <TabsContent value="privacidade" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Solicitações de Privacidade (LGPD)</CardTitle>
                {privPendentes > 0 && <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-600">{privPendentes} pendente(s)</span>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pedidos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma solicitação de privacidade.</p>
              ) : (
                pedidos.map((p: any) => (
                  <div className="rounded-lg border p-3 space-y-2" key={p.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <b className="text-sm">{p.email}</b>
                        <p className="text-xs text-muted-foreground">{p.telefone} · Protocolo: {p.protocolo?.substring(0, 8)}…</p>
                        <p className="text-xs text-muted-foreground">{p.motivo || "Sem detalhes"} · {new Date(p.criado_em).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_PRIVACIDADE[p.status]?.color ?? ""}`}>
                        {STATUS_PRIVACIDADE[p.status]?.label ?? p.status}
                      </span>
                    </div>
                    {p.resposta_admin && <p className="text-xs italic text-muted-foreground">Última resposta: {p.resposta_admin}</p>}
                    {Array.isArray(p.tratativa_historico) && p.tratativa_historico.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Ver histórico ({p.tratativa_historico.length})</summary>
                        <div className="mt-1 space-y-1 pl-2 border-l">
                          {p.tratativa_historico.map((h: any, i: number) => (
                            <p key={i} className="text-muted-foreground">{new Date(h.data).toLocaleString("pt-BR")} · {STATUS_PRIVACIDADE[h.status]?.label ?? h.status}: {h.mensagem}</p>
                          ))}
                        </div>
                      </details>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDialogPriv({ id: p.id, status: p.status, email: p.email }); setStatusPriv(p.status); setRespostaPriv(""); }}
                    >
                      Tratar solicitação
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 8: CENTRAL DE SOLICITAÇÕES ─── */}
        <TabsContent value="central" className="space-y-4">
          {/* Faturas para modelagem */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Faturas enviadas para modelagem</CardTitle>
                {layoutsPendentes > 0 && <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">{layoutsPendentes} pendente(s)</span>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {layouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum arquivo aguardando análise.</p>
              ) : (
                layouts.map((l: any) => (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={l.id}>
                    <div>
                      <div className="flex items-center gap-2">
                        <b className="text-sm">{l.arquivo_nome}</b>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_LAYOUT[l.status]?.color ?? ""}`}>
                          {STATUS_LAYOUT[l.status]?.label ?? l.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {l.profiles?.nome || l.profiles?.email || "Usuário"} · {l.banco_informado || "Banco não inf."} {l.cartao_final ? `(Final ${l.cartao_final})` : ""} · {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                      </p>
                      {l.resposta_admin && <p className="mt-1 text-xs italic text-muted-foreground">{l.resposta_admin}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {l.status !== "corrigida" && l.status !== "descartada" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void abrirLayout(l.id)}>Baixar / Abrir</Button>
                          {l.status !== "em_modelagem" && (
                            <Button size="sm" variant="secondary" onClick={() => atualizarLayout.mutate({ id: l.id, status: "em_modelagem" })}>Em análise</Button>
                          )}
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => atualizarLayout.mutate({ id: l.id, status: "corrigida" })}>Concluído & Apagar PDF</Button>
                          <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => atualizarLayout.mutate({ id: l.id, status: "descartada" })}>Descartar</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chamados de suporte */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Chamados de Suporte</CardTitle>
                {chamadosPendentes > 0 && <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600">{chamadosPendentes} aberto(s)</span>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {chamados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum chamado de suporte.</p>
              ) : (
                chamados.map((c: any) => (
                  <div className="rounded-lg border p-3 space-y-1" key={c.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <b className="text-sm">{c.assunto}</b>
                        <p className="text-xs text-muted-foreground">{c.nome || c.email} · Protocolo: {c.protocolo?.substring(0, 8)}… · {new Date(c.criado_em).toLocaleDateString("pt-BR")}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.descricao}</p>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CHAMADO[c.status]?.color ?? ""}`}>
                        {STATUS_CHAMADO[c.status]?.label ?? c.status}
                      </span>
                    </div>
                    {c.resposta_admin && <p className="text-xs italic text-muted-foreground">Resposta: {c.resposta_admin}</p>}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDialogChamado({ id: c.id, status: c.status }); setStatusChamado(c.status); setRespostaChamado(""); }}
                    >
                      Responder / Atualizar
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 9: LOGS DE AUDITORIA ─── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">Log administrativo</CardTitle>
                <Input
                  className="w-48 h-8 text-xs"
                  placeholder="Filtrar por ação ou usuário"
                  value={filtroLog}
                  onChange={(e) => setFiltroLog(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-auto space-y-1">
              {logsVisiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
              ) : (
                logsVisiveis.map((l: any) => (
                  <details key={l.id} className="group rounded-lg border px-3 py-2 text-xs">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-semibold capitalize">{l.acao.replaceAll("_", " ")}</span>
                        <span className="ml-2 text-muted-foreground">
                          {l.profiles?.nome ?? l.profiles?.email ?? "Sistema"} · {new Date(l.criado_em).toLocaleString("pt-BR")}
                        </span>
                        {l.detalhes?.ip && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                            {l.detalhes.ip}{l.detalhes.cidade ? ` · ${l.detalhes.cidade}` : ""}
                          </span>
                        )}
                        {l.acao?.includes("falha") || l.acao?.includes("bloqueado") || l.acao?.includes("login_falhou") ? (
                          <span className="ml-2 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">⚠ Falha</span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground group-open:hidden">▼ detalhes</span>
                    </summary>
                    {l.detalhes && Object.keys(l.detalhes).length > 0 && (
                      <div className="mt-2 rounded bg-muted/60 p-2 font-mono text-[10px] whitespace-pre-wrap">
                        {JSON.stringify(l.detalhes, null, 2)}
                      </div>
                    )}
                  </details>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Dialog: Tratar privacidade ─── */}
      <Dialog open={!!dialogPriv} onOpenChange={(o) => { if (!o) { setDialogPriv(null); setRespostaPriv(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tratar Solicitação de Privacidade</DialogTitle>
            <DialogDescription>{dialogPriv?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={statusPriv} onValueChange={setStatusPriv}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_PRIVACIDADE).map(([v, s]) => (
                  <SelectItem key={v} value={v}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Tratativa / resposta (opcional — será enviada por e-mail se preenchida)"
              value={respostaPriv}
              onChange={(e) => setRespostaPriv(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogPriv(null); setRespostaPriv(""); }}>Cancelar</Button>
            <Button
              disabled={tratarPriv.isPending}
              onClick={() => {
                if (!dialogPriv) return;
                tratarPriv.mutate({ id: dialogPriv.id, status: statusPriv as any, resposta: respostaPriv || undefined });
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Atualizar chamado ─── */}
      <Dialog open={!!dialogChamado} onOpenChange={(o) => { if (!o) { setDialogChamado(null); setRespostaChamado(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Chamado de Suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={statusChamado} onValueChange={setStatusChamado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CHAMADO).map(([v, s]) => (
                  <SelectItem key={v} value={v}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Resposta ao usuário (opcional — será enviada por e-mail se preenchida)"
              value={respostaChamado}
              onChange={(e) => setRespostaChamado(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogChamado(null); setRespostaChamado(""); }}>Cancelar</Button>
            <Button
              disabled={atualizarChamado.isPending}
              onClick={() => {
                if (!dialogChamado) return;
                atualizarChamado.mutate({ id: dialogChamado.id, status: statusChamado as any, resposta: respostaChamado || undefined });
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
