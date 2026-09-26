import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus, LogIn as LogInIcon } from "lucide-react";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const returnUrl = sessionStorage.getItem("control-all-return-url");
      const target = search.next || (returnUrl && returnUrl.startsWith("/") ? returnUrl : "/inicio");
      if (data.session) window.location.assign(target);
    });
  }, [search.next]);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark className="mb-4 size-14 rounded-2xl shadow-soft" />
          <h1 className="text-2xl font-bold tracking-tight">Control ALL</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre ou crie sua conta para acessar o painel
          </p>
        </div>

        <Tabs defaultValue={search.convite || search.criar ? "criar" : "entrar"} className="w-full">
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
