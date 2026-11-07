import { ConteudoBancosPluggy } from "@/components/BancosPluggy";
import { ResumoUsoAdmin } from "@/components/ResumoUsoAdmin";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ModoClienteControle } from "@/components/ModoClienteControle";
import { LogPainel } from "@/components/LogPainel";
import { AvisoCalculadoraAdminCard } from "@/components/AvisoCalculadoraAdminCard";
import { BannerOfertaAdminCard } from "@/components/BannerOfertaAdminCard";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Handshake, MousePointerClick, Paperclip, Tag, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ADMIN_ONLY_CARD, ADMIN_ONLY_TAG } from "@/lib/areas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinksAdminHabilitar } from "@/components/LinksAdminHabilitar";
import { GestaoUsuariosAdmin } from "@/components/usuarios/GestaoUsuariosAdmin";
import { adminReativarUsuario } from "@/lib/admin.functions";
import { adminEnviarExportacaoEncerramento } from "@/lib/exportacao-conta.functions";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/useAuthData";
import { formatBRL } from "@/lib/format";
import {
  adminEncerrarComunicado,
  adminListarComunicados,
  adminAtualizarLayout,
  adminAtualizarComunicado,
  adminCriarComunicado,
  adminReenviarComunicado,
  adminListarLayouts,
  adminListarLogs,
  adminListarFalhasLogin,
  adminMetricas,
  adminObterLayoutUrl,
} from "@/lib/admin-avancado.functions";
import {
  adminAlternarGoogleDriveNotas,
  adminListarModulos,
  adminSalvarConfiguracaoAcesso,
  adminSalvarModulo,
  obterConfiguracaoAcesso,
  obterProtecaoAdmin,
  salvarProtecaoAdmin,
  verificarPinAdmin,
} from "@/lib/configuracoes-site.functions";
import {
  adminAlternarTour,
  adminObterTourConfig,
  adminReenviarTour,
} from "@/lib/tour.functions";
import { IaLancamentoModoSiteCard } from "@/components/IaLancamentoModoSiteCard";
import { AcessosSiteAdmin } from "@/components/AcessosSiteAdmin";
import { FunilAdmin, NovosUsuariosResumo } from "@/components/FunilAdmin";
import { PadroesAdmin } from "@/components/PadroesAdmin";
import { TelaInicialPadraoCard } from "@/components/TelaInicialPadraoCard";
import { RedispararAvisosCard } from "@/components/RedispararAvisosCard";
import {
  adminListarSolicitacoesPrivacidade,
  adminTratarSolicitacaoPrivacidade,
  adminListarChamados,
  adminAtualizarChamado,
  adminListarConvites,
  criarUploadAnexoChamado,
  listarMensagensChamado,
  obterUrlAnexoChamado,
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
import {
  adminAjustarCotaOracle,
  adminAlternarArmazenamentoOracle,
  adminListarArmazenamentoOracle,
} from "@/lib/oracle-admin.functions";
import {
  adminObterParceria,
  adminSalvarParceria,
  confirmarParceriaImagem,
  prepararUploadParceriaImagem,
} from "@/lib/parceria.functions";
import { adminObterPrecoHome, adminSalvarPrecoHome } from "@/lib/precos.functions";
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
import { TabelaOrdenavel } from "@/components/TabelaOrdenavel";
import { EnviarPushCard } from "@/components/EnviarPushCard";

// Item 8: `?aba=` permite que o botão "Tratar solicitação" dos e-mails de
// notificação abra a Administração já na aba certa (privacidade/central).
const GRUPOS_ADMIN: {
  id: string;
  titulo: string;
  descricao: string;
  abas: { id: string; rotulo: string }[];
}[] = [
  {
    id: "visao",
    titulo: "1. Visão geral",
    descricao: "Números do site e consulta de dados",
    abas: [
      { id: "dados-gerais", rotulo: "Dados Gerais" },
      { id: "resumo-uso", rotulo: "Resumo de uso" },
      { id: "consulta", rotulo: "Consulta" },
      { id: "funil", rotulo: "Funil e retenção" },
      { id: "acessos", rotulo: "Acessos ao site" },
    ],
  },
  {
    id: "pessoas",
    titulo: "2. Pessoas e pedidos",
    descricao: "Acesso, solicitações e privacidade",
    abas: [
      { id: "usuarios", rotulo: "Usuários (contas e convites)" },
      { id: "acesso", rotulo: "Acesso e Auth" },
      { id: "central", rotulo: "Central de Solicitações" },
      { id: "privacidade", rotulo: "Privacidade LGPD" },
    ],
  },
  {
    id: "site",
    titulo: "3. Site e módulos",
    descricao: "O que aparece e como aparece",
    abas: [
      { id: "modulos", rotulo: "Módulos" },
      { id: "personalizacao", rotulo: "Personalização" },
      { id: "avisos", rotulo: "Avisos" },
      { id: "links", rotulo: "Links" },
      { id: "padroes", rotulo: "Categorias e De-para" },
    ],
  },
  {
    id: "openfinance",
    titulo: "4. Open Finance",
    descricao: "Bancos e cartões conectados (teste)",
    abas: [{ id: "bancos", rotulo: "Bancos e cartões" }],
  },
  {
    id: "infra",
    titulo: "5. Armazenamento",
    descricao: "Arquivos e espaço em disco",
    abas: [{ id: "armazenamento", rotulo: "Armazenamento Oracle" }],
  },
  {
    id: "seguranca",
    titulo: "6. Segurança",
    descricao: "Histórico de ações e auditoria",
    abas: [{ id: "logs", rotulo: "Logs de Auditoria" }],
  },
];

export const Route = createFileRoute("/_authenticated/administracao")({
  validateSearch: (search: Record<string, unknown>) => ({
    aba: typeof search["aba"] === "string" ? search["aba"] : undefined,
  }),
  component: Admin,
});

/** De onde veio a tentativa de login, pelo navegador/app gravado no log. */
function origemLogin(ua: string | null | undefined): string {
  const t = String(ua ?? "");
  if (/ControlALL\/|CFNetwork|Darwin/i.test(t)) return "App iPhone";
  if (/okhttp|Expo|Dalvik/i.test(t)) return "App Android";
  if (/ControlALLApp/i.test(t)) return "App (site no app)";
  return t ? "Site" : "n/d";
}

/** "Atividade e espaço por usuário": títulos clicáveis para ordenar (31/10/2026). */
function TabelaAtividadeUsuarios({ usuarios }: { usuarios: any[] }) {
  return (
    <TabelaOrdenavel
      itens={usuarios}
      getChave={(u: any) => u.id}
      className="text-sm"
      colunas={[
        { titulo: "Usuário", celula: (u: any) => u.nome, ordenar: (u: any) => u.nome },
        {
          titulo: "Situação",
          celula: (u: any) =>
            u.ativo ? (
              <Badge variant="secondary" className="rounded-full bg-success/10 text-xs font-medium text-success">Ativa</Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full bg-destructive/10 text-xs font-medium text-destructive">Inativa</Badge>
            ),
          ordenar: (u: any) => (u.ativo ? "Ativa" : "Inativa"),
        },
        {
          titulo: "Última atividade",
          celula: (u: any) => (
            <span className="text-xs tabular-nums text-muted-foreground">
              {u.ultimaAtividadeEm ? new Date(u.ultimaAtividadeEm).toLocaleString("pt-BR") : "Sem acesso"}
            </span>
          ),
          ordenar: (u: any) => (u.ultimaAtividadeEm ? new Date(u.ultimaAtividadeEm) : null),
        },
        { titulo: "Arquivos", celula: (u: any) => <span className="tabular-nums">{u.arquivos}</span>, ordenar: (u: any) => Number(u.arquivos ?? 0) },
        { titulo: "Espaço", celula: (u: any) => <span className="tabular-nums">{formatarTamanho(u.bytesArmazenados)}</span>, ordenar: (u: any) => Number(u.bytesArmazenados ?? 0) },
        { titulo: "Grupo", celula: (u: any) => <span className="text-xs text-muted-foreground">{u.grupoNome}</span>, ordenar: (u: any) => u.grupoNome },
      ]}
    />
  );
}

const MOTIVOS_FALHA_LOGIN: Record<string, string> = {
  usuario_nao_cadastrado: "Usuário não cadastrado",
  senha_incorreta: "Senha incorreta",
  conta_bloqueada: "Conta bloqueada (tentativas)",
  conta_inativa: "Conta inativa",
  cpf_invalido: "CPF inválido",
  modo_login_nao_permitido: "Forma de login não permitida",
  outro: "Outro",
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_PRIVACIDADE: Record<string, { label: string; color: string }> = {
  recebida: { label: "Recebida", color: "bg-primary/10 text-primary" },
  em_analise: { label: "Em análise", color: "bg-warning/20 text-warning-foreground" },
  em_atendimento: { label: "Em atendimento", color: "bg-warning text-warning-foreground" },
  aguardando_ti: { label: "Aguardando TI", color: "bg-muted text-foreground" },
  planejado: { label: "Planejado", color: "bg-primary/5 text-primary" },
  programado: { label: "Programado", color: "bg-success/5 text-success" },
  concluida: { label: "Concluída", color: "bg-success/10 text-success" },
  indeferida: { label: "Indeferida", color: "bg-destructive/10 text-destructive" },
};

const STATUS_CHAMADO: Record<string, { label: string; color: string }> = {
  recebido: { label: "Recebido", color: "bg-primary/10 text-primary" },
  em_atendimento: { label: "Em atendimento", color: "bg-warning text-warning-foreground" },
  aguardando_usuario: { label: "Aguardando usuário", color: "bg-warning/20 text-warning-foreground" },
  resolvido: { label: "Resolvido", color: "bg-success/10 text-success" },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
};

const STATUS_LAYOUT: Record<string, { label: string; color: string }> = {
  recebida: { label: "Pendente", color: "bg-warning/20 text-warning-foreground" },
  em_modelagem: { label: "Em análise", color: "bg-primary/10 text-primary" },
  corrigida: { label: "Concluído", color: "bg-success/10 text-success" },
  descartada: { label: "Descartado", color: "bg-destructive/10 text-destructive" },
};

const STATUS_CONVITE: Record<string, { label: string; color: string }> = {
  usado: { label: "Usado", color: "bg-success/10 text-success" },
  pendente: { label: "Pendente", color: "bg-primary/10 text-primary" },
  expirado: { label: "Expirado", color: "bg-destructive/10 text-destructive" },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
};

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────
function Admin() {
  const { isSiteAdmin } = usePermissoes();
  const qc = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const parceriaImagemInput = useRef<HTMLInputElement>(null);
  const { aba: abaInicial } = Route.useSearch();
  const [abaAtiva, setAbaAtiva] = useState(abaInicial || "dados-gerais");

  // Server functions
  const layoutsFn = useServerFn(adminListarLayouts);
  const metricsFn = useServerFn(adminMetricas);
  const logsFn = useServerFn(adminListarLogs);
  const falhasLoginFn = useServerFn(adminListarFalhasLogin);
  const atualizarFn = useServerFn(adminAtualizarLayout);
  const obterLayoutUrl = useServerFn(adminObterLayoutUrl);
  const criarComunicadoFn = useServerFn(adminCriarComunicado);
  const prepararLogo = useServerFn(prepararUploadLogo);
  const confirmar = useServerFn(confirmarLogo);
  const prepararVideo = useServerFn(prepararUploadVideo);
  const confirmarVideoFn = useServerFn(confirmarVideo);
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const salvarConfig = useServerFn(adminSalvarConfiguracaoAcesso);
  const alternarGoogleDriveNotasFn = useServerFn(adminAlternarGoogleDriveNotas);
  const listarModulos = useServerFn(adminListarModulos);
  const salvarModulo = useServerFn(adminSalvarModulo);
  const listarComunicadosFn = useServerFn(adminListarComunicados);
  const encerrarComunicadoFn = useServerFn(adminEncerrarComunicado);
  const atualizarComunicadoFn = useServerFn(adminAtualizarComunicado);
  const reenviarComunicadoFn = useServerFn(adminReenviarComunicado);
  const obterTourConfigFn = useServerFn(adminObterTourConfig);
  const alternarTourFn = useServerFn(adminAlternarTour);
  const reenviarTourFn = useServerFn(adminReenviarTour);
  const privFn = useServerFn(adminListarSolicitacoesPrivacidade);
  const tratarPrivFn = useServerFn(adminTratarSolicitacaoPrivacidade);
  const chamadosFn = useServerFn(adminListarChamados);
  const reativarFn = useServerFn(adminReativarUsuario);
  const [reativandoConta, setReativandoConta] = useState<string | null>(null);
  const enviarExportacaoFn = useServerFn(adminEnviarExportacaoEncerramento);
  const [enviandoExportacao, setEnviandoExportacao] = useState<string | null>(null);
  const atualizarChamadoFn = useServerFn(adminAtualizarChamado);
  const criarUploadAnexoFn = useServerFn(criarUploadAnexoChamado);
  const mensagensChamadoFn = useServerFn(listarMensagensChamado);
  const urlAnexoChamadoFn = useServerFn(obterUrlAnexoChamado);
  const convitesFn = useServerFn(adminListarConvites);
  const economiaAutomaticaFn = useServerFn(obterEconomiaTotalAutomatica);
  const obterEstatisticaPublicaFn = useServerFn(obterEstatisticaPublica);
  const salvarEstatisticaFn = useServerFn(adminSalvarEstatisticaPublica);
  const listarArmazenamentoOracleFn = useServerFn(adminListarArmazenamentoOracle);
  const alternarArmazenamentoOracleFn = useServerFn(adminAlternarArmazenamentoOracle);
  const ajustarCotaOracleFn = useServerFn(adminAjustarCotaOracle);
  const obterParceriaFn = useServerFn(adminObterParceria);
  const salvarParceriaFn = useServerFn(adminSalvarParceria);
  const prepararParceriaImagemFn = useServerFn(prepararUploadParceriaImagem);
  const confirmarParceriaImagemFn = useServerFn(confirmarParceriaImagem);
  const obterPrecoFn = useServerFn(adminObterPrecoHome);
  const salvarPrecoFn = useServerFn(adminSalvarPrecoHome);

  // State
  const [titulo, setTitulo] = useState("");
  const [msg, setMsg] = useState("");
  const [comunicadoEditandoId, setComunicadoEditandoId] = useState<string | null>(null);
  const [sessaoMin, setSessaoMin] = useState<number>(60);
  const [cotaConvitesInput, setCotaConvitesInput] = useState<number>(3);
  const [dialogPriv, setDialogPriv] = useState<{ id: string; status: string; email: string } | null>(null);
  const [respostaPriv, setRespostaPriv] = useState("");
  const [statusPriv, setStatusPriv] = useState("em_atendimento");
  const [dialogChamado, setDialogChamado] = useState<{ id: string; status: string } | null>(null);
  const [respostaChamado, setRespostaChamado] = useState("");
  const [statusChamado, setStatusChamado] = useState("em_atendimento");
  const [arquivoChamado, setArquivoChamado] = useState<File | null>(null);
  const arquivoChamadoRef = useRef<HTMLInputElement>(null);
  const [filtroLog, setFiltroLog] = useState("");
  const [consultaDesbloqueada, setConsultaDesbloqueada] = useState(false);
  const [senhaConsulta, setSenhaConsulta] = useState("");
  const [erroSenhaConsulta, setErroSenhaConsulta] = useState("");
  const [pinConsulta, setPinConsulta] = useState("");
  const [preferirSenhaConta, setPreferirSenhaConta] = useState(false);
  const [novoPinInput, setNovoPinInput] = useState("");
  const [tipoProtecaoInput, setTipoProtecaoInput] = useState<"nenhuma" | "senha" | "pin">("senha");

  const { data: protecaoAdmin, isLoading: carregandoProtecao } = useQuery({
    queryKey: ["admin-protecao"],
    enabled: isSiteAdmin,
    queryFn: () => obterProtecaoAdmin(),
  });

  useEffect(() => {
    if (protecaoAdmin?.tipo) {
      setTipoProtecaoInput(protecaoAdmin.tipo);
      if (protecaoAdmin.tipo === "nenhuma") {
        setConsultaDesbloqueada(true);
      }
    }
  }, [protecaoAdmin?.tipo]);

  const salvarProtecaoMut = useMutation({
    mutationFn: (dados: { tipo: "nenhuma" | "senha" | "pin"; pin?: string }) =>
      salvarProtecaoAdmin({ data: dados }),
    onSuccess: () => {
      toast.success("Proteção de acesso à administração atualizada.");
      qc.invalidateQueries({ queryKey: ["admin-protecao"] });
      setNovoPinInput("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar proteção."),
  });

  const verificarPinMut = useMutation({
    mutationFn: (pin: string) => verificarPinAdmin({ data: { pin } }),
    onSuccess: (res) => {
      if (res.valido) {
        setConsultaDesbloqueada(true);
        setPinConsulta("");
        setErroSenhaConsulta("");
      } else {
        setErroSenhaConsulta(
          res.semPinConfigurado
            ? "Nenhum PIN configurado ainda. Acesse com sua senha."
            : "PIN incorreto.",
        );
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao validar PIN."),
  });

  const [economiaExibidaInput, setEconomiaExibidaInput] = useState("");
  const [cotaOracleInput, setCotaOracleInput] = useState<Record<string, string>>({});
  // Bloco de parceria/patrocínio da home (2026-09-27): URL e slogan ficam em
  // state local sincronizado com a query ao carregar/salvar — mesmo padrão
  // usado pra "economia exibida" logo acima.
  const [parceriaUrlInput, setParceriaUrlInput] = useState("");
  const [parceriaSloganInput, setParceriaSloganInput] = useState("");
  const [parceriaAtivoInput, setParceriaAtivoInput] = useState(false);
  // Bloco de preços da home (2026-09-28): mesmo padrão de state local
  // sincronizado com a query ao carregar/salvar. Os itens (lista de
  // benefícios) ficam num Textarea, um por linha, pra não precisar de um
  // editor de lista dedicado.
  const [precoNomeInput, setPrecoNomeInput] = useState("");
  const [precoValorInput, setPrecoValorInput] = useState("");
  const [precoSufixoInput, setPrecoSufixoInput] = useState("");
  const [precoDescricaoInput, setPrecoDescricaoInput] = useState("");
  const [precoItensInput, setPrecoItensInput] = useState("");
  const [precoBotaoInput, setPrecoBotaoInput] = useState("");

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
  const { data: falhasLogin = [] } = useQuery({
    queryKey: ["admin-falhas-login"],
    enabled: isSiteAdmin,
    queryFn: () => falhasLoginFn(),
  });
  const { data: config } = useQuery<{ modo_login: "cpf" | "email" | "ambos"; segundo_fator_email: boolean; sessao_maxima_minutos: number; cota_convites: number; google_drive_habilitado: boolean; cadastro_livre_habilitado: boolean } | undefined>({
    queryKey: ["configuracao-acesso-publica"],
    enabled: isSiteAdmin,
    queryFn: () => obterConfig() as any,
  });
  const { data: tourConfig } = useQuery({
    queryKey: ["admin-tour-config"],
    enabled: isSiteAdmin,
    queryFn: () => obterTourConfigFn(),
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
  const { data: mensagensChamadoAdmin = [] } = useQuery({
    queryKey: ["mensagens-chamado-admin", dialogChamado?.id],
    enabled: !!dialogChamado?.id,
    queryFn: () => mensagensChamadoFn({ data: { chamadoId: dialogChamado!.id } }),
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
    queryKey: ["identidade-visual-site-admin"],
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
  const { data: armazenamentoOracle = [] } = useQuery({
    queryKey: ["admin-armazenamento-oracle"],
    enabled: isSiteAdmin,
    queryFn: () => listarArmazenamentoOracleFn(),
  });
  const { data: parceria } = useQuery({
    queryKey: ["admin-parceria-home"],
    enabled: isSiteAdmin,
    queryFn: () => obterParceriaFn(),
  });
  const { data: precoHome } = useQuery({
    queryKey: ["admin-preco-home"],
    enabled: isSiteAdmin,
    queryFn: () => obterPrecoFn(),
  });

  useEffect(() => {
    if (estatisticaPublica && estatisticaPublica.economiaTotalExibida !== null) {
      setEconomiaExibidaInput(String(estatisticaPublica.economiaTotalExibida));
    }
  }, [estatisticaPublica]);

  useEffect(() => {
    if (parceria) {
      setParceriaUrlInput(parceria.url ?? "");
      setParceriaSloganInput(parceria.slogan ?? "");
      setParceriaAtivoInput(parceria.ativo);
    }
  }, [parceria]);

  useEffect(() => {
    if (precoHome) {
      setPrecoNomeInput(precoHome.nome);
      setPrecoValorInput(String(precoHome.preco));
      setPrecoSufixoInput(precoHome.sufixo);
      setPrecoDescricaoInput(precoHome.descricao);
      setPrecoItensInput(precoHome.itens.join("\n"));
      setPrecoBotaoInput(precoHome.botaoTexto);
    }
  }, [precoHome]);

  // Mutations
  const salvarAcesso = useMutation({
    mutationFn: (valor: { modoLogin: "cpf" | "email" | "ambos"; segundoFatorEmail: boolean; sessaoMaximaMinutos: number; cotaConvites: number; cadastroLivreHabilitado?: boolean }) =>
      salvarConfig({ data: valor }),
    onSuccess: () => { toast.success("Configuração de acesso salva."); qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const alternarGoogleDriveNotas = useMutation({
    mutationFn: (habilitado: boolean) => alternarGoogleDriveNotasFn({ data: { habilitado } }),
    onSuccess: () => {
      toast.success("Preferência do Google Drive (Notas) atualizada.");
      qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] });
    },
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

  const alternarOracle = useMutation({
    mutationFn: (valor: { grupoId: string; habilitado: boolean }) => alternarArmazenamentoOracleFn({ data: valor }),
    onSuccess: () => {
      toast.success("Armazenamento Oracle atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-armazenamento-oracle"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ajustarCotaOracle = useMutation({
    mutationFn: (valor: { grupoId: string; cotaMb: number }) => ajustarCotaOracleFn({ data: valor }),
    onSuccess: () => {
      toast.success("Cota do grupo atualizada.");
      qc.invalidateQueries({ queryKey: ["admin-armazenamento-oracle"] });
    },
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
    onSuccess: () => { toast.success("Aviso encerrado. Não aparece mais pra ninguém."); qc.invalidateQueries({ queryKey: ["admin-comunicados"] }); qc.invalidateQueries({ queryKey: ["comunicados-pendentes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reenviarAviso = useMutation({
    mutationFn: (id: string) => reenviarComunicadoFn({ data: { id } }),
    onSuccess: () => { toast.success("Aviso reenviado. Vai reaparecer pra todos, inclusive quem já confirmou."); qc.invalidateQueries({ queryKey: ["admin-comunicados"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const alternarTour = useMutation({
    mutationFn: (ativo: boolean) => alternarTourFn({ data: { ativo } }),
    onSuccess: () => { toast.success("Tour guiado atualizado."); qc.invalidateQueries({ queryKey: ["admin-tour-config"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reenviarTour = useMutation({
    mutationFn: () => reenviarTourFn(),
    onSuccess: () => { toast.success("Tour reenviado. Vai aparecer novamente pra quem já tinha visto."); qc.invalidateQueries({ queryKey: ["admin-tour-config"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarLayout = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "corrigida" | "descartada" | "em_modelagem" }) => atualizarFn({ data: { id, status: status as any } }),
    onSuccess: () => { toast.success("Solicitação atualizada."); qc.invalidateQueries({ queryKey: ["admin-layouts"] }); qc.invalidateQueries({ queryKey: ["admin-logs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const comunicadoMut = useMutation({
    mutationFn: () =>
      comunicadoEditandoId
        ? atualizarComunicadoFn({ data: { id: comunicadoEditandoId, titulo, mensagem: msg } })
        : criarComunicadoFn({ data: { titulo, mensagem: msg, exigeAceite: true } }),
    onSuccess: () => {
      toast.success(
        comunicadoEditandoId
          ? "Aviso atualizado. Vai reaparecer pra quem já tinha confirmado."
          : "Aviso publicado.",
      );
      setTitulo("");
      setMsg("");
      setComunicadoEditandoId(null);
      qc.invalidateQueries({ queryKey: ["admin-comunicados"] });
      qc.invalidateQueries({ queryKey: ["comunicados-pendentes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tratarPriv = useMutation({
    mutationFn: (p: { id: string; status: any; resposta?: string | undefined }) =>
      tratarPrivFn({ data: p.resposta ? { id: p.id, status: p.status, resposta: p.resposta } : { id: p.id, status: p.status } }),
    onSuccess: () => { toast.success("Solicitação atualizada."); qc.invalidateQueries({ queryKey: ["admin-privacidade"] }); setDialogPriv(null); setRespostaPriv(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarChamado = useMutation({
    mutationFn: async (p: { id: string; status: any; resposta?: string | undefined }) => {
      let anexo: { path: string; nome: string; tipo: string } | undefined;
      if (arquivoChamado) {
        const upload = await criarUploadAnexoFn({
          data: {
            nomeArquivo: arquivoChamado.name,
            tipoMime: arquivoChamado.type,
            tamanhoBytes: arquivoChamado.size,
          },
        });
        const { error } = await supabase.storage
          .from("anexos")
          .uploadToSignedUrl(upload.path, upload.token, arquivoChamado);
        if (error) throw error;
        anexo = { path: upload.path, nome: upload.nome, tipo: upload.tipo };
      }
      return atualizarChamadoFn({
        data: {
          id: p.id,
          status: p.status,
          ...(p.resposta ? { resposta: p.resposta } : {}),
          ...(anexo ? { anexo } : {}),
        },
      });
    },
    onSuccess: (_res, p) => {
      toast.success("Chamado atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-chamados"] });
      qc.invalidateQueries({ queryKey: ["mensagens-chamado-admin", p.id] });
      setDialogChamado(null);
      setRespostaChamado("");
      setArquivoChamado(null);
      if (arquivoChamadoRef.current) arquivoChamadoRef.current.value = "";
    },
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
      qc.invalidateQueries({ queryKey: ["identidade-visual-site-admin"] });
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
      qc.invalidateQueries({ queryKey: ["identidade-visual-site-admin"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast.success("Vídeo de demonstração atualizado.");
    } catch (e: any) { toast.error(e.message || "Não foi possível atualizar o vídeo."); }
    finally { if (videoInput.current) videoInput.current.value = ""; }
  }

  async function removerVideo() {
    try {
      await confirmarVideoFn({ data: { path: null } });
      qc.invalidateQueries({ queryKey: ["identidade-visual-site-admin"] });
      toast.success("Vídeo removido da home.");
    } catch (e: any) { toast.error(e.message || "Não foi possível remover o vídeo."); }
  }

  const salvarParceria = useMutation({
    mutationFn: () =>
      salvarParceriaFn({
        data: { url: parceriaUrlInput.trim(), slogan: parceriaSloganInput.trim() || null, ativo: parceriaAtivoInput },
      }),
    onSuccess: () => {
      toast.success("Parceria da home salva.");
      qc.invalidateQueries({ queryKey: ["admin-parceria-home"] });
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível salvar a parceria."),
  });

  const salvarPreco = useMutation({
    mutationFn: () =>
      salvarPrecoFn({
        data: {
          nome: precoNomeInput.trim(),
          preco: Number(precoValorInput.replace(",", ".")) || 0,
          sufixo: precoSufixoInput.trim(),
          descricao: precoDescricaoInput.trim(),
          itens: precoItensInput
            .split("\n")
            .map((linha) => linha.trim())
            .filter(Boolean),
          botaoTexto: precoBotaoInput.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Preços da home salvos.");
      qc.invalidateQueries({ queryKey: ["admin-preco-home"] });
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível salvar os preços."),
  });

  async function subirParceriaImagem(files: FileList | null) {
    const arquivo = files?.[0];
    if (!arquivo) return;
    if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
      toast.error("Envie JPG, PNG ou WEBP de até 5 MB.");
      return;
    }
    try {
      const envio = await prepararParceriaImagemFn({ data: { nome: arquivo.name } });
      const { error } = await supabase.storage.from("site_assets").uploadToSignedUrl(envio.path, envio.token, arquivo);
      if (error) throw error;
      await confirmarParceriaImagemFn({ data: { path: envio.path } });
      qc.invalidateQueries({ queryKey: ["admin-parceria-home"] });
      toast.success("Prévia da parceria atualizada.");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar a imagem.");
    } finally {
      if (parceriaImagemInput.current) parceriaImagemInput.current.value = "";
    }
  }

  if (!isSiteAdmin)
    return (
      <AppLayout title="Administração">
        <Card><CardContent className="p-8 text-center text-muted-foreground">Área restrita ao administrador do site.</CardContent></Card>
      </AppLayout>
    );

  // A proteção configurada protege a ENTRADA da tela inteira:
  // - "nenhuma": entra direto sem bloqueio
  // - "pin": exige o PIN de 4 dígitos
  // - "senha": exige a senha da conta
  // 31/10/2026: enquanto a configuração da proteção carrega, mostra "Carregando" em vez da tela de senha
  // (antes a tela de senha piscava e sumia para quem usa "Sem senha").
  if (carregandoProtecao && !consultaDesbloqueada)
    return (
      <AppLayout title="Administração do site" description="Painel de controle administrativo">
        <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando a administração...</CardContent></Card>
      </AppLayout>
    );
  const tipoProtecao = protecaoAdmin?.tipo ?? "senha";
  const emModoPin = tipoProtecao === "pin" && !preferirSenhaConta;

  if (!consultaDesbloqueada && tipoProtecao !== "nenhuma")
    return (
      <AppLayout title="Administração do site" description="Painel de controle administrativo">
        <Card>
          <CardContent className="p-6 space-y-4 max-w-sm mx-auto">
            <div className="text-center space-y-1">
              <div className="flex justify-center mb-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-warning/20">
                  <svg className="size-6 text-warning-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
              </div>
              <p className="font-semibold">Área protegida</p>
              <p className="text-xs text-muted-foreground">
                {emModoPin
                  ? "Digite seu PIN de 4 dígitos para acessar a administração."
                  : "Confirme sua senha de acesso para entrar na administração."}
              </p>
            </div>

            {emModoPin ? (
              <div className="space-y-3">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="PIN de 4 dígitos"
                  className="text-center text-xl tracking-widest font-mono"
                  value={pinConsulta}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPinConsulta(v);
                    setErroSenhaConsulta("");
                    if (v.length === 4) {
                      verificarPinMut.mutate(v);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pinConsulta.length === 4) {
                      verificarPinMut.mutate(pinConsulta);
                    }
                  }}
                />
                {erroSenhaConsulta && <p className="text-xs text-destructive text-center">{erroSenhaConsulta}</p>}
                <Button
                  className="w-full"
                  disabled={pinConsulta.length !== 4 || verificarPinMut.isPending}
                  onClick={() => verificarPinMut.mutate(pinConsulta)}
                >
                  {verificarPinMut.isPending ? "Verificando…" : "Confirmar PIN"}
                </Button>
                <div className="text-center pt-1">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                    onClick={() => {
                      setPreferirSenhaConta(true);
                      setErroSenhaConsulta("");
                    }}
                  >
                    Entrar com a senha da conta
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
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
                {erroSenhaConsulta && <p className="text-xs text-destructive text-center">{erroSenhaConsulta}</p>}
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
                {protecaoAdmin?.temPin && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                      onClick={() => {
                        setPreferirSenhaConta(false);
                        setErroSenhaConsulta("");
                      }}
                    >
                      Entrar com PIN de 4 dígitos
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </AppLayout>
    );

  // Contadores de badge
  const layoutsPendentes = layouts.filter((l: any) => l.status === "recebida" || l.status === "em_modelagem").length;
  const privPendentes = pedidos.filter((p: any) => p.status === "recebida" || p.status === "em_atendimento" || p.status === "em_analise").length;
  const chamadosPendentes = chamados.filter((c: any) => c.status === "recebido" || c.status === "em_atendimento").length;

  async function abrirAnexoChamado(chamadoId: string, path: string) {
    try {
      const { url } = await urlAnexoChamadoFn({ data: { chamadoId, path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível abrir o anexo.");
    }
  }
  const totalPendentes = layoutsPendentes + privPendentes + chamadosPendentes;

  const logsVisiveis = filtroLog
    ? logs.filter((l: any) => l.acao.includes(filtroLog.toLowerCase()) || l.profiles?.nome?.toLowerCase().includes(filtroLog.toLowerCase()))
    : logs;

  return (
    <AppLayout title="Administração do site" description="Painel de controle administrativo">
      <div className="mb-6 space-y-3">
        <ModoClienteControle />
        <nav aria-label="Atalhos de administração" className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/usuarios">Usuários e privilégios</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/backup">Backup e Reset</Link></Button>
        </nav>
      </div>
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-6">
        <NovosUsuariosResumo />
        {/* Grupos (2026-10-06): as 10 abas foram agrupadas por assunto. Primeiro
            escolhe-se o grupo, depois a aba dentro dele. Os valores das abas e
            seus conteudos nao mudaram (links com ?aba= continuam validos). */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Grupos da administração">
          {GRUPOS_ADMIN.map((g) => {
            const ativo = g.abas.some((a) => a.id === abaAtiva);
            const pend = g.abas.some((a) => a.id === "central") ? totalPendentes : 0;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setAbaAtiva(g.abas[0]!.id)}
                aria-pressed={ativo}
                className={cn(
                  "relative rounded-2xl border p-4 text-left transition-colors",
                  ativo ? "border-primary bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <p className={cn("text-sm font-semibold", ativo && "text-primary")}>{g.titulo}</p>
                <p className="text-xs text-muted-foreground">{g.descricao}</p>
                {pend > 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                    {pend}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={ADMIN_ONLY_TAG}>Só admin</span>
          Itens em roxo ainda não foram liberados aos usuários.
        </p>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {(GRUPOS_ADMIN.find((g) => g.abas.some((a) => a.id === abaAtiva)) ?? GRUPOS_ADMIN[0]!).abas.map((a) => (
            <TabsTrigger key={a.id} value={a.id} className="relative">
              {a.rotulo}
              {a.id === "central" && totalPendentes > 0 && (
                <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                  {totalPendentes}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumo-uso" className="space-y-6">
          <ResumoUsoAdmin />
        </TabsContent>

        <TabsContent value="bancos" className="space-y-6">
          <ConteudoBancosPluggy embutido />
        </TabsContent>

        <TabsContent value="funil" className="space-y-6">
          <FunilAdmin />
        </TabsContent>

        <TabsContent value="acessos" className="space-y-6">
          <AcessosSiteAdmin />
        </TabsContent>

        <TabsContent value="padroes" className="space-y-6">
          <PadroesAdmin />
        </TabsContent>

        {/* ─── ABA 1: DADOS GERAIS ─── */}
        <TabsContent value="dados-gerais" className="space-y-6">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Atividade e espaço por usuário</CardTitle>
              <p className="text-sm text-muted-foreground">Sem CPF, por segurança.</p>
            </CardHeader>
            <CardContent>
            <div className="max-h-96 overflow-auto rounded-2xl border">
              <TabelaAtividadeUsuarios usuarios={(metricas?.usuarios ?? []) as any[]} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Armazenamento não atribuído: <span className="tabular-nums">{formatarTamanho(metricas?.armazenamentoNaoAtribuidoBytes ?? 0)}</span>.
            </p>
            </CardContent>
          </Card>
          {/* Métricas gerais */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="space-y-1 p-5"><p className="text-sm text-muted-foreground">Usuários cadastrados</p><p className="text-2xl font-semibold tabular-nums">{metricas?.total ?? 0}</p></CardContent></Card>
            <Card><CardContent className="space-y-1 p-5"><p className="text-sm text-muted-foreground">Contas ativas</p><p className="text-2xl font-semibold tabular-nums">{metricas?.ativos ?? 0}</p></CardContent></Card>
            <Card><CardContent className="space-y-1 p-5"><p className="text-sm text-muted-foreground">Tempo médio de sessão</p><p className="text-2xl font-semibold tabular-nums">{metricas?.tempoMedioMin ?? 0} min</p></CardContent></Card>
          </div>

          {/* Convites */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Convites</CardTitle>
              <p className="text-sm text-muted-foreground">
                Limite de <span className="tabular-nums">{config?.cota_convites ?? 3}</span> por usuário comum, ajustável em Acesso e Auth. Você não tem limite.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Usados</p><p className="text-lg font-semibold tabular-nums">{(convites as any[]).filter((c: any) => c.status === "usado").length}</p></div>
                <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-lg font-semibold tabular-nums">{(convites as any[]).filter((c: any) => c.status === "pendente").length}</p></div>
                <div><p className="text-xs text-muted-foreground">Cancelados</p><p className="text-lg font-semibold tabular-nums">{(convites as any[]).filter((c: any) => c.status === "cancelado").length}</p></div>
                <div><p className="text-xs text-muted-foreground">Expirados</p><p className="text-lg font-semibold tabular-nums">{(convites as any[]).filter((c: any) => c.status === "expirado").length}</p></div>
              </div>
              <div className="max-h-60 overflow-auto rounded-2xl border">
                <TabelaOrdenavel
                  itens={convites as any[]}
                  getChave={(c: any) => c.id}
                  className="text-xs"
                  celulaClassName="px-3 py-2"
                  colunas={[
                    { titulo: "Criador", celula: (c: any) => c.criador_nome, ordenar: (c: any) => c.criador_nome },
                    {
                      titulo: "Status",
                      celula: (c: any) => (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONVITE[c.status]?.color ?? ""}`}>
                          {STATUS_CONVITE[c.status]?.label ?? c.status}
                        </span>
                      ),
                      ordenar: (c: any) => STATUS_CONVITE[c.status]?.label ?? c.status,
                    },
                    { titulo: "Criado em", celula: (c: any) => <span className="tabular-nums">{new Date(c.criado_em).toLocaleDateString("pt-BR")}</span>, ordenar: (c: any) => new Date(c.criado_em) },
                    { titulo: "Expira em", celula: (c: any) => <span className="tabular-nums">{new Date(c.expira_em).toLocaleDateString("pt-BR")}</span>, ordenar: (c: any) => new Date(c.expira_em) },
                  ]}
                />
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
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Composição dos grupos</CardTitle>
              <p className="text-sm text-muted-foreground">Nomes e integrantes, sem nenhum valor financeiro.</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {(metricas?.grupos ?? []).map((g: any) => (
                <div key={g.id} className="overflow-hidden rounded-2xl border">
                  <div className="flex items-baseline justify-between gap-4 bg-muted/40 px-4 py-3">
                    <p className="truncate text-sm font-semibold">{g.nome}</p>
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{g.membros.length} integrante(s)</p>
                  </div>
                  <div className="divide-y">
                    {g.membros.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {(m.nome ?? "").trim().charAt(0).toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{m.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.email ?? "sem e-mail"}</p>
                        </div>
                        <span className={m.ativo ? "shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success" : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"}>
                          {m.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 2: CONSULTA ─── */}
        {/* 2026-09-27: a senha extra agora é pedida uma única vez na ENTRADA
            de toda a rota /administracao (ver o gate antes do `return`
            principal) — essa aba não pede senha de novo, já chega liberada. */}
        <TabsContent value="consulta" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">Atividade e espaço por usuário</CardTitle>
                  <p className="text-sm text-muted-foreground">Sem CPF, por segurança.</p>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 text-xs text-muted-foreground" onClick={() => setConsultaDesbloqueada(false)}>
                  🔒 Bloquear administração
                </Button>
              </div>
            </CardHeader>
            <CardContent>
            <div className="max-h-96 overflow-auto rounded-2xl border">
              <TabelaAtividadeUsuarios usuarios={(metricas?.usuarios ?? []) as any[]} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Armazenamento não atribuído: {formatarTamanho(metricas?.armazenamentoNaoAtribuidoBytes ?? 0)}.
            </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 3: ACESSO E AUTENTICAÇÃO ─── */}
        <TabsContent value="usuarios" className="space-y-6">
          <GestaoUsuariosAdmin />
        </TabsContent>

        <TabsContent value="acesso" className="space-y-6">
          {/* Card Proteção de Entrada na Administração (Pedido 7) */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Proteção da Administração</CardTitle>
              <p className="text-sm text-muted-foreground">Como a entrada neste painel é protegida.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y rounded-2xl border">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Tipo de bloqueio</p>
                    <p className="text-xs text-muted-foreground">Pedido ao abrir a Administração.</p>
                  </div>
                  <Select
                    value={tipoProtecaoInput}
                    onValueChange={(v: any) => {
                      setTipoProtecaoInput(v);
                      if (v !== "pin") {
                        salvarProtecaoMut.mutate({ tipo: v });
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 w-48 shrink-0 sm:w-60" aria-label="Tipo de bloqueio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="senha">Senha da conta (padrão)</SelectItem>
                      <SelectItem value="pin">PIN numérico de 4 dígitos</SelectItem>
                      <SelectItem value="nenhuma">Sem senha (acesso direto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tipoProtecaoInput === "pin" && (
                  <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {protecaoAdmin?.temPin ? "Alterar PIN de 4 dígitos" : "Criar PIN de 4 dígitos"}
                    </p>
                    {protecaoAdmin?.temPin && (
                      <p className="text-xs text-muted-foreground">
                        PIN atual ativo. Digite 4 novos números para alterar.
                      </p>
                    )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Ex.: 1234"
                        className="h-10 text-center font-mono tracking-widest max-w-[140px]"
                        value={novoPinInput}
                        onChange={(e) => setNovoPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      />
                      <Button
                        className="h-10"
                        disabled={novoPinInput.length !== 4 || salvarProtecaoMut.isPending}
                        onClick={() => salvarProtecaoMut.mutate({ tipo: "pin", pin: novoPinInput })}
                      >
                        {salvarProtecaoMut.isPending ? "Salvando…" : "Salvar PIN"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {config && (
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base font-bold">Acesso e autenticação</CardTitle>
                <p className="text-sm text-muted-foreground">Login, verificação, sessão e convites.</p>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-2xl border">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Identificador no login</p>
                    <p className="text-xs text-muted-foreground">O que a pessoa digita para entrar.</p>
                  </div>
                  <Select
                    value={config.modo_login}
                    onValueChange={(v) => salvarAcesso.mutate({ modoLogin: v as any, segundoFatorEmail: config.segundo_fator_email, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  >
                    <SelectTrigger className="w-44 shrink-0 sm:w-52" aria-label="Identificador no login"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">Somente CPF</SelectItem>
                      <SelectItem value="email">Somente e-mail</SelectItem>
                      <SelectItem value="ambos">CPF ou e-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Verificação em duas etapas</span>
                    <span className="block text-xs text-muted-foreground">Código enviado por e-mail no login.</span>
                  </span>
                  <Switch
                    checked={config.segundo_fator_email}
                    onCheckedChange={(v) => salvarAcesso.mutate({ modoLogin: config.modo_login, segundoFatorEmail: v, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Sessão máxima</p>
                    <p className="text-xs text-muted-foreground">Em minutos, de 15 a 480.</p>
                  </div>
                  <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    aria-label="Sessão máxima em minutos"
                    className="w-24 text-right tabular-nums"
                    value={sessaoMin}
                    onChange={(e) => setSessaoMin(Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => salvarAcesso.mutate({ modoLogin: config.modo_login, segundoFatorEmail: config.segundo_fator_email, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  >
                    Salvar
                  </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Cota de convites por usuário</p>
                    <p className="text-xs text-muted-foreground">Vale para todos. Você convida sem limite.</p>
                  </div>
                  <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    aria-label="Cota de convites por usuário"
                    className="w-24 text-right tabular-nums"
                    value={cotaConvitesInput}
                    onChange={(e) => setCotaConvitesInput(Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => salvarAcesso.mutate({ modoLogin: config.modo_login, segundoFatorEmail: config.segundo_fator_email, sessaoMaximaMinutos: sessaoMin, cotaConvites: cotaConvitesInput })}
                  >
                    Salvar
                  </Button>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          )}
          <AvisoCalculadoraAdminCard />
          <BannerOfertaAdminCard />
          {config && (
            <Card className={cn(!config.google_drive_habilitado && ADMIN_ONLY_CARD)}>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-bold">Notas fiscais: Google Drive{!config.google_drive_habilitado && <span className={ADMIN_ONLY_TAG}>Só admin</span>}</CardTitle>
                <p className="text-sm text-muted-foreground">Seção de pasta do Drive em Notas fiscais.</p>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-2xl border">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Mostrar para usuários comuns</p>
                  <p className="text-xs text-muted-foreground">
                    Desligado, só você vê a seção. Quem já conectou continua funcionando.
                  </p>
                </div>
                <Switch
                  checked={config.google_drive_habilitado}
                  onCheckedChange={(v) => alternarGoogleDriveNotas.mutate(v)}
                  aria-label="Mostrar seção do Google Drive para usuários comuns"
                />
                </div>
                </div>
              </CardContent>
            </Card>
          )}
          {config && (
            <Card className={cn(!config.cadastro_livre_habilitado && ADMIN_ONLY_CARD)}>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-bold">Cadastro sem convite{!config.cadastro_livre_habilitado && <span className={ADMIN_ONLY_TAG}>Desligado</span>}</CardTitle>
                <p className="text-sm text-muted-foreground">Abre a criação de conta para quem não tem código.</p>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-2xl border">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Permitir criar conta sem código</p>
                  <p className="text-xs text-muted-foreground">
                    Cada pessoa ganha um grupo próprio e isolado. Quem tem código continua podendo usar.
                  </p>
                </div>
                <Switch
                  aria-label="Permitir criar conta sem código de convite"
                  checked={config.cadastro_livre_habilitado}
                  onCheckedChange={(v) =>
                    salvarAcesso.mutate({
                      modoLogin: config.modo_login,
                      segundoFatorEmail: config.segundo_fator_email,
                      sessaoMaximaMinutos: sessaoMin,
                      cotaConvites: cotaConvitesInput,
                      cadastroLivreHabilitado: v,
                    })
                  }
                />
                </div>
                </div>
              </CardContent>
            </Card>
          )}
          <IaLancamentoModoSiteCard />
          <TelaInicialPadraoCard />
          <RedispararAvisosCard />
          <EnviarPushCard />
        </TabsContent>

        {/* ─── ABA 4: MÓDULOS ─── */}
        <TabsContent value="modulos" className="space-y-6">
          {gestaoModulos && (
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base font-bold">Módulos e exceções</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Desative um módulo para todos e libere só para quem vai testar. O admin master sempre vê tudo.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                <label htmlFor="busca-modulo" className="text-sm font-medium">Buscar usuário</label>
                <Input
                  id="busca-modulo"
                  placeholder="Nome ou e-mail"
                  value={buscaModulo}
                  onChange={(e) => setBuscaModulo(e.target.value)}
                  className="max-w-sm"
                />
                </div>
                <div className="divide-y overflow-hidden rounded-2xl border">
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
                    <div key={m.modulo} className={cn("px-4 py-3", !m.habilitado && ADMIN_ONLY_CARD)}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{m.nome}</span>
                          {!m.habilitado && <span className={ADMIN_ONLY_TAG}>Só admin</span>}
                          {!m.habilitado && (
                            <Badge variant="secondary" className="rounded-full text-xs font-medium tabular-nums">
                              {liberados} com exceção liberada
                            </Badge>
                          )}
                        </div>
                        <Switch
                          aria-label={`Módulo ${m.nome} ligado para todos`}
                          checked={m.habilitado}
                          onCheckedChange={(v) => mudarModulo.mutate({ modulo: m.modulo, habilitado: v, userId: null })}
                        />
                      </div>
                      {!m.habilitado && (
                        <div className="mt-3 space-y-3">
                          {selecionados.size > 0 && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                              <span className="mr-auto text-xs tabular-nums text-muted-foreground">
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
                                <div key={u.id} className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
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
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── ABA: ARMAZENAMENTO ORACLE ─── */}
        <TabsContent value="armazenamento" className="space-y-6">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Armazenamento Oracle por grupo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Destino preferencial dos comprovantes de notas fiscais. Cota inicial de 500 MB por membro.
              </p>
            </CardHeader>
            <CardContent>
              {armazenamentoOracle.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
              ) : (
                <div className="divide-y overflow-hidden rounded-2xl border">
                {armazenamentoOracle.map((g) => {
                  const percentual = g.cotaBytes > 0 ? Math.min(100, (g.usadoBytes / g.cotaBytes) * 100) : 0;
                  const cotaMbAtual = Math.round(g.cotaBytes / (1024 * 1024));
                  const inputAtual = cotaOracleInput[g.grupoId] ?? String(cotaMbAtual);
                  return (
                    <div key={g.grupoId} className={cn("space-y-3 px-4 py-3", !g.habilitado && ADMIN_ONLY_CARD)}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{g.nome}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {g.membros} membro(s)
                          </p>
                        </div>
                        <Switch
                          aria-label={`Oracle habilitado para ${g.nome}`}
                          checked={g.habilitado}
                          onCheckedChange={(v) => alternarOracle.mutate({ grupoId: g.grupoId, habilitado: v })}
                        />
                      </div>
                      {g.habilitado && (
                        <>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${percentual >= 90 ? "bg-destructive" : percentual >= 70 ? "bg-warning" : "bg-success"}`}
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              {formatarTamanho(g.usadoBytes)} usados de {formatarTamanho(g.cotaBytes)}{" "}
                              ({percentual.toFixed(1)}%)
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={1}
                                aria-label={`Cota em MB de ${g.nome}`}
                                className="h-8 w-24 text-right text-xs tabular-nums"
                                value={inputAtual}
                                onChange={(e) =>
                                  setCotaOracleInput((atual) => ({ ...atual, [g.grupoId]: e.target.value }))
                                }
                              />
                              <span>MB</span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={ajustarCotaOracle.isPending}
                                onClick={() => {
                                  const cotaMb = Number(inputAtual);
                                  if (!cotaMb || cotaMb <= 0) {
                                    toast.error("Informe uma cota válida em MB.");
                                    return;
                                  }
                                  ajustarCotaOracle.mutate({ grupoId: g.grupoId, cotaMb });
                                }}
                              >
                                Salvar cota
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 5: PERSONALIZAÇÃO ─── */}
        <TabsContent value="personalizacao" className="space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-bold">Logo do Control ALL</h2>
                <p className="text-sm text-muted-foreground">Usada na home, no login e nas áreas internas. JPG, PNG, WEBP ou GIF, até 5 MB.</p>
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
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-bold">Vídeo de demonstração</h2>
                <p className="text-sm text-muted-foreground">
                  Seção "Demonstração" da home pública. MP4, WEBM ou MOV, até 100 MB.
                  {identidadeVisual?.video_demonstracao_path ? " Há um vídeo publicado agora." : " Nenhum vídeo publicado ainda."}
                </p>
              </div>
              <div className="flex gap-3">
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

          {/* Bloco de preços da home (2026-09-28): valor, sufixo, descrição,
              itens (lista de benefícios) e texto do botão — tudo editável
              aqui, sem precisar tocar em código pra mudar o preço exibido. */}
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <Tag className="size-4 text-muted-foreground" aria-hidden="true" /> Preços na home
                </h2>
                <p className="text-sm text-muted-foreground">Card da seção "Preços" da home pública.</p>
              </div>

              <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome do plano</label>
                  <Input value={precoNomeInput} onChange={(e) => setPrecoNomeInput(e.target.value)} placeholder="Control ALL" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Texto do botão</label>
                  <Input value={precoBotaoInput} onChange={(e) => setPrecoBotaoInput(e.target.value)} placeholder="Criar conta" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <Input
                    inputMode="decimal"
                    className="tabular-nums"
                    value={precoValorInput}
                    onChange={(e) => setPrecoValorInput(e.target.value)}
                    placeholder="4.99"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sufixo (ex.: /mês)</label>
                  <Input value={precoSufixoInput} onChange={(e) => setPrecoSufixoInput(e.target.value)} placeholder="/mês" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descrição (abaixo do preço)</label>
                <Input
                  value={precoDescricaoInput}
                  onChange={(e) => setPrecoDescricaoInput(e.target.value)}
                  placeholder="Preço de lançamento previsto."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Itens listados <span className="font-normal text-muted-foreground">(um por linha)</span>
                </label>
                <Textarea
                  value={precoItensInput}
                  onChange={(e) => setPrecoItensInput(e.target.value)}
                  placeholder={"Módulos pessoais e financeiros\nAlertas e histórico\nCompartilhamento controlado\nPrivacidade por padrão"}
                  className="min-h-[110px] text-sm"
                />
              </div>

              </div>

              <div className="flex justify-end gap-3">
                <Button onClick={() => salvarPreco.mutate()} disabled={salvarPreco.isPending}>
                  {salvarPreco.isPending ? "Salvando..." : "Salvar preços"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Parceria/patrocínio discreto na home (2026-09-27, a pedido do
              usuário): um link "patrocinado" pro site de um parceiro, com
              prévia (print enviado aqui, sem geração automática de
              screenshot), slogan editável e contador de cliques. Singleton
              — 1 parceiro por vez. */}
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <Handshake className="size-4 text-muted-foreground" aria-hidden="true" /> Parceria na home
                </h2>
                <p className="text-sm text-muted-foreground">Link "Patrocinado" discreto, abre em nova aba e conta cada clique.</p>
              </div>

              <div className="divide-y rounded-2xl border">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{parceriaAtivoInput ? "Visível na home" : "Oculto na home"}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MousePointerClick className="size-3.5" aria-hidden="true" />
                      <span className="tabular-nums">{parceria?.cliques ?? 0}</span> clique(s) registrado(s)
                    </p>
                  </div>
                  <Switch checked={parceriaAtivoInput} onCheckedChange={setParceriaAtivoInput} aria-label="Parceria visível na home" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Link do parceiro</label>
                  <Input
                    value={parceriaUrlInput}
                    onChange={(e) => setParceriaUrlInput(e.target.value)}
                    placeholder="https://www.exemplo.com.br"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Slogan <span className="font-normal text-muted-foreground">(opcional)</span></label>
                  <Textarea
                    value={parceriaSloganInput}
                    onChange={(e) => setParceriaSloganInput(e.target.value)}
                    placeholder={"Seu próximo desconto pode estar a um clique\nNão pague mais caro, antes de comprar, dá uma Picz"}
                    className="min-h-[72px] text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {parceria?.preview_imagem_path ? (
                  <img
                    src={supabase.storage.from("site_assets").getPublicUrl(parceria.preview_imagem_path).data.publicUrl}
                    alt="Prévia atual do site parceiro"
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-28 rounded-xl border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
                    Sem prévia
                  </div>
                )}
                <input
                  ref={parceriaImagemInput}
                  className="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => subirParceriaImagem(e.target.files)}
                />
                <Button variant="outline" size="sm" onClick={() => parceriaImagemInput.current?.click()}>
                  {parceria?.preview_imagem_path ? "Trocar print" : "Enviar print"}
                </Button>
                <Button className="ml-auto" onClick={() => salvarParceria.mutate()} disabled={salvarParceria.isPending}>
                  {salvarParceria.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Economia conquistada na home</CardTitle>
              <p className="text-sm text-muted-foreground">Só aparece na home pública depois que um valor for salvo.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Valor automático: soma de todas as despesas fixas (recorrentes) marcadas como
                "Economia Conquistada" por qualquer usuário do site. É só uma referência.{" "}
                {economiaAutomatica ? (
                  <>
                    Hoje soma{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatBRL(economiaAutomatica.total)}
                    </span>{" "}
                    ({economiaAutomatica.quantidade}{" "}
                    {economiaAutomatica.quantidade === 1 ? "despesa" : "despesas"}).
                  </>
                ) : (
                  "Calculando…"
                )}
              </p>
              <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="economia-exibida">
                    Valor a exibir publicamente (R$)
                  </label>
                  <Input
                    id="economia-exibida"
                    className="w-48 tabular-nums"
                    inputMode="decimal"
                    placeholder="Ex.: 15000"
                    value={economiaExibidaInput}
                    onChange={(e) => setEconomiaExibidaInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                  />
              </div>
              <div className="flex flex-wrap justify-end gap-3">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 6: AVISOS ─── */}
        <TabsContent value="links" className="space-y-6">
          <LinksAdminHabilitar />
        </TabsContent>

        <TabsContent value="avisos" className="space-y-6">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">
                {comunicadoEditandoId ? "Editar aviso" : "Novo aviso"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {comunicadoEditandoId
                  ? "Salvar mostra o aviso de novo a todos, inclusive a quem marcou \"não exibir mais\"."
                  : "Janela que a pessoa fecha ao entrar no site. Fica ativa até você encerrar."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="aviso-titulo" className="text-sm font-medium">Título</label>
                <Input id="aviso-titulo" placeholder="Ex.: Novidade no app" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="aviso-mensagem" className="text-sm font-medium">Mensagem</label>
                <Textarea
                  id="aviso-mensagem"
                  placeholder="Mensagem para todos os usuários"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={6}
                />
              </div>
              <div className="flex justify-end gap-3">
                {comunicadoEditandoId && (
                  <Button
                    variant="ghost"
                    onClick={() => { setComunicadoEditandoId(null); setTitulo(""); setMsg(""); }}
                  >
                    Cancelar edição
                  </Button>
                )}
                <Button disabled={!titulo || !msg || comunicadoMut.isPending} onClick={() => comunicadoMut.mutate()}>
                  {comunicadoEditandoId ? "Salvar alterações" : "Publicar para todos"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Avisos ativos</CardTitle>
              <p className="text-sm text-muted-foreground">Aparecem para quem entra no site agora.</p>
            </CardHeader>
            <CardContent>
              {comunicados.filter((c: any) => c.ativo).length === 0 ? (
                <p className="rounded-2xl border px-4 py-6 text-center text-sm text-muted-foreground">Nenhum aviso ativo.</p>
              ) : (
                <div className="divide-y rounded-2xl border">
                {comunicados.filter((c: any) => c.ativo).map((c: any) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.titulo}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {new Date(c.criado_em).toLocaleString("pt-BR")} · {c.confirmacoes ?? 0} confirmação(ões)
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setComunicadoEditandoId(c.id); setTitulo(c.titulo); setMsg(c.mensagem); }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={reenviarAviso.isPending}
                        onClick={() => reenviarAviso.mutate(c.id)}
                      >
                        Reenviar para todos
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => limparAviso.mutate(c.id)}>
                        Encerrar
                      </Button>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
          </Card>
          {comunicados.filter((c: any) => !c.ativo).length > 0 && (
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base font-bold">Histórico de avisos</CardTitle>
                <p className="text-sm text-muted-foreground">Avisos já encerrados.</p>
              </CardHeader>
              <CardContent>
                <LogPainel
                  itens={comunicados.filter((c: any) => !c.ativo) as any[]}
                  getData={(c: any) => c.criado_em}
                  getChave={(c: any) => c.id}
                  nomeArquivo="historico-de-avisos"
                  colunas={[
                    { titulo: "Título", valor: (c: any) => c.titulo },
                    { titulo: "Criado em", valor: (c: any) => new Date(c.criado_em).toLocaleString("pt-BR") },
                  ]}
                  renderItem={(c: any) => (
                    <div className="flex items-center justify-between gap-4 border-b px-1 py-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{c.titulo}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Encerrado</span>
                        <span className="tabular-nums">{new Date(c.criado_em).toLocaleString("pt-BR")}</span>
                      </span>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          )}
          {tourConfig && (
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base font-bold">Tour guiado</CardTitle>
                <p className="text-sm text-muted-foreground">Mostra a quem é novo onde lançar receita e despesa.</p>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-2xl border">
                <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Mostrar depois das boas-vindas</span>
                    <span className="block text-xs text-muted-foreground">
                      <span className="tabular-nums">{tourConfig.concluidos}</span> pessoa(s) já concluíram ou dispensaram.
                    </span>
                  </span>
                  <Switch
                    checked={tourConfig.ativo}
                    onCheckedChange={(v) => alternarTour.mutate(v)}
                  />
                </label>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Mostrar de novo para todos</p>
                    <p className="text-xs text-muted-foreground">Inclusive para quem já concluiu.</p>
                  </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={reenviarTour.isPending}
                  onClick={() => reenviarTour.mutate()}
                >
                  Mostrar de novo
                </Button>
                </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── ABA 7: PRIVACIDADE LGPD ─── */}
        <TabsContent value="privacidade" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">Solicitações de privacidade (LGPD)</CardTitle>
                  <p className="text-sm text-muted-foreground">Pedidos dos titulares sobre os próprios dados.</p>
                </div>
                {privPendentes > 0 && <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-destructive">{privPendentes} pendente(s)</span>}
              </div>
            </CardHeader>
            <CardContent>
              {pedidos.length === 0 ? (
                <p className="rounded-2xl border px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma solicitação de privacidade.</p>
              ) : (
                <div className="divide-y rounded-2xl border">
                {pedidos.map((p: any) => (
                  <div className="space-y-2 px-4 py-3 transition-colors hover:bg-muted/40" key={p.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.email}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{p.telefone} · Protocolo {p.protocolo?.substring(0, 8)}…</p>
                        <p className="text-xs text-muted-foreground">{p.motivo || "Sem detalhes"} · <span className="tabular-nums">{new Date(p.criado_em).toLocaleDateString("pt-BR")}</span></p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PRIVACIDADE[p.status]?.color ?? ""}`}>
                        {STATUS_PRIVACIDADE[p.status]?.label ?? p.status}
                      </span>
                    </div>
                    {p.resposta_admin && <p className="text-xs italic text-muted-foreground">Última resposta: {p.resposta_admin}</p>}
                    {Array.isArray(p.tratativa_historico) && p.tratativa_historico.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Ver histórico ({p.tratativa_historico.length})</summary>
                        <div className="mt-2 space-y-1 border-l pl-3">
                          {p.tratativa_historico.map((h: any, i: number) => (
                            <p key={i} className="text-muted-foreground">{new Date(h.data).toLocaleString("pt-BR")} · {STATUS_PRIVACIDADE[h.status]?.label ?? h.status}: {h.mensagem}</p>
                          ))}
                        </div>
                      </details>
                    )}
                    <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDialogPriv({ id: p.id, status: p.status, email: p.email }); setStatusPriv(p.status); setRespostaPriv(""); }}
                    >
                      Tratar solicitação
                    </Button>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 8: CENTRAL DE SOLICITAÇÕES ─── */}
        <TabsContent value="central" className="space-y-6">
          {/* Faturas para modelagem */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">Faturas para modelagem</CardTitle>
                  <p className="text-sm text-muted-foreground">Arquivos que a importação ainda não reconhece.</p>
                </div>
                {layoutsPendentes > 0 && <span className="shrink-0 rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-medium tabular-nums text-warning-foreground">{layoutsPendentes} pendente(s)</span>}
              </div>
            </CardHeader>
            <CardContent>
              {layouts.length === 0 ? (
                <p className="rounded-2xl border px-4 py-6 text-center text-sm text-muted-foreground">Nenhum arquivo aguardando análise.</p>
              ) : (
                <div className="divide-y rounded-2xl border">
                {layouts.map((l: any) => (
                  <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40" key={l.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{l.arquivo_nome}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_LAYOUT[l.status]?.color ?? ""}`}>
                          {STATUS_LAYOUT[l.status]?.label ?? l.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {l.profiles?.nome || l.profiles?.email || "Usuário"} · {l.banco_informado || "Banco não inf."} {l.cartao_final ? `(Final ${l.cartao_final})` : ""} · {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                      </p>
                      {l.resposta_admin && <p className="mt-1 text-xs italic text-muted-foreground">{l.resposta_admin}</p>}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {l.status !== "corrigida" && l.status !== "descartada" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void abrirLayout(l.id)}>Baixar / Abrir</Button>
                          {l.status !== "em_modelagem" && (
                            <Button size="sm" variant="secondary" onClick={() => atualizarLayout.mutate({ id: l.id, status: "em_modelagem" })}>Em análise</Button>
                          )}
                          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => atualizarLayout.mutate({ id: l.id, status: "corrigida" })}>Concluir e apagar PDF</Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => atualizarLayout.mutate({ id: l.id, status: "descartada" })}>Descartar</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chamados de suporte */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">Chamados de suporte</CardTitle>
                  <p className="text-sm text-muted-foreground">Mensagens enviadas pela Central de ajuda.</p>
                </div>
                {chamadosPendentes > 0 && <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary">{chamadosPendentes} aberto(s)</span>}
              </div>
            </CardHeader>
            <CardContent>
              {chamados.length === 0 ? (
                <p className="rounded-2xl border px-4 py-6 text-center text-sm text-muted-foreground">Nenhum chamado de suporte.</p>
              ) : (
                <div className="divide-y rounded-2xl border">
                {chamados.map((c: any) => (
                  <div className="space-y-2 px-4 py-3 transition-colors hover:bg-muted/40" key={c.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.assunto}</p>
                        <p className="text-xs text-muted-foreground">{c.nome || c.email} · Protocolo <span className="tabular-nums">{c.protocolo?.substring(0, 8)}…</span> · <span className="tabular-nums">{new Date(c.criado_em).toLocaleDateString("pt-BR")}</span></p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.descricao}</p>
                        {c.anexo_path && (
                          <button
                            type="button"
                            className="mt-0.5 flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                            onClick={() => abrirAnexoChamado(c.id, c.anexo_path)}
                          >
                            <Paperclip className="size-3" /> {c.anexo_nome || "Anexo enviado"}
                          </button>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHAMADO[c.status]?.color ?? ""}`}>
                        {STATUS_CHAMADO[c.status]?.label ?? c.status}
                      </span>
                    </div>
                    {c.resposta_admin && <p className="text-xs italic text-muted-foreground">Resposta: {c.resposta_admin}</p>}
                    {c.user_id && /exclus|encerr/i.test(c.assunto ?? "") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={enviandoExportacao === c.id}
                        onClick={async () => {
                          const destino = window.prompt("E-mail que vai receber o arquivo de dados (JSON):", c.email ?? "");
                          if (!destino) return;
                          setEnviandoExportacao(c.id);
                          try {
                            await enviarExportacaoFn({ data: { chamadoId: c.id, email: destino.trim() } });
                            toast.success("Arquivo de dados enviado para o e-mail informado.");
                          } catch (e: any) {
                            toast.error(e.message ?? "Não foi possível enviar o arquivo.");
                          } finally {
                            setEnviandoExportacao(null);
                          }
                        }}
                      >
                        Gerar dados e enviar por e-mail
                      </Button>
                    )}
                    {c.user_id && c.contaBloqueada && (

                      <Button
                        size="sm"
                        variant="default"
                        disabled={reativandoConta === c.user_id}
                        onClick={async () => {
                          if (!window.confirm("Confirme a identidade da pessoa antes de reativar. Reativar a conta agora?")) return;
                          setReativandoConta(c.user_id);
                          try {
                            await reativarFn({ data: { userId: c.user_id, ativo: true } });
                            toast.success("Conta reativada. A pessoa já pode entrar.");
                            qc.invalidateQueries({ queryKey: ["admin-chamados"] });
                          } catch (e: any) {
                            toast.error(e.message ?? "Não foi possível reativar a conta.");
                          } finally {
                            setReativandoConta(null);
                          }
                        }}
                      >
                        Reativar conta
                      </Button>
                    )}
                    {c.status === "cancelado" ? (
                      // Item 9 (parte 2): chamado cancelado (pelo usuário ou pelo
                      // admin) nunca é excluído — fica visível aqui pra
                      // histórico/auditoria — mas não aceita mais respostas.
                      <p className="text-xs text-muted-foreground">
                        Chamado cancelado. Não aceita mais respostas.
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setDialogChamado({ id: c.id, status: c.status }); setStatusChamado(c.status); setRespostaChamado(""); }}
                      >
                        Responder ou atualizar
                      </Button>
                    )}
                  </div>
                ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA 9: LOGS DE AUDITORIA ─── */}
        <TabsContent value="logs" className="space-y-6">
          {/* 31/10/2026: as falhas de login (e-mail ou senha errados) ficam aqui, na auditoria (pedido do Matheus). */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-bold">Tentativas de login com erro</CardTitle>
              <p className="text-sm text-muted-foreground">Site e app. Bloqueio de 15 min após 3 falhas seguidas.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Registra o que foi digitado (nunca a senha), o motivo, o IP e a localização aproximada.
              </p>
              <LogPainel
                itens={falhasLogin as any[]}
                getData={(f: any) => f.criado_em}
                getChave={(f: any) => f.id}
                nomeArquivo="falhas-de-login"
                vazio="Nenhuma tentativa de login com erro registrada."
                colunas={[
                  { titulo: "Data/hora", valor: (f: any) => new Date(f.criado_em).toLocaleString("pt-BR") },
                  { titulo: "Identificador digitado", valor: (f: any) => f.identificador },
                  { titulo: "Tipo", valor: (f: any) => f.tipo_identificador },
                  { titulo: "Motivo", valor: (f: any) => MOTIVOS_FALHA_LOGIN[f.motivo] ?? f.motivo },
                  { titulo: "IP", valor: (f: any) => f.ip },
                  { titulo: "Cidade", valor: (f: any) => f.cidade },
                  { titulo: "Região", valor: (f: any) => f.regiao },
                  { titulo: "País", valor: (f: any) => f.pais },
                  { titulo: "Tentativas seguidas", valor: (f: any) => f.tentativas },
                  { titulo: "Bloqueou a conta", valor: (f: any) => (f.bloqueou ? "Sim" : "Não") },
                  { titulo: "Origem", valor: (f: any) => origemLogin(f.user_agent) },
                  { titulo: "Navegador", valor: (f: any) => f.user_agent },
                ]}
                renderItem={(f: any) => (
                  <div className="rounded-xl border px-4 py-3 text-xs transition-colors hover:bg-muted/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        {MOTIVOS_FALHA_LOGIN[f.motivo] ?? f.motivo}
                      </span>
                      <span className="font-mono">{f.identificador}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{origemLogin(f.user_agent)}</span>
                      {f.bloqueou && (
                        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                          Conta bloqueada
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 tabular-nums text-muted-foreground">
                      {new Date(f.criado_em).toLocaleString("pt-BR")} · IP {f.ip ?? "n/d"}
                      {f.cidade ? ` · ${f.cidade}${f.regiao ? `/${f.regiao}` : ""}${f.pais ? ` (${f.pais})` : ""}` : ""}
                    </p>
                  </div>
                )}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">Log administrativo</CardTitle>
                  <p className="text-sm text-muted-foreground">Ações registradas no site, mais recentes primeiro.</p>
                </div>
                <Input
                  className="h-9 w-full text-sm sm:w-56"
                  aria-label="Filtrar log"
                  placeholder="Filtrar por ação ou usuário"
                  value={filtroLog}
                  onChange={(e) => setFiltroLog(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <LogPainel
                itens={logsVisiveis as any[]}
                getData={(l: any) => l.criado_em}
                getChave={(l: any) => l.id}
                nomeArquivo="log-administrativo"
                vazio="Nenhum evento registrado."
                colunas={[
                  { titulo: "Data/hora", valor: (l: any) => new Date(l.criado_em).toLocaleString("pt-BR") },
                  { titulo: "Ação", valor: (l: any) => String(l.acao).replaceAll("_", " ") },
                  { titulo: "Usuário", valor: (l: any) => l.profiles?.nome ?? l.profiles?.email ?? "Sistema" },
                  { titulo: "IP", valor: (l: any) => l.detalhes?.ip },
                  { titulo: "Cidade", valor: (l: any) => l.detalhes?.cidade },
                  { titulo: "Detalhes", valor: (l: any) => (l.detalhes ? JSON.stringify(l.detalhes) : "") },
                ]}
                renderItem={(l: any) => (
                  <details className="group rounded-xl border px-4 py-3 text-xs transition-colors hover:bg-muted/40">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold first-letter:uppercase">{l.acao.replaceAll("_", " ")}</span>
                        <span className="ml-2 tabular-nums text-muted-foreground">
                          {l.profiles?.nome ?? l.profiles?.email ?? "Sistema"} · {new Date(l.criado_em).toLocaleString("pt-BR")}
                        </span>
                        {l.detalhes?.ip && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 font-mono text-xs">
                            {l.detalhes.ip}{l.detalhes.cidade ? ` · ${l.detalhes.cidade}` : ""}
                          </span>
                        )}
                        {l.acao?.includes("falha") || l.acao?.includes("bloqueado") || l.acao?.includes("login_falhou") ? (
                          <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Falha</span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground group-open:hidden">Detalhes</span>
                    </summary>
                    {l.detalhes && Object.keys(l.detalhes).length > 0 && (
                      <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-xs">
                        {JSON.stringify(l.detalhes, null, 2)}
                      </div>
                    )}
                  </details>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Dialog: Tratar privacidade ─── */}
      <Dialog open={!!dialogPriv} onOpenChange={(o) => { if (!o) { setDialogPriv(null); setRespostaPriv(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tratar solicitação de privacidade</DialogTitle>
            <DialogDescription>{dialogPriv?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
            <label className="text-sm font-medium">Situação</label>
            <Select value={statusPriv} onValueChange={setStatusPriv}>
              <SelectTrigger aria-label="Situação da solicitação"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_PRIVACIDADE).map(([v, s]) => (
                  <SelectItem key={v} value={v}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div className="space-y-1.5">
            <label htmlFor="resposta-priv" className="text-sm font-medium">Resposta <span className="font-normal text-muted-foreground">(opcional, vai por e-mail)</span></label>
            <Textarea
              id="resposta-priv"
              placeholder="Tratativa ou resposta ao titular"
              value={respostaPriv}
              onChange={(e) => setRespostaPriv(e.target.value)}
              rows={4}
            />
            </div>
          </div>
          <DialogFooter className="gap-3">
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
      <Dialog
        open={!!dialogChamado}
        onOpenChange={(o) => {
          if (!o) {
            setDialogChamado(null);
            setRespostaChamado("");
            setArquivoChamado(null);
            if (arquivoChamadoRef.current) arquivoChamadoRef.current.value = "";
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar chamado de suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(mensagensChamadoAdmin as any[]).length > 0 && (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border bg-muted/30 p-3">
                {(mensagensChamadoAdmin as any[]).map((m) => (
                  <div key={m.id} className="rounded-xl border bg-background px-3 py-2 text-xs">
                    <p className="font-semibold">
                      {m.autor_tipo === "admin" ? "Você (admin)" : "Usuário"} ·{" "}
                      <span className="font-normal tabular-nums text-muted-foreground">
                        {new Date(m.criado_em).toLocaleString("pt-BR")}
                      </span>
                    </p>
                    {m.mensagem && <p className="mt-0.5">{m.mensagem}</p>}
                    {m.anexo_path && dialogChamado && (
                      <button
                        type="button"
                        className="mt-1 flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                        onClick={() => abrirAnexoChamado(dialogChamado.id, m.anexo_path)}
                      >
                        <Paperclip className="size-3" /> {m.anexo_nome || "Anexo"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
            <label className="text-sm font-medium">Situação</label>
            <Select value={statusChamado} onValueChange={setStatusChamado}>
              <SelectTrigger aria-label="Situação do chamado"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CHAMADO).map(([v, s]) => (
                  <SelectItem key={v} value={v}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div className="space-y-1.5">
            <label htmlFor="resposta-chamado" className="text-sm font-medium">Resposta <span className="font-normal text-muted-foreground">(opcional, vai por e-mail)</span></label>
            <Textarea
              id="resposta-chamado"
              placeholder="Resposta ao usuário"
              value={respostaChamado}
              onChange={(e) => setRespostaChamado(e.target.value)}
              rows={4}
            />
            </div>
            <input
              ref={arquivoChamadoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (!file) return;
                const tiposPermitidos = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
                if (!tiposPermitidos.includes(file.type)) {
                  toast.error("Tipo de arquivo não permitido. Envie apenas imagem (JPG, PNG, WEBP) ou PDF.");
                  e.target.value = "";
                  return;
                }
                if (file.size > 20 * 1024 * 1024) {
                  toast.error("Arquivo muito grande. O limite é 20MB.");
                  e.target.value = "";
                  return;
                }
                setArquivoChamado(file);
              }}
            />
            {arquivoChamado ? (
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{arquivoChamado.name}</span>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label="Remover anexo"
                  onClick={() => {
                    setArquivoChamado(null);
                    if (arquivoChamadoRef.current) arquivoChamadoRef.current.value = "";
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => arquivoChamadoRef.current?.click()}
              >
                <Paperclip className="mr-1 size-3.5" /> Anexar imagem ou PDF (opcional)
              </Button>
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setDialogChamado(null);
                setRespostaChamado("");
                setArquivoChamado(null);
                if (arquivoChamadoRef.current) arquivoChamadoRef.current.value = "";
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={atualizarChamado.isPending}
              onClick={() => {
                if (!dialogChamado) return;
                atualizarChamado.mutate({ id: dialogChamado.id, status: statusChamado as any, resposta: respostaChamado || undefined });
              }}
            >
              {atualizarChamado.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
