import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Loader2, ArrowLeft, UserPlus, LogIn as LogInIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { cpfToEmail, isValidCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { aceitarConvite } from "@/lib/convites.functions";
import { solicitarCodigoRecuperacao } from "@/lib/conta-exclusao.functions";
import { registrarSucessoLogin } from "@/lib/login-protecao.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandMark } from "@/components/BrandMark";
import { LegalDialogs } from "@/components/LegalDialogs";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { confirmarSegundoFator, iniciarLoginSeguro } from "@/lib/seguranca-conta.functions";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): { convite?: string; next?: string } => ({
    ...(typeof s["convite"] === "string" && s["convite"] ? { convite: s["convite"] } : {}),
    ...(typeof s["next"] === "string" && s["next"].startsWith("/") && !s["next"].startsWith("//")
      ? { next: s["next"] }
      : {}),
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign(search.next ?? "/inicio");
    });
  }, [search.next]);

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
          <BrandMark className="mb-4 size-14 rounded-2xl shadow-soft" />
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
            <EntrarForm {...(search.next ? { next: search.next } : {})} />
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
const IDENTIFICADOR_SALVO = "control-all-identificador";
const DOMINIOS_EMAIL = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "yahoo.com.br",
  "uol.com.br",
];

function EntrarForm({ next }: { next?: string }) {
  const navigate = useNavigate();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrarIdentificador, setLembrarIdentificador] = useState(false);
  const [loading, setLoading] = useState(false);
  const [desafio2fa, setDesafio2fa] = useState<{
    id: string;
    email: string;
    senhaTemporaria: boolean;
    minutos: number;
  } | null>(null);
  const [codigo2fa, setCodigo2fa] = useState("");
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const loginSeguro = useServerFn(iniciarLoginSeguro);
  const confirmar2fa = useServerFn(confirmarSegundoFator);
  const { data: config } = useQuery({
    queryKey: ["configuracao-acesso-publica"],
    queryFn: () => obterConfig(),
    staleTime: 60_000,
  });
  const registrarSucesso = useServerFn(registrarSucessoLogin);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(IDENTIFICADOR_SALVO);
      if (salvo) {
        setIdentificador(salvo);
        setLembrarIdentificador(true);
      }
    } catch {
      // Navegação privada pode bloquear armazenamento local.
    }
  }, []);

  const modo = config?.modo_login ?? "ambos";
  const ehEmail = identificador.includes("@");
  const cpfDigitado = ehEmail ? "" : identificador;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modo === "email" && !ehEmail) {
      toast.error("O acesso está configurado somente por e-mail.");
      return;
    }
    if (modo === "cpf" && ehEmail) {
      toast.error("O acesso está configurado somente por CPF.");
      return;
    }
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
    let resultado;
    try {
      resultado = await loginSeguro({ data: { identificador: identificador.trim(), senha } });
    } catch (error) {
      setLoading(false);
      const mensagem = error instanceof Error ? error.message : "";
      toast.error(
        mensagem.includes("LOGIN_BLOQUEADO")
          ? "Três tentativas incorretas. O acesso foi bloqueado por 15 minutos."
          : mensagem.includes("LOGIN_MODO_CPF")
            ? "O acesso está configurado somente por CPF."
            : mensagem.includes("LOGIN_MODO_EMAIL")
              ? "O acesso está configurado somente por e-mail."
              : "Credenciais incorretas",
      );
      return;
    }
    if (resultado.exige2fa) {
      setLoading(false);
      setDesafio2fa({
        id: resultado.desafioId,
        email: resultado.emailMascarado,
        senhaTemporaria: resultado.senhaTemporaria,
        minutos: resultado.sessaoMaximaMinutos,
      });
      toast.success("Código de segurança enviado por e-mail.");
      return;
    }
    const { error } = await supabase.auth.setSession({
      access_token: resultado.accessToken,
      refresh_token: resultado.refreshToken,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível abrir a sessão.");
      return;
    }
    void registrarSucesso({ data: { identificador: email } });
    sessionStorage.setItem("control-all-sessao-iniciada", String(Date.now()));
    sessionStorage.setItem("control-all-sessao-max-min", String(resultado.sessaoMaximaMinutos));
    try {
      if (lembrarIdentificador) {
        localStorage.setItem(IDENTIFICADOR_SALVO, identificador.trim());
      } else {
        localStorage.removeItem(IDENTIFICADOR_SALVO);
      }
    } catch {
      // O acesso continua funcionando mesmo sem armazenamento local.
    }
    toast.success("Bem-vindo de volta!");
    if (resultado.senhaTemporaria) {
      navigate({ to: "/nova-senha" });
    } else {
      window.location.assign(next ?? "/inicio");
    }
  }

  async function validar2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!desafio2fa) return;
    setLoading(true);
    try {
      const { tokenHash } = await confirmar2fa({
        data: { desafioId: desafio2fa.id, codigo: codigo2fa },
      });
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) throw error;
      sessionStorage.setItem("control-all-sessao-iniciada", String(Date.now()));
      sessionStorage.setItem("control-all-sessao-max-min", String(desafio2fa.minutos));
      window.location.assign(desafio2fa.senhaTemporaria ? "/nova-senha" : (next ?? "/inicio"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  if (desafio2fa)
    return (
      <form onSubmit={validar2fa} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <div>
          <h2 className="font-semibold">Confirmação em duas etapas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Digite o código de 6 números enviado para {desafio2fa.email}.
          </p>
        </div>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo2fa}
          onChange={(e) => setCodigo2fa(onlyDigits(e.target.value).slice(0, 6))}
          placeholder="000000"
          className="h-12 text-center text-xl tracking-[.4em]"
        />
        <Button type="submit" className="w-full" disabled={codigo2fa.length !== 6 || loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}Validar e entrar
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setDesafio2fa(null);
            setCodigo2fa("");
          }}
        >
          Voltar
        </Button>
      </form>
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
      <div className="space-y-2">
        <Label htmlFor="identificador">
          {modo === "cpf" ? "CPF" : modo === "email" ? "E-mail" : "E-mail ou CPF"}
        </Label>
        <Input
          id="identificador"
          autoComplete="username"
          placeholder={
            modo === "cpf"
              ? "000.000.000-00"
              : modo === "email"
                ? "voce@email.com"
                : "voce@email.com ou 000.000.000-00"
          }
          value={
            // Só aplica a máscara de CPF quando o que já foi digitado é
            // compatível com CPF (dígitos/pontuação) — caso contrário
            // (qualquer letra, típico de e-mail) mostra o valor cru, senão
            // a máscara apagaria cada letra digitada e pareceria que o
            // campo "não aceita letra".
            modo !== "email" && /^[\d.-]*$/.test(identificador)
              ? maskCpf(identificador)
              : identificador
          }
          onChange={(e) => setIdentificador(e.target.value)}
          list="dominios-email-comuns"
          className="h-11"
        />
        <datalist id="dominios-email-comuns">
          {identificador && !identificador.includes("@") && /[a-z]/i.test(identificador)
            ? DOMINIOS_EMAIL.map((dominio) => (
                <option key={dominio} value={`${identificador.trim()}@${dominio}`} />
              ))
            : null}
        </datalist>
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
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={lembrarIdentificador}
          onCheckedChange={(checked) => {
            const lembrar = checked === true;
            setLembrarIdentificador(lembrar);
            if (!lembrar) {
              try {
                localStorage.removeItem(IDENTIFICADOR_SALVO);
              } catch {
                /* indisponível */
              }
            }
          }}
        />
        Lembrar {modo === "cpf" ? "CPF" : modo === "email" ? "e-mail" : "e-mail ou CPF"} neste
        dispositivo. A senha nunca é salva pelo site.
      </label>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Entrar
      </Button>

      <Link
        to="/esqueci-senha"
        className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Esqueci minha senha
      </Link>
      <p className="text-center text-[11px] text-muted-foreground">
        Conta antiga criada por CPF? O link por e-mail não funciona pra ela — peça a um
        administrador para redefinir em <strong>Usuários e Privilégios</strong>.
      </p>
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
  const solicitarCodigo = useServerFn(solicitarCodigoRecuperacao);
  const [form, setForm] = useState(emptyCadastro);
  const [tokenInput, setTokenInput] = useState(token ?? "");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aceitouDocumentos, setAceitouDocumentos] = useState(false);

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
    if (!aceitouDocumentos) {
      toast.error(
        "Você precisa aceitar os Termos de Uso e o Aviso de Privacidade para criar a conta.",
      );
      return;
    }

    setLoading(true);
    try {
      const dadosCadastro = {
        token: tokenInput.trim(),
        nome: form.nome.trim(),
        cpf,
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        dataNascimento: form.dataNascimento,
        senha: form.senha,
        turnstileToken: turnstileToken ?? undefined,
        aceitouDocumentos: true,
      };
      let res;
      try {
        res = await aceitar({ data: dadosCadastro });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("RECUPERACAO_DISPONIVEL")) {
          const recuperar = window.confirm(
            "Encontramos uma conta excluída há menos de 90 dias. Deseja recuperar os dados anteriores? Você precisará confirmar o e-mail usado antes da exclusão. Clique em Cancelar para criar uma conta nova.",
          );
          if (recuperar) {
            await solicitarCodigo({ data: { cpf, email: dadosCadastro.email } });
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
          O cadastro é só por convite. Peça o código a quem já usa o Control ALL — ele pode gerar um
          em <strong>Minha conta</strong> ou, se for admin, em{" "}
          <strong>Usuários e Privilégios</strong>. Cada pessoa pode gerar até 3 códigos.
        </p>
      </div>

      <label className="flex items-start gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
        <Checkbox
          checked={aceitouDocumentos}
          onCheckedChange={(checked) => setAceitouDocumentos(checked === true)}
        />
        <span>
          Li e aceito os{" "}
          <span className="inline-flex gap-1">
            <LegalDialogs compact />
          </span>
          . Entendo que sou responsável por proteger minha senha e não compartilhar meu acesso.
        </span>
      </label>
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
