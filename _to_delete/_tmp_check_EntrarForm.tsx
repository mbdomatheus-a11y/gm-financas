import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cpfToEmail, isValidCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { registrarSucessoLogin } from "@/lib/login-protecao.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { confirmarSegundoFator, iniciarLoginSeguro } from "@/lib/seguranca-conta.functions";

/**
 * Formulário de login por e-mail (contas novas) OU CPF (contas antigas,
 * compatibilidade) — extraído de `entrar.tsx` (item 6 do backlog de
 * 2026-09-26) pra ser reaproveitado tanto na página completa `/entrar`
 * quanto no popup de login da home (`EntrarDialog`), sem duplicar lógica.
 */
const IDENTIFICADOR_SALVO = "control-all-identificador";
const DOMINIOS_EMAIL = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "yahoo.com.br",
  "uol.com.br",
];

export function EntrarForm({
  next,
  onSucesso,
  esqueciSenhaComoLink = true,
}: {
  next?: string;
  /** Chamado após a sessão ser aberta com sucesso, antes do redirecionamento. Útil pra fechar um dialog. */
  onSucesso?: () => void;
  /** Se falso, "Esqueci minha senha" não usa <Link> (útil dentro de um Dialog, onde a navegação já fecha o popup naturalmente — mantém <Link> por padrão). */
  esqueciSenhaComoLink?: boolean;
}) {
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
    onSucesso?.();
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
      onSucesso?.();
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

      {esqueciSenhaComoLink ? (
        <Link
          to="/esqueci-senha"
          className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Esqueci minha senha
        </Link>
      ) : null}
      <p className="text-center text-[11px] text-muted-foreground">
        Conta antiga criada por CPF? O link por e-mail não funciona pra ela — peça a um
        administrador para redefinir em <strong>Usuários e Privilégios</strong>.
      </p>
    </form>
  );
}
