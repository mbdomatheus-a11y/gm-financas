import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Loader2, ArrowLeft, UserPlus, LogIn as LogInIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { cpfToEmail, isValidCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { aceitarConvite } from "@/lib/convites.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): { convite?: string } =>
    typeof s["convite"] === "string" && s["convite"] ? { convite: s["convite"] } : {},
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio" });
    });
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Voltar pra página inicial
        </Link>

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="gradient-brand mb-4 flex size-14 items-center justify-center rounded-2xl shadow-soft">
            <Wallet className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Control ALL</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre ou crie sua conta para acessar o painel
          </p>
        </div>

        <Tabs defaultValue={search.convite ? "criar" : "entrar"} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="entrar" className="gap-1.5">
              <LogInIcon className="size-3.5" /> Entrar
            </TabsTrigger>
            <TabsTrigger value="criar" className="gap-1.5">
              <UserPlus className="size-3.5" /> Criar conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entrar">
            <EntrarForm />
          </TabsContent>
          <TabsContent value="criar">
            <CriarContaForm token={search.convite} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

/** Login por e-mail (contas novas) OU CPF (contas antigas, compatibilidade). */
function EntrarForm() {
  const navigate = useNavigate();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const ehEmail = identificador.includes("@");
  const cpfDigitado = ehEmail ? "" : identificador;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let email: string;
    if (ehEmail) {
      email = identificador.trim();
    } else {
      if (!isValidCpf(cpfDigitado)) {
        toast.error("CPF inválido");
        return;
      }
      email = cpfToEmail(cpfDigitado);
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error || !data.user) {
      toast.error("Credenciais incorretas");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("senha_temporaria, ativo")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.ativo === false) {
      await supabase.auth.signOut();
      toast.error("Usuário inativo. Fale com um administrador.");
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: profile?.senha_temporaria ? "/nova-senha" : "/inicio" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
      <div className="space-y-2">
        <Label htmlFor="identificador">E-mail ou CPF</Label>
        <Input
          id="identificador"
          autoComplete="username"
          placeholder="voce@email.com ou 000.000.000-00"
          value={
            // Só aplica a máscara de CPF quando o que já foi digitado é
            // compatível com CPF (dígitos/pontuação) — caso contrário
            // (qualquer letra, típico de e-mail) mostra o valor cru, senão
            // a máscara apagaria cada letra digitada e pareceria que o
            // campo "não aceita letra".
            /^[\d.-]*$/.test(identificador) ? maskCpf(identificador) : identificador
          }
          onChange={(e) => setIdentificador(e.target.value)}
          className="h-11"
        />
        {!ehEmail && onlyDigits(cpfDigitado).length === 11 && !isValidCpf(cpfDigitado) && (
          <p className="text-xs text-destructive">CPF inválido</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="h-11"
        />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Entrar
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperação de senha</DialogTitle>
            <DialogDescription>
              Contas antigas (criadas por CPF): peça a um administrador para abrir{" "}
              <strong>Usuários e Privilégios</strong> e redefinir sua senha — você receberá uma
              senha provisória e será obrigado a criar uma nova no próximo login. Contas criadas por
              convite (com e-mail): fale com quem te convidou ou com um administrador — a
              recuperação automática por e-mail ainda não está disponível.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </form>
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

/**
 * Cadastro por convite — o usuário informa o código de convite direto no
 * formulário (não depende mais de um link com domínio específico, que
 * podia apontar para um domínio de preview errado). O parâmetro `?convite=`
 * na URL continua funcionando como atalho pra pré-preencher o campo, mas
 * não é obrigatório.
 */
function CriarContaForm({ token }: { token: string | undefined }) {
  const navigate = useNavigate();
  const aceitar = useServerFn(aceitarConvite);
  const [form, setForm] = useState(emptyCadastro);
  const [tokenInput, setTokenInput] = useState(token ?? "");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast.error("Informe o código de convite");
      return;
    }
    const cpf = onlyDigits(form.cpf);
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido");
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
    if (form.telefone.trim().length < 8) {
      toast.error("Informe um telefone válido");
      return;
    }
    if (!form.dataNascimento) {
      toast.error("Informe a data de nascimento");
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

    setLoading(true);
    try {
      const res = await aceitar({
        data: {
          token: tokenInput.trim(),
          nome: form.nome.trim(),
          cpf,
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          dataNascimento: form.dataNascimento,
          senha: form.senha,
          turnstileToken: turnstileToken ?? undefined,
        },
      });
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
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível criar a conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border bg-card p-6 shadow-card">
      <div className="space-y-1.5">
        <Label htmlFor="c-token">Código de convite</Label>
        <Input
          id="c-token"
          autoComplete="off"
          placeholder="Cole aqui o código que você recebeu"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          O cadastro é só por convite. Peça o código a quem já usa o Control ALL — ele pode gerar
          um em <strong>Minha conta</strong> ou, se for admin, em{" "}
          <strong>Usuários e Privilégios</strong>. Cada pessoa pode gerar até 3 códigos.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-nome">Nome completo</Label>
        <Input
          id="c-nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-cpf">CPF</Label>
        <Input
          id="c-cpf"
          inputMode="numeric"
          value={maskCpf(form.cpf)}
          onChange={(e) => setForm({ ...form, cpf: onlyDigits(e.target.value).slice(0, 11) })}
          placeholder="000.000.000-00"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-email">E-mail</Label>
        <Input
          id="c-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-telefone">Telefone</Label>
        <Input
          id="c-telefone"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={form.telefone}
          onChange={(e) => setForm({ ...form, telefone: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-nascimento">Data de nascimento</Label>
        <Input
          id="c-nascimento"
          type="date"
          value={form.dataNascimento}
          onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-senha">Senha</Label>
        <Input
          id="c-senha"
          type="password"
          autoComplete="new-password"
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-confirma">Confirmar senha</Label>
        <Input
          id="c-confirma"
          type="password"
          autoComplete="new-password"
          value={form.confirmarSenha}
          onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
        />
      </div>

      {TURNSTILE_ATIVO && <TurnstileWidget onVerify={setTurnstileToken} />}

      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Criar conta
      </Button>
    </form>
  );
}
