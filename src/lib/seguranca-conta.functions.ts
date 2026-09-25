import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf, onlyDigits } from "@/lib/cpf";

const hash = (valor: string) => createHash("sha256").update(valor).digest("hex");
const hashIdentificador = (valor: string) => hash(valor.trim().toLowerCase());
const urlBase = () => process.env["SITE_URL"] || "https://www.controlall.com.br";

export const iniciarLoginSeguro = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z
      .object({
        identificador: z.string().trim().min(3).max(160),
        senha: z.string().min(6).max(72),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const identificadorHash = hashIdentificador(data.identificador);
    const { data: tentativaAtual, error: tentativaErro } = await db
      .from("login_tentativas")
      .select("bloqueado_ate")
      .eq("identificador_hash", identificadorHash)
      .maybeSingle();
    if (tentativaErro) throw new Error("Não foi possível verificar a segurança do acesso.");
    if (
      tentativaAtual?.bloqueado_ate &&
      new Date(tentativaAtual.bloqueado_ate).getTime() > Date.now()
    )
      throw new Error("LOGIN_BLOQUEADO");
    const { data: config } = await db
      .from("configuracoes_acesso_site")
      .select("modo_login,segundo_fator_email,sessao_maxima_minutos")
      .eq("id", true)
      .single();
    const porEmail = data.identificador.includes("@");
    if (config.modo_login === "cpf" && porEmail) throw new Error("LOGIN_MODO_CPF");
    if (config.modo_login === "email" && !porEmail) throw new Error("LOGIN_MODO_EMAIL");
    let email = data.identificador.toLowerCase();
    if (!porEmail) {
      const cpf = onlyDigits(data.identificador);
      if (!isValidCpf(cpf)) throw new Error("CPF inválido.");
      const { data: perfil } = await db
        .from("profiles")
        .select("email")
        .eq("cpf", cpf)
        .eq("ativo", true)
        .maybeSingle();
      if (!perfil?.email) throw new Error("Credenciais incorretas.");
      email = perfil.email.toLowerCase();
    }
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
    const chave =
      process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !chave) throw new Error("Configuração de autenticação indisponível.");
    const cliente = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error } = await cliente.auth.signInWithPassword({
      email,
      password: data.senha,
    });
    if (error || !auth.user || !auth.session) {
      const { data: tentativa } = await db.rpc("registrar_tentativa_login", {
        p_hash: identificadorHash,
        p_sucesso: false,
      });
      const retorno = Array.isArray(tentativa) ? tentativa[0] : tentativa;
      if (retorno?.bloqueado_ate) throw new Error("LOGIN_BLOQUEADO");
      throw new Error("Credenciais incorretas.");
    }
    const { data: perfil } = await db
      .from("profiles")
      .select("ativo,senha_temporaria")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!perfil?.ativo) throw new Error("Usuário inativo. Fale com um administrador.");
    await db.rpc("registrar_tentativa_login", {
      p_hash: identificadorHash,
      p_sucesso: true,
    });
    if (!config.segundo_fator_email)
      return {
        exige2fa: false as const,
        accessToken: auth.session.access_token,
        refreshToken: auth.session.refresh_token,
        senhaTemporaria: !!perfil.senha_temporaria,
        sessaoMaximaMinutos: config.sessao_maxima_minutos as number,
      };
    const codigo = String(randomInt(100000, 1000000));
    const { data: desafio, error: desafioErro } = await db
      .from("login_2fa_desafios")
      .insert({ user_id: auth.user.id, codigo_hash: hash(codigo) })
      .select("id")
      .single();
    if (desafioErro) throw new Error("Não foi possível iniciar o segundo fator.");
    const { enviarEmail } = await import("@/lib/email.server");
    const enviado = await enviarEmail({
      to: email,
      subject: "Código de acesso do Control ALL",
      html: `<p>Seu código de acesso é:</p><p style="font-size:28px;letter-spacing:6px"><strong>${codigo}</strong></p><p>Ele vale por 10 minutos e pode ser usado uma única vez.</p>`,
    });
    if (!enviado.ok) {
      await db.from("login_2fa_desafios").delete().eq("id", desafio.id);
      throw new Error("Não foi possível enviar o código de segurança.");
    }
    return {
      exige2fa: true as const,
      desafioId: desafio.id as string,
      emailMascarado: email.replace(/^(.{2}).*(@.*)$/, "$1••••$2"),
      senhaTemporaria: !!perfil.senha_temporaria,
      sessaoMaximaMinutos: config.sessao_maxima_minutos as number,
    };
  });

async function enviarAlertaSenha(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: auth } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!auth.user?.email || auth.user.email.endsWith("@financascasal.app")) return;
  const token = randomBytes(32).toString("hex");
  await db.from("bloqueio_conta_tokens").insert({ user_id: userId, token_hash: hash(token) });
  const { enviarEmail } = await import("@/lib/email.server");
  await enviarEmail({
    to: auth.user.email,
    subject: "Sua senha do Control ALL foi alterada",
    html: `<p>A senha da sua conta no <strong>Control ALL</strong> foi alterada.</p><p>Se foi você, nenhuma ação é necessária.</p><p>Se não reconhece esta alteração, <a href="${urlBase()}/bloquear-conta?token=${token}">solicite o bloqueio imediato da conta</a> e escreva para <a href="mailto:privacidade@controlall.com.br">privacidade@controlall.com.br</a>.</p><p style="color:#666;font-size:12px">O link de bloqueio vale por 24 horas.</p>`,
  });
}

export const alterarMinhaSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ senha: z.string().min(8).max(72) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.senha,
    });
    if (error) throw new Error("Não foi possível alterar a senha.");
    await (supabaseAdmin as any)
      .from("profiles")
      .update({ senha_temporaria: false })
      .eq("id", context.userId);
    await enviarAlertaSenha(context.userId);
    return { ok: true as const };
  });

export const atualizarMeusDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        email: z.string().trim().email("E-mail inválido"),
        telefone: z.string().trim().max(20).optional().nullable(),
        dataNascimento: z.string().max(10).optional().nullable(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: anterior } = await db
      .from("profiles")
      .select("nome, email, telefone, data_nascimento")
      .eq("id", context.userId)
      .single();

    // Atualiza auth se o email mudou
    if (data.email.toLowerCase() !== anterior?.email?.toLowerCase()) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        email: data.email,
        email_confirm: true,
      });
      if (authErr) throw new Error(authErr.message || "Erro ao atualizar e-mail.");
    }

    const { error: perfErr } = await db
      .from("profiles")
      .update({
        nome: data.nome,
        email: data.email,
        telefone: data.telefone || null,
        data_nascimento: data.dataNascimento || null,
      })
      .eq("id", context.userId);
    if (perfErr) throw new Error(perfErr.message);

    await db.from("admin_audit_logs").insert({
      ator_id: context.userId,
      acao: "perfil_usuario_atualizado",
      alvo_id: context.userId,
      detalhes: {
        anterior,
        novo: data,
      },
    });

    return { ok: true as const };
  });

export async function notificarSenhaAlterada(userId: string) {
  await enviarAlertaSenha(userId);
}

export const solicitarSegundoFator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: config } = await db
      .from("configuracoes_acesso_site")
      .select("segundo_fator_email")
      .eq("id", true)
      .single();
    if (!config?.segundo_fator_email) return { exigido: false as const };
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (!auth.user?.email || auth.user.email.endsWith("@financascasal.app"))
      throw new Error("Esta conta não possui e-mail real para receber o código de segurança.");
    const codigo = String(randomInt(100000, 1000000));
    const { data: desafio, error } = await db
      .from("login_2fa_desafios")
      .insert({ user_id: context.userId, codigo_hash: hash(codigo) })
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível iniciar a verificação.");
    const { enviarEmail } = await import("@/lib/email.server");
    const enviado = await enviarEmail({
      to: auth.user.email,
      subject: "Código de acesso do Control ALL",
      html: `<p>Seu código de acesso é:</p><p style="font-size:28px;letter-spacing:6px"><strong>${codigo}</strong></p><p>Ele vale por 10 minutos e pode ser usado uma única vez.</p>`,
    });
    if (!enviado.ok) {
      await db.from("login_2fa_desafios").delete().eq("id", desafio.id);
      throw new Error("Não foi possível enviar o código de segurança.");
    }
    return {
      exigido: true as const,
      desafioId: desafio.id as string,
      emailMascarado: auth.user.email.replace(/^(.{2}).*(@.*)$/, "$1••••$2"),
    };
  });

export const confirmarSegundoFator = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z.object({ desafioId: z.string().uuid(), codigo: z.string().regex(/^\d{6}$/) }).parse(v),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: desafio } = await db
      .from("login_2fa_desafios")
      .select("id,user_id,codigo_hash,tentativas,expira_em,usado_em")
      .eq("id", data.desafioId)
      .maybeSingle();
    if (
      !desafio ||
      desafio.usado_em ||
      desafio.tentativas >= 5 ||
      new Date(desafio.expira_em).getTime() < Date.now()
    )
      throw new Error("Código inválido ou expirado.");
    const recebido = Buffer.from(hash(data.codigo), "hex"),
      esperado = Buffer.from(desafio.codigo_hash, "hex");
    if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
      await db
        .from("login_2fa_desafios")
        .update({ tentativas: desafio.tentativas + 1 })
        .eq("id", desafio.id);
      throw new Error("Código inválido ou expirado.");
    }
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(desafio.user_id);
    if (!auth.user?.email) throw new Error("Conta indisponível.");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: auth.user.email,
    });
    if (error || !link.properties.hashed_token)
      throw new Error("Não foi possível concluir o acesso.");
    await db
      .from("login_2fa_desafios")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", desafio.id);
    return { tokenHash: link.properties.hashed_token };
  });

export const bloquearContaPorToken = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ token: z.string().min(40) }).parse(v))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: registro } = await db
      .from("bloqueio_conta_tokens")
      .select("id,user_id,expira_em,usado_em")
      .eq("token_hash", hash(data.token))
      .maybeSingle();
    if (!registro || registro.usado_em || new Date(registro.expira_em).getTime() < Date.now())
      throw new Error("Este link é inválido ou expirou.");
    const { data: siteAdmin } = await db
      .from("site_admins")
      .select("user_id")
      .eq("user_id", registro.user_id)
      .maybeSingle();
    if (siteAdmin)
      throw new Error("A conta administrativa exige atendimento manual pelo canal de privacidade.");
    await supabaseAdmin.auth.admin.updateUserById(registro.user_id, { ban_duration: "876000h" });
    await db.from("profiles").update({ ativo: false }).eq("id", registro.user_id);
    await db
      .from("bloqueio_conta_tokens")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", registro.id);
    await db.from("admin_audit_logs").insert({
      ator_id: null,
      acao: "conta_bloqueada_por_alerta_de_senha",
      alvo_id: registro.user_id,
      detalhes: {},
    });
    return { ok: true as const };
  });
