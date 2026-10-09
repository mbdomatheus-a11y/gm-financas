import { createFileRoute } from "@tanstack/react-router";
import { LogPainel } from "@/components/LogPainel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinksAdminPainel } from "@/components/LinksAdminPainel";
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
import { PadroesAdmin } from "@/components/PadroesAdmin";
import { TelaInicialPadraoCard } from "@/components/TelaInicialPadraoCard";
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
      { id: "consulta", rotulo: "Consulta" },
      { id: "acessos", rotulo: "Acessos ao site" },
    ],
  },
  {
    id: "pessoas",
    titulo: "2. Pessoas e pedidos",
    descricao: "Acesso, solicitações e privacidade",
    abas: [
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
    id: "infra",
    titulo: "4. Armazenamento",
    descricao: "Arquivos e espaço em disco",
    abas: [{ id: "armazenamento", rotulo: "Armazenamento Oracle" }],
  },
  {
    id: "seguranca",
    titulo: "5. Segurança",
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

  const { data: protecaoAdmin } = useQuery({
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
    onSuccess: () => { toast.success("Aviso encerrado — não aparece mais pra ninguém."); qc.invalidateQueries({ queryKey: ["admin-comunicados"] }); qc.invalidateQueries({ queryKey: ["comunicados-pendentes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reenviarAviso = useMutation({
    mutationFn: (id: string) => reenviarComunicadoFn({ data: { id } }),
    onSuccess: () => { toast.success("Aviso reenviado — vai reaparecer pra todos, inclusive quem já confirmou."); qc.invalidateQueries({ queryKey: ["admin-comunicados"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const alternarTour = useMutation({
    mutationFn: (ativo: boolean) => alternarTourFn({ data: { ativo } }),
    onSuccess: () => { toast.success("Tour guiado atualizado."); qc.invalidateQueries({ queryKey: ["admin-tour-config"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reenviarTour = useMutation({
    mutationFn: () => reenviarTourFn(),
    onSuccess: () => { toast.success("Tour reenviado — vai aparecer novamente pra quem já tinha visto."); qc.invalidateQueries({ queryKey: ["admin-tour-config"] }); },
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
          ? "Aviso atualizado — vai reaparecer pra quem já tinha confirmado."
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
  const tipoProtecao = protecaoAdmin?.tipo ?? "senha";
  const emModoPin = tipoProtecao === "pin" && !preferirSenhaConta;

  if (!consultaDesbloqueada && tipoProtecao !== "nenhuma")
    return (
      <AppLayout title="Administração do site" description="Painel de controle administrativo">
        <Card>
          <CardContent className="p-6 space-y-4 max-w-sm mx-auto">
            <div className="text-center space-y-1">
              <div className="flex justify-center mb-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10">
                  <svg className="size-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
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
                {erroSenhaConsulta && <p className="text-xs text-rose-600 text-center">{erroSenhaConsulta}</p>}
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
                {erroSenhaConsulta && <p className="text-xs text-rose-600 text-center">{erroSenhaConsulta}</p>}
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
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
        {/* Grupos (2026-10-06): as 10 abas foram agrupadas por assunto. Primeiro
            escolhe-se o grupo, depois a aba dentro dele. Os valores das abas e
            seus conteudos nao mudaram (links com ?aba= continuam validos). */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Grupos da administração">
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
                  "relative rounded-xl border p-3 text-left transition-colors",
                  ativo ? "border-primary bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <p className={cn("text-sm font-semibold", ativo && "text-primary")}>{g.titulo}</p>
                <p className="text-xs text-muted-foreground">{g.descricao}</p>
                {pend > 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {pend}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {(GRUPOS_ADMIN.find((g) => g.abas.some((a) => a.id === abaAtiva)) ?? GRUPOS_ADMIN[0]!).abas.map((a) => (
            <TabsTrigger key={a.id} value={a.id} className="relative">
              {a.rotulo}
              {a.id === "central" && totalPendentes > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {totalPendentes}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="acessos" className="space-y-4">
          <AcessosSiteAdmin />
        </TabsContent>

        <TabsContent value="padroes" className="space-y-4">
          <PadroesAdmin />
        </TabsContent>

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
        {/* 2026-09-27: a senha extra agora é pedida uma única vez na ENTRADA
            de toda a rota /administracao (ver o gate antes do `return`
            principal) — essa aba não pede senha de novo, já chega liberada. */}
        <TabsContent value="consulta" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Atividade e espaço por usuário</CardTitle>
                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setConsultaDesbloqueada(false)}>
                  🔒 Bloquear administração
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
        </TabsContent>

        {/* ─── ABA 3: ACESSO E AUTENTICAÇÃO ─── */}
        <TabsContent value="acesso" className="space-y-4">
          {/* Card Proteção de Entrada na Administração (Pedido 7) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Proteção de entrada na Administração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Defina se e como a entrada no painel administrativo deve ser protegida.
              </p>
              <div className="grid gap-4 sm:grid-cols-3 items-end">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">Tipo de bloqueio</p>
                  <Select
                    value={tipoProtecaoInput}
                    onValueChange={(v: any) => {
                      setTipoProtecaoInput(v);
                      if (v !== "pin") {
                        salvarProtecaoMut.mutate({ tipo: v });
                      }
                    }}
                  >
                    <SelectTrigger className="h-10">
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
                  <div className="space-y-1.5 sm:col-span-2">
                    <p className="text-xs font-medium">
                      {protecaoAdmin?.temPin ? "Alterar PIN de 4 dígitos" : "Criar PIN de 4 dígitos"}
                    </p>
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
                    {protecaoAdmin?.temPin && (
                      <p className="text-[11px] text-muted-foreground">
                        PIN atual configurado e ativo. Digite 4 novos números acima caso queira alterar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
          {config && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notas fiscais — Google Drive</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">Mostrar seção de pasta/Google Drive pros usuários comuns</p>
                  <p className="text-xs text-muted-foreground">
                    Desligado por padrão (item 15 do backlog). Enquanto desligado, só você (admin do
                    site) vê essa seção em Notas fiscais — o fluxo de conexão continua funcionando
                    normalmente pra quem já tinha conectado antes.
                  </p>
                </div>
                <Switch
                  checked={config.google_drive_habilitado}
                  onCheckedChange={(v) => alternarGoogleDriveNotas.mutate(v)}
                />
              </CardContent>
            </Card>
          )}
          {config && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Cadastro sem convite</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">Permitir criar conta sem código de convite</p>
                  <p className="text-xs text-muted-foreground">
                    Pensado pra fase de testes/lançamento, pra não burocratizar a entrada de gente
                    fora da família. Enquanto ligado, a tela de "Criar conta" libera o cadastro sem
                    pedir convite (quem tiver um código continua podendo usá-lo). Cada pessoa que
                    entrar assim ganha o próprio grupo novo, isolado — igual quem entra por convite.
                  </p>
                </div>
                <Switch
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
              </CardContent>
            </Card>
          )}
          <IaLancamentoModoSiteCard />
          <TelaInicialPadraoCard />
          <Card>
            <CardHeader><CardTitle className="text-sm">Log de tentativas de login</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Toda tentativa de login com erro é registrada (mesmo a primeira), com o que foi digitado
                (nunca a senha), o motivo, o IP e a localização aproximada. Bloqueios automáticos ocorrem
                após 3 tentativas falhas consecutivas (15 min).
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
                  { titulo: "Navegador", valor: (f: any) => f.user_agent },
                ]}
                renderItem={(f: any) => (
                  <div className="rounded-lg border px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                        {MOTIVOS_FALHA_LOGIN[f.motivo] ?? f.motivo}
                      </span>
                      <span className="font-mono">{f.identificador}</span>
                      {f.bloqueou && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                          Conta bloqueada
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {new Date(f.criado_em).toLocaleString("pt-BR")} · IP {f.ip ?? "n/d"}
                      {f.cidade ? ` · ${f.cidade}${f.regiao ? `/${f.regiao}` : ""}${f.pais ? ` (${f.pais})` : ""}` : ""}
                    </p>
                  </div>
                )}
              />
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

        {/* ─── ABA: ARMAZENAMENTO ORACLE ─── */}
        <TabsContent value="armazenamento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Armazenamento Oracle por grupo familiar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Grupos com o Oracle habilitado usam o Object Storage do Oracle Cloud como destino
                preferencial dos comprovantes de notas fiscais (antes do Google Drive e do
                armazenamento do site). Ao habilitar pela primeira vez, a cota sugerida é 500 MB
                por membro do grupo — depois disso fica fixa até você ajustar manualmente aqui.
              </p>
              {armazenamentoOracle.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
              ) : (
                armazenamentoOracle.map((g) => {
                  const percentual = g.cotaBytes > 0 ? Math.min(100, (g.usadoBytes / g.cotaBytes) * 100) : 0;
                  const cotaMbAtual = Math.round(g.cotaBytes / (1024 * 1024));
                  const inputAtual = cotaOracleInput[g.grupoId] ?? String(cotaMbAtual);
                  return (
                    <div key={g.grupoId} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <b className="text-sm">{g.nome}</b>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {g.membros} membro(s)
                          </span>
                        </div>
                        <Switch
                          checked={g.habilitado}
                          onCheckedChange={(v) => alternarOracle.mutate({ grupoId: g.grupoId, habilitado: v })}
                        />
                      </div>
                      {g.habilitado && (
                        <>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${percentual >= 90 ? "bg-rose-500" : percentual >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {formatarTamanho(g.usadoBytes)} usados de {formatarTamanho(g.cotaBytes)}{" "}
                              ({percentual.toFixed(1)}%)
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={1}
                                className="h-7 w-24 text-xs"
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
                })
              )}
            </CardContent>
          </Card>
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

          {/* Bloco de preços da home (2026-09-28): valor, sufixo, descrição,
              itens (lista de benefícios) e texto do botão — tudo editável
              aqui, sem precisar tocar em código pra mudar o preço exibido. */}
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-primary" />
                <h2 className="font-semibold">Preços na home</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Card exibido na seção "Preços" da home pública. Um item por linha na lista de
                benefícios.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome do plano</label>
                  <Input value={precoNomeInput} onChange={(e) => setPrecoNomeInput(e.target.value)} placeholder="Control ALL" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Texto do botão</label>
                  <Input value={precoBotaoInput} onChange={(e) => setPrecoBotaoInput(e.target.value)} placeholder="Criar conta" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                  <Input
                    inputMode="decimal"
                    value={precoValorInput}
                    onChange={(e) => setPrecoValorInput(e.target.value)}
                    placeholder="4.99"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Sufixo (ex.: /mês)</label>
                  <Input value={precoSufixoInput} onChange={(e) => setPrecoSufixoInput(e.target.value)} placeholder="/mês" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Descrição (abaixo do preço)</label>
                <Input
                  value={precoDescricaoInput}
                  onChange={(e) => setPrecoDescricaoInput(e.target.value)}
                  placeholder="Preço de lançamento previsto."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Itens listados (um por linha)
                </label>
                <Textarea
                  value={precoItensInput}
                  onChange={(e) => setPrecoItensInput(e.target.value)}
                  placeholder={"Módulos pessoais e financeiros\nAlertas e histórico\nCompartilhamento controlado\nPrivacidade por padrão"}
                  className="min-h-[110px] text-sm"
                />
              </div>

              <div className="flex justify-end border-t pt-3">
                <Button size="sm" onClick={() => salvarPreco.mutate()} disabled={salvarPreco.isPending}>
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
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Handshake className="size-4 text-primary" />
                <h2 className="font-semibold">Parceria / patrocínio na home</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Link discreto ("Patrocinado") exibido na home pública, com a prévia enviada abaixo.
                Abre sempre em nova aba e cada clique é contado.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Link do parceiro</label>
                  <Input
                    value={parceriaUrlInput}
                    onChange={(e) => setParceriaUrlInput(e.target.value)}
                    placeholder="https://www.exemplo.com.br"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Slogan (opcional)</label>
                  <Textarea
                    value={parceriaSloganInput}
                    onChange={(e) => setParceriaSloganInput(e.target.value)}
                    placeholder={"Seu próximo desconto pode estar a um clique\nNão pague mais caro, antes de comprar, dá uma Picz"}
                    className="min-h-[72px] text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={parceriaAtivoInput} onCheckedChange={setParceriaAtivoInput} />
                  <span className="text-sm">{parceriaAtivoInput ? "Visível na home" : "Oculto na home"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MousePointerClick className="size-3.5" />
                  {parceria?.cliques ?? 0} clique(s) registrado(s)
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                {parceria?.preview_imagem_path ? (
                  <img
                    src={supabase.storage.from("site_assets").getPublicUrl(parceria.preview_imagem_path).data.publicUrl}
                    alt="Prévia atual do site parceiro"
                    className="h-16 w-28 rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
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
                <Button size="sm" onClick={() => salvarParceria.mutate()} disabled={salvarParceria.isPending}>
                  {salvarParceria.isPending ? "Salvando..." : "Salvar"}
                </Button>
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
        <TabsContent value="links" className="space-y-4">
          <LinksAdminPainel />
        </TabsContent>

        <TabsContent value="avisos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {comunicadoEditandoId ? "Editar aviso" : "Novo aviso (modal ao logar)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <Textarea
                placeholder="Mensagem para todos os usuários"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={6}
              />
              <div className="flex gap-2">
                <Button disabled={!titulo || !msg || comunicadoMut.isPending} onClick={() => comunicadoMut.mutate()}>
                  {comunicadoEditandoId ? "Salvar alterações" : "Publicar para todos"}
                </Button>
                {comunicadoEditandoId && (
                  <Button
                    variant="ghost"
                    onClick={() => { setComunicadoEditandoId(null); setTitulo(""); setMsg(""); }}
                  >
                    Cancelar edição
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {comunicadoEditandoId
                  ? "Salvar reexibe o aviso pra todo mundo, inclusive quem já tinha marcado \"não exibir mais\"."
                  : "Aparece como um aviso que a pessoa precisa fechar ao entrar no site. Fica ativo até você encerrar."}
              </p>
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
                      <p className="text-muted-foreground">
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
                        Reenviar p/ todos
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => limparAviso.mutate(c.id)}>
                        Encerrar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {comunicados.filter((c: any) => !c.ativo).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Histórico de avisos</CardTitle></CardHeader>
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
                    <div className="border-b py-2 text-xs text-muted-foreground">
                      <b className="text-foreground">{c.titulo}</b> · encerrado · {new Date(c.criado_em).toLocaleString("pt-BR")}
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          )}
          {tourConfig && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Tour guiado (novos usuários)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p>Mostrar o tour depois do aviso de boas-vindas</p>
                    <p className="text-xs text-muted-foreground">
                      Destaca onde lançar receita e despesa pra quem é novo. {tourConfig.concluidos}{" "}
                      pessoa(s) já concluíram ou dispensaram.
                    </p>
                  </div>
                  <Switch
                    checked={tourConfig.ativo}
                    onCheckedChange={(v) => alternarTour.mutate(v)}
                  />
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reenviarTour.isPending}
                  onClick={() => reenviarTour.mutate()}
                >
                  Mostrar tour novamente para todos
                </Button>
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
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CHAMADO[c.status]?.color ?? ""}`}>
                        {STATUS_CHAMADO[c.status]?.label ?? c.status}
                      </span>
                    </div>
                    {c.resposta_admin && <p className="text-xs italic text-muted-foreground">Resposta: {c.resposta_admin}</p>}
                    {c.status === "cancelado" ? (
                      // Item 9 (parte 2): chamado cancelado (pelo usuário ou pelo
                      // admin) nunca é excluído — fica visível aqui pra
                      // histórico/auditoria — mas não aceita mais respostas.
                      <p className="text-xs text-muted-foreground">
                        Chamado cancelado — não aceita mais respostas.
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setDialogChamado({ id: c.id, status: c.status }); setStatusChamado(c.status); setRespostaChamado(""); }}
                      >
                        Responder / Atualizar
                      </Button>
                    )}
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
                  <details className="group rounded-lg border px-3 py-2 text-xs">
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
            <DialogTitle>Atualizar Chamado de Suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(mensagensChamadoAdmin as any[]).length > 0 && (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-2">
                {(mensagensChamadoAdmin as any[]).map((m) => (
                  <div key={m.id} className="rounded-lg border bg-background p-2 text-xs">
                    <p className="font-semibold">
                      {m.autor_tipo === "admin" ? "Você (admin)" : "Usuário"} ·{" "}
                      <span className="font-normal text-muted-foreground">
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
              <div className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{arquivoChamado.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-rose-600"
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
          <DialogFooter>
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
