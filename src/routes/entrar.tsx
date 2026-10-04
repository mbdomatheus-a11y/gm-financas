import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, UserPlus, LogIn as LogInIcon, Loader2 } from "lucide-react";
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

type StepId = "boas-vindas" | "convite" | "nome" | "email" | "senha" | "termos";

const STEP_META: Record<StepId, { titulo: string; subtitulo: string }> = {
  "boas-vindas": {
    titulo: "Bem-vindo ao Control ALL 🎉",
    subtitulo: "Comece a organizar suas finanças em menos de 2 minutos.",
  },
  convite: {
    titulo: "Você tem um código de convite?",
    subtitulo: "Cole aqui se alguém te convidou — ou avance sem código.",
  },
  nome: {
    titulo: "Como podemos te chamar?",
    subtitulo: "Seu nome aparece no painel e nos relatórios.",
  },
  email: {
    titulo: "Qual é o seu e-mail?",
    subtitulo: "Você vai usar para entrar. Pode ser o mesmo da sua conta Google.",
  },
  senha: {
    titulo: "Crie uma senha segura",
    subtitulo: "Mínimo 8 caracteres. Guarde bem — você vai precisar!",
  },
  termos: {
    titulo: "Quase lá! ✅",
    subtitulo: "Aceite os termos para concluir o cadastro.",
  },
};

interface WizardProps {
  form: FormState;
  setForm: (f: FormState) => void;
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
    ? ["boas-vindas", "nome", "email", "senha", "termos"]
    : ["boas-vindas", "convite", "nome", "email", "senha", "termos"];

  const [stepIdx, setStepIdx] = useState(0);
  const currentStepId: StepId = stepsVisiveis[stepIdx] ?? "boas-vindas";
  const meta = STEP_META[currentStepId];
  const isLast = stepIdx === stepsVisiveis.length - 1;
  const progresso = Math.round(((stepIdx + 1) / stepsVisiveis.length) * 100);

  const motivacao: Partial<Record<StepId, string>> = {
    nome: "👋 Ótimo começo!",
    email: `Olá, ${form.nome.split(" ")[0] || "você"}! Só mais alguns passos…`,
    senha: "Falta pouco! Crie uma senha e pronto.",
    termos: `${form.nome.split(" ")[0] || "Você"} está quase lá! 🚀`,
  };

  function avancar() {
    if (currentStepId === "convite" && !cadastroLivre && !tokenInput.trim()) {
      toast.error("Informe o código de convite para continuar");
      return;
    }
    if (currentStepId === "nome" && form.nome.trim().length < 2) {
      toast.error("Informe ao menos seu primeiro nome");
      return;
    }
    if (currentStepId === "email" && !form.email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (currentStepId === "senha") {
      if (form.senha.length < 8) { toast.error("A senha precisa ter ao menos 8 caracteres"); return; }
      if (form.senha !== form.confirmarSenha) { toast.error("As senhas não conferem"); return; }
    }
    setStepIdx((i) => Math.min(i + 1, stepsVisiveis.length - 1));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !isLast) { e.preventDefault(); avancar(); }
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={handleKeyDown}>
      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        {/* Barra de progresso */}
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>

        <div className="p-6 space-y-5">
          {/* Cabeçalho motivacional */}
          <div className="space-y-1 text-center">
            {motivacao[currentStepId] && (
              <p className="text-xs font-medium text-primary">{motivacao[currentStepId]}</p>
            )}
            <h2 className="text-lg font-semibold tracking-tight">{meta.titulo}</h2>
            <p className="text-sm text-muted-foreground">{meta.subtitulo}</p>
          </div>

          {/* Passo 1: boas-vindas */}
          {currentStepId === "boas-vindas" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm text-muted-foreground">
                <p>✅ <strong>Receitas e despesas</strong> num só lugar</p>
                <p>📊 <strong>Parcelas, cartões e faturas</strong> sempre organizados</p>
                <p>🤖 <strong>IA que lê notas fiscais</strong> e gera lançamentos</p>
                <p>🎯 <strong>Gamificação financeira</strong> — veja quanto cada compra custa em horas de trabalho</p>
              </div>
              <SocialAuthButtons labelPrefix="Cadastrar com" />
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou crie com e-mail</span>
                </div>
              </div>
            </div>
          )}

          {/* Passo 2: convite */}
          {currentStepId === "convite" && (
            <div className="space-y-2">
              <Input
                autoFocus
                autoComplete="off"
                placeholder="Cole o código aqui (ou deixe em branco)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="font-mono text-center text-base tracking-widest h-12"
              />
              <p className="text-xs text-muted-foreground text-center">
                Peça a quem já usa o Control ALL — cada usuário pode gerar até 3 convites.
              </p>
            </div>
          )}

          {/* Passo 3: nome */}
          {currentStepId === "nome" && (
            <Input
              autoFocus id="c-nome" placeholder="Seu nome" autoComplete="name"
              value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="h-12 text-base"
            />
          )}

          {/* Passo 4: email */}
          {currentStepId === "email" && (
            <Input
              autoFocus id="c-email" type="email" placeholder="voce@email.com" autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-12 text-base"
            />
          )}

          {/* Passo 5: senha */}
          {currentStepId === "senha" && (
            <div className="space-y-3">
              <Input
                autoFocus id="c-senha" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password"
                value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })}
                className="h-12 text-base"
              />
              <Input
                id="c-confirma" type="password" placeholder="Confirme a senha" autoComplete="new-password"
                value={form.confirmarSenha} onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                className="h-12 text-base"
              />
              {form.senha.length >= 8 && form.senha === form.confirmarSenha && (
                <p className="text-xs text-green-600 font-medium text-center">✅ Senhas conferem!</p>
              )}
            </div>
          )}

          {/* Passo 6: termos */}
          {currentStepId === "termos" && (
            <div className="space-y-4">
              {TURNSTILE_ATIVO && <TurnstileWidget onVerify={setTurnstileToken} />}
              <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/40 transition-colors">
                <Checkbox
                  checked={aceitouDocumentos}
                  onCheckedChange={(v) => setAceitouDocumentos(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                  Li e aceito os{" "}<span className="inline-flex gap-1"><LegalDialogs compact /></span>.
                  {" "}Entendo que sou responsável por proteger minha senha.
                </span>
              </label>
              {aceitouDocumentos && (
                <p className="text-xs text-green-600 font-medium text-center">✅ Tudo certo, pode criar sua conta!</p>
              )}
            </div>
          )}

          {/* Navegação */}
          <div className={`flex gap-2 pt-1 ${stepIdx > 0 ? "justify-between" : "justify-end"}`}>
            {stepIdx > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStepIdx((i) => Math.max(i - 1, 0))} disabled={loading}>
                ← Voltar
              </Button>
            )}
            {isLast ? (
              <Button
                type="submit" className="flex-1 h-11"
                disabled={loading || !aceitouDocumentos || (TURNSTILE_ATIVO && !turnstileToken)}
              >
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {loading ? "Criando conta…" : "Criar minha conta 🚀"}
              </Button>
            ) : (
              <Button
                type="button"
                className={currentStepId === "boas-vindas" ? "w-full h-11" : "flex-1 h-11"}
                onClick={avancar}
              >
                {currentStepId === "boas-vindas" ? "Criar conta com e-mail →" : "Continuar →"}
              </Button>
            )}
          </div>

          {/* Indicador de passo */}
          <p className="text-center text-xs text-muted-foreground">
            {stepIdx + 1} de {stepsVisiveis.length}
          </p>
        </div>
      </div>
    </form>
  );
}
