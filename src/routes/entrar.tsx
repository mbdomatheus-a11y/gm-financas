import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  UserPlus,
  LogIn as LogInIcon,
  Loader2,
  Check,
  CreditCard,
  ClipboardList,
  PiggyBank,
  TrendingUp,
  Eye,
  EyeOff,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { isValidCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { aceitarConvite } from "@/lib/convites.functions";
import { solicitarCodigoRecuperacao } from "@/lib/conta-exclusao.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandMark } from "@/components/BrandMark";
import { SiteHeader } from "@/components/SiteHeader";
import { LegalDialogs } from "@/components/LegalDialogs";
import { EntrarForm } from "@/components/EntrarForm";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { rotaDaTelaInicial } from "@/lib/tela-inicial-padrao";
import { criarContaSemConvite } from "@/lib/convites-livres.functions";
import { garantirPerfilUsuarioOAuth } from "@/lib/seguranca-conta.functions";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): { convite?: string; next?: string; criar?: boolean } => ({
    ...(typeof s["convite"] === "string" && s["convite"] ? { convite: s["convite"] } : {}),
    ...(typeof s["next"] === "string" && s["next"].startsWith("/") && !s["next"].startsWith("//")
      ? { next: s["next"] }
      : {}),
    ...(s["criar"] === true || s["criar"] === "true" ? { criar: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Control ALL" },
      {
        name: "description",
        content:
          "Acesse o painel de finanças pessoais: receitas, despesas, parcelas, cartões e investimentos em um só lugar.",
      },
      { property: "og:title", content: "Entrar — Control ALL" },
      {
        property: "og:description",
        content: "Controle compartilhado de receitas, despesas, parcelamentos e investimentos.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const garantirPerfilOAuth = useServerFn(garantirPerfilUsuarioOAuth);
  const obterConfigInicial = useServerFn(obterConfiguracaoAcesso);
  const { data: configInicial } = useQuery({
    queryKey: ["configuracao-acesso-publica-entrar"],
    queryFn: () => obterConfigInicial(),
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try {
          await garantirPerfilOAuth();
        } catch {
          // Continua caso o perfil já esteja inicializado
        }
        const returnUrl = sessionStorage.getItem("control-all-return-url");
        const target =
          search.next ||
          (returnUrl && returnUrl.startsWith("/")
            ? returnUrl
            : rotaDaTelaInicial(configInicial?.tela_inicial_padrao));
        window.location.assign(target);
      }
    });
  }, [search.next, configInicial?.tela_inicial_padrao, garantirPerfilOAuth]);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-6 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Voltar pra página inicial
          </Link>

          <div className="mb-8 flex flex-col items-center text-center">
            <BrandMark className="mb-4 size-14 rounded-2xl shadow-soft" />
            <h1 className="text-2xl font-bold tracking-tight">Control ALL</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre ou crie sua conta para acessar o painel
            </p>
          </div>

          <Tabs defaultValue={search.criar || search.convite ? "criar" : "entrar"} className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="entrar" className="gap-1.5">
                <LogInIcon className="size-3.5" /> Entrar
              </TabsTrigger>
              <TabsTrigger value="criar" className="gap-1.5">
                <UserPlus className="size-3.5" /> Criar conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <EntrarForm {...(search.next ? { next: search.next } : {})} />
            </TabsContent>
            <TabsContent value="criar">
              <CriarContaForm token={search.convite} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

const emptyCadastro = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  dataNascimento: "",
  senha: "",
  confirmarSenha: "",
};

function CriarContaForm({ token }: { token: string | undefined }) {
  const navigate = useNavigate();
  const aceitar = useServerFn(aceitarConvite);
  const criarSemConvite = useServerFn(criarContaSemConvite);
  const solicitarCodigo = useServerFn(solicitarCodigoRecuperacao);
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const { data: config } = useQuery({
    queryKey: ["configuracao-acesso-publica-criar-conta"],
    queryFn: () => obterConfig(),
    staleTime: 60_000,
  });
  const cadastroLivre = config?.cadastro_livre_habilitado ?? false;

  const [form, setForm] = useState(emptyCadastro);
  const [tokenInput, setTokenInput] = useState(token ?? "");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aceitouDocumentos, setAceitouDocumentos] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cadastroLivre && !tokenInput.trim()) {
      toast.error("Informe o código de convite");
      return;
    }
    const cpfLimpo = onlyDigits(form.cpf);
    if (cpfLimpo.length > 0 && !isValidCpf(cpfLimpo)) {
      toast.error("CPF informado é inválido");
      return;
    }
    if (form.nome.trim().length < 2) {
      toast.error("Informe o nome completo");
      return;
    }
    if (!form.email.includes("@")) {
      toast.error("E-mail inválido");
      return;
    }
    if (form.senha.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres");
      return;
    }
    if (form.senha !== form.confirmarSenha) {
      toast.error("As senhas não conferem");
      return;
    }
    if (TURNSTILE_ATIVO && !turnstileToken) {
      toast.error("Confirme a verificação de segurança");
      return;
    }
    if (!aceitouDocumentos) {
      toast.error(
        "Você precisa aceitar os Termos de Uso e o Aviso de Privacidade para criar a conta.",
      );
      return;
    }

    setLoading(true);
    try {
      const usaCadastroLivre = cadastroLivre && !tokenInput.trim();
      let res: { ok: boolean; email: string };
      if (usaCadastroLivre) {
        res = await criarSemConvite({
          data: {
            nome: form.nome.trim(),
            cpf: cpfLimpo || undefined,
            email: form.email.trim(),
            telefone: form.telefone.trim() || undefined,
            dataNascimento: form.dataNascimento || undefined,
            senha: form.senha,
            turnstileToken: turnstileToken ?? undefined,
            aceitouDocumentos: true as const,
          },
        });
      } else {
        const dadosCadastro = {
          token: tokenInput.trim(),
          nome: form.nome.trim(),
          cpf: cpfLimpo || undefined,
          email: form.email.trim(),
          telefone: form.telefone.trim() || undefined,
          dataNascimento: form.dataNascimento || undefined,
          senha: form.senha,
          turnstileToken: turnstileToken ?? undefined,
          aceitouDocumentos: true as const,
        };
        try {
          res = await aceitar({ data: dadosCadastro });
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes("RECUPERACAO_DISPONIVEL")) {
            const recuperar = window.confirm(
              "Encontramos uma conta excluída há menos de 90 dias. Deseja recuperar os dados anteriores? Você precisará confirmar o e-mail usado antes da exclusão. Clique em Cancelar para criar uma conta nova.",
            );
            if (recuperar) {
              await solicitarCodigo({ data: { cpf: cpfLimpo, email: dadosCadastro.email } });
              const codigoRecuperacao = window
                .prompt(
                  "Enviamos um código ao e-mail anterior, se ele corresponder à conta. Cole o código recebido. Ele vale por 15 minutos.",
                )
                ?.trim();
              if (!codigoRecuperacao) return;
              res = await aceitar({
                data: { ...dadosCadastro, recuperarDados: true, codigoRecuperacao },
              });
            } else {
              res = await aceitar({ data: { ...dadosCadastro, recuperarDados: false } });
            }
          } else {
            throw err;
          }
        }
      }

      toast.success("Conta criada! Entrando…");
      const { error } = await supabase.auth.signInWithPassword({
        email: res.email,
        password: form.senha,
      });
      if (error) {
        toast.info("Conta criada — faça login na aba Entrar.");
        return;
      }
      navigate({ to: "/inicio" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingWizard
      form={form}
      setForm={setForm}
      tokenInput={tokenInput}
      setTokenInput={setTokenInput}
      turnstileToken={turnstileToken}
      setTurnstileToken={setTurnstileToken}
      loading={loading}
      aceitouDocumentos={aceitouDocumentos}
      setAceitouDocumentos={setAceitouDocumentos}
      cadastroLivre={cadastroLivre}
      onSubmit={handleSubmit}
    />
  );
}

// ─── Tipos do wizard ──────────────────────────────────────────────────────────

type FormState = typeof emptyCadastro;

type StepId = "boas-vindas" | "convite" | "objetivo" | "dados" | "senha" | "termos";

const OBJETIVOS = [
  {
    id: "dividas",
    titulo: "Sair das dívidas",
    subtitulo: "Preciso de ajuda para economizar",
    icone: CreditCard,
    cor: "text-amber-500 bg-amber-500/10",
  },
  {
    id: "controle",
    titulo: "Assumir o controle",
    subtitulo: "Não tenho visibilidade dos meus gastos",
    icone: ClipboardList,
    cor: "text-blue-500 bg-blue-500/10",
  },
  {
    id: "economizar",
    titulo: "Quero dicas para economizar",
    subtitulo: "Encontrar coisas mais em conta no dia a dia",
    icone: PiggyBank,
    cor: "text-emerald-500 bg-emerald-500/10",
  },
  {
    id: "investir",
    titulo: "Começar a investir",
    subtitulo: "Estou me organizando e quero ajuda para investir",
    icone: TrendingUp,
    cor: "text-purple-500 bg-purple-500/10",
  },
] as const;

interface WizardProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  tokenInput: string;
  setTokenInput: (v: string) => void;
  turnstileToken: string | null;
  setTurnstileToken: (v: string | null) => void;
  loading: boolean;
  aceitouDocumentos: boolean;
  setAceitouDocumentos: (v: boolean) => void;
  cadastroLivre: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

// ─── Wizard de onboarding ─────────────────────────────────────────────────────

function OnboardingWizard({
  form,
  setForm,
  tokenInput,
  setTokenInput,
  turnstileToken,
  setTurnstileToken,
  loading,
  aceitouDocumentos,
  setAceitouDocumentos,
  cadastroLivre,
  onSubmit,
}: WizardProps) {
  const stepsVisiveis: StepId[] = cadastroLivre
    ? ["boas-vindas", "objetivo", "dados", "senha", "termos"]
    : ["boas-vindas", "convite", "objetivo", "dados", "senha", "termos"];

  const [stepIdx, setStepIdx] = useState(0);
  const [objetivoSelecionado, setObjetivoSelecionado] = useState<string>("controle");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirma, setMostrarConfirma] = useState(false);

  const currentStepId: StepId = stepsVisiveis[stepIdx] ?? "boas-vindas";
  const isLast = stepIdx === stepsVisiveis.length - 1;
  const progresso = Math.round(((stepIdx + 1) / stepsVisiveis.length) * 100);

  // Validações de senha em tempo real
  const temMaiuscula = /[A-Z]/.test(form.senha);
  const temMinuscula = /[a-z]/.test(form.senha);
  const temNumero = /[0-9]/.test(form.senha);
  const temEspecial = /[^A-Za-z0-9]/.test(form.senha);
  const temTamanhoMinimo = form.senha.length >= 8;
  const senhasBatem = form.senha.length > 0 && form.senha === form.confirmarSenha;

  function avancar() {
    if (currentStepId === "convite" && !cadastroLivre && !tokenInput.trim()) {
      toast.error("Informe o código de convite para continuar");
      return;
    }
    if (currentStepId === "dados") {
      if (form.nome.trim().length < 2) {
        toast.error("Informe seu nome completo");
        return;
      }
      if (!form.email.includes("@")) {
        toast.error("Informe um e-mail válido");
        return;
      }
    }
    if (currentStepId === "senha") {
      if (!temTamanhoMinimo) {
        toast.error("A senha precisa ter ao menos 8 caracteres");
        return;
      }
      if (form.senha !== form.confirmarSenha) {
        toast.error("As senhas não são iguais");
        return;
      }
    }
    setStepIdx((i) => Math.min(i + 1, stepsVisiveis.length - 1));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !isLast) {
      e.preventDefault();
      avancar();
    }
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={handleKeyDown}>
      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        {/* Barra de progresso vibrante verde */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* PASSO 1: Boas-vindas */}
          {currentStepId === "boas-vindas" && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Boas-vindas ao Control ALL
                </span>
                <h2 className="text-xl font-bold tracking-tight">Organize seu dinheiro com clareza</h2>
                <p className="text-xs text-muted-foreground">
                  Suas finanças pessoais e notas fiscais inteligentes em um só lugar.
                </p>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 space-y-2.5 text-xs text-muted-foreground border">
                <p className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Fluxo de caixa</strong> e parcelamentos automáticos</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Leitor de Notas Fiscais</strong> via QR Code do SEFAZ com IA</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Sem taxas de adesão</strong> e privacidade total</span>
                </p>
              </div>

              {/* Apenas Google e Microsoft */}
              <SocialAuthButtons labelPrefix="Cadastrar com" />

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou cadastre com e-mail</span>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 2: Convite (se restrito) */}
          {currentStepId === "convite" && (
            <div className="space-y-3">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">Código de Convite</h2>
                <p className="text-xs text-muted-foreground">
                  Cole o código que um amigo compartilhou com você.
                </p>
              </div>
              <Input
                autoFocus
                autoComplete="off"
                placeholder="XXXX-XXXX"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="font-mono text-center text-base tracking-widest h-12"
              />
            </div>
          )}

          {/* PASSO 3: Objetivos Principais (Inspirado na Imagem 2) */}
          {currentStepId === "objetivo" && (
            <div className="space-y-4">
              {/* Balão de fala de assistente */}
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-xs text-foreground">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Sparkles className="size-4" />
                </div>
                <p className="leading-relaxed">
                  Para ajudarmos da melhor maneira possível, nos diga seu{" "}
                  <strong>objetivo principal</strong> com o Control ALL:
                </p>
              </div>

              {/* Cards Selecionáveis */}
              <div className="space-y-2.5">
                {OBJETIVOS.map(({ id, titulo, subtitulo, icone: Icon, cor }) => {
                  const selecionado = objetivoSelecionado === id;
                  return (
                    <div
                      key={id}
                      onClick={() => setObjetivoSelecionado(id)}
                      className={`flex items-center gap-3.5 rounded-xl border p-3.5 cursor-pointer transition-all ${
                        selecionado
                          ? "border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${cor}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{titulo}</p>
                        <p className="text-xs text-muted-foreground">{subtitulo}</p>
                      </div>
                      <div
                        className={`size-4 rounded-full border flex items-center justify-center ${
                          selecionado ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"
                        }`}
                      >
                        {selecionado && <Check className="size-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASSO 4: Dados Básicos (Inspirado na Imagem 1) */}
          {currentStepId === "dados" && (
            <div className="space-y-3.5">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold">Crie sua conta :)</h2>
                <p className="text-xs text-muted-foreground">Preencha seus dados para continuar</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="c-nome" className="text-xs font-semibold">
                  Nome completo
                </Label>
                <Input
                  autoFocus
                  id="c-nome"
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="h-11 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="c-telefone" className="text-xs font-semibold">
                  Número de telefone <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div className="flex items-center rounded-md border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0 border-r pr-2 mr-2">
                    🇧🇷 +55
                  </span>
                  <Input
                    id="c-telefone"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="border-0 p-0 h-11 focus-visible:ring-0 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="c-email" className="text-xs font-semibold">
                  E-mail
                </Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="voce@email.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-11 text-sm"
                />
              </div>
            </div>
          )}

          {/* PASSO 5: Senha com Checklist Visual (Inspirado na Imagem 1) */}
          {currentStepId === "senha" && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">Defina sua senha</h2>
                <p className="text-xs text-muted-foreground">Crie uma senha forte e segura</p>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1">
                <Label htmlFor="c-senha" className="text-xs font-semibold">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    autoFocus
                    id="c-senha"
                    type={mostrarSenha ? "text" : "password"}
                    placeholder="Sua senha secreta"
                    autoComplete="new-password"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    className="h-11 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Checklist Visual dos Requisitos da Senha */}
              <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground text-[11px] mb-1">A senha deve ter no mínimo:</p>
                <p className={`flex items-center gap-1.5 ${temMaiuscula ? "text-emerald-600 font-medium" : ""}`}>
                  <Check className={`size-3.5 ${temMaiuscula ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                  1 letra maiúscula
                </p>
                <p className={`flex items-center gap-1.5 ${temMinuscula ? "text-emerald-600 font-medium" : ""}`}>
                  <Check className={`size-3.5 ${temMinuscula ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                  1 letra minúscula
                </p>
                <p className={`flex items-center gap-1.5 ${temNumero ? "text-emerald-600 font-medium" : ""}`}>
                  <Check className={`size-3.5 ${temNumero ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                  1 número
                </p>
                <p className={`flex items-center gap-1.5 ${temEspecial ? "text-emerald-600 font-medium" : ""}`}>
                  <Check className={`size-3.5 ${temEspecial ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                  1 caractere especial (!@#$...)
                </p>
                <p className={`flex items-center gap-1.5 ${temTamanhoMinimo ? "text-emerald-600 font-medium" : ""}`}>
                  <Check className={`size-3.5 ${temTamanhoMinimo ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                  Mínimo 8 caracteres
                </p>
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-1">
                <Label htmlFor="c-confirma" className="text-xs font-semibold">
                  Confirme sua senha
                </Label>
                <div className="relative">
                  <Input
                    id="c-confirma"
                    type={mostrarConfirma ? "text" : "password"}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    value={form.confirmarSenha}
                    onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                    className={`h-11 pr-10 text-sm ${
                      form.confirmarSenha
                        ? senhasBatem
                          ? "border-emerald-500 focus-visible:ring-emerald-500"
                          : "border-rose-500 focus-visible:ring-rose-500"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirma(!mostrarConfirma)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {mostrarConfirma ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {form.confirmarSenha && !senhasBatem && (
                  <p className="text-xs text-rose-500 font-medium pt-1">
                    As senhas não são iguais, revise antes de continuar
                  </p>
                )}
                {senhasBatem && (
                  <p className="text-xs text-emerald-600 font-medium pt-1 flex items-center gap-1">
                    <Check className="size-3" /> Senhas conferem!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PASSO 6: Termos & Finalização */}
          {currentStepId === "termos" && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">Quase pronto! 🚀</h2>
                <p className="text-xs text-muted-foreground">
                  Para finalizar seu cadastro, confirme a aceitação dos termos.
                </p>
              </div>

              {TURNSTILE_ATIVO && <TurnstileWidget onVerify={setTurnstileToken} />}

              <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/40 transition-colors">
                <Checkbox
                  checked={aceitouDocumentos}
                  onCheckedChange={(v) => setAceitouDocumentos(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Ao continuar, você concorda com nossos{" "}
                  <span className="inline-flex gap-1">
                    <LegalDialogs compact />
                  </span>
                  . Entendo que sou responsável pela guarda da minha senha.
                </span>
              </label>

              {aceitouDocumentos && (
                <p className="text-xs text-emerald-600 font-medium text-center">
                  ✅ Tudo pronto para criar sua conta!
                </p>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className={`flex gap-2 pt-2 ${stepIdx > 0 ? "justify-between" : "justify-end"}`}>
            {stepIdx > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStepIdx((i) => Math.max(i - 1, 0))}
                disabled={loading}
              >
                ← Voltar
              </Button>
            )}

            {isLast ? (
              <Button
                type="submit"
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
                disabled={loading || !aceitouDocumentos || (TURNSTILE_ATIVO && !turnstileToken)}
              >
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {loading ? "Criando conta…" : "Criar minha conta"}
              </Button>
            ) : (
              <Button
                type="button"
                className={`h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold ${
                  currentStepId === "boas-vindas" ? "w-full" : "flex-1"
                }`}
                onClick={avancar}
              >
                {currentStepId === "boas-vindas" ? "Cadastrar com e-mail →" : "Continuar"}
              </Button>
            )}
          </div>

          {/* Indicador de passos */}
          <p className="text-center text-[11px] text-muted-foreground">
            Passo {stepIdx + 1} de {stepsVisiveis.length}
          </p>
        </div>
      </div>
    </form>
  );
}

