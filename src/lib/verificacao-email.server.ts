// Confirmação de e-mail por código (cadastro e troca de e-mail).
// Revisão de segurança de 24/10/2026: antes a conta nascia com o e-mail aceito sem prova
// de que a pessoa é dona dele, e convites de grupo dependem desse e-mail.
// Tabela public.verificacoes_email (RLS ligado, sem policies: só o servidor lê e grava).
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export type FinalidadeVerificacao = "cadastro" | "troca_email";

const MAX_TENTATIVAS = 5;

export const normalizarEmail = (email: string) => email.trim().toLowerCase();
export const mascararEmail = (email: string) => email.replace(/^(.{2}).*(@.*)$/, "$1••••$2");

const hashCodigo = (email: string, codigo: string) =>
  createHash("sha256").update(`${email}:${codigo}`).digest("hex");

/** Gera um código de 6 dígitos (vale 15 minutos) e envia para o e-mail. */
export async function enviarCodigoVerificacao(
  db: any,
  params: { email: string; finalidade: FinalidadeVerificacao; userId?: string },
): Promise<void> {
  const email = normalizarEmail(params.email);
  // Um pedido novo substitui os códigos pendentes do mesmo e-mail e finalidade.
  let limpar = db
    .from("verificacoes_email")
    .delete()
    .eq("email", email)
    .eq("finalidade", params.finalidade)
    .is("usado_em", null);
  limpar = params.userId ? limpar.eq("user_id", params.userId) : limpar.is("user_id", null);
  await limpar;

  const codigo = String(randomInt(100000, 1000000));
  const { data: registro, error } = await db
    .from("verificacoes_email")
    .insert({
      email,
      finalidade: params.finalidade,
      user_id: params.userId ?? null,
      codigo_hash: hashCodigo(email, codigo),
    })
    .select("id")
    .single();
  if (error || !registro) throw new Error("Não foi possível gerar o código. Tente de novo.");

  const titulo =
    params.finalidade === "cadastro" ? "Confirme seu e-mail no Control ALL" : "Confirme seu novo e-mail no Control ALL";
  const { enviarEmail } = await import("@/lib/email.server");
  const enviado = await enviarEmail({
    to: email,
    subject: titulo,
    html: `<p>Seu código de confirmação é:</p><p style="font-size:28px;letter-spacing:6px"><strong>${codigo}</strong></p><p>Ele vale por 15 minutos e pode ser usado uma única vez. Se não foi você que pediu, ignore este e-mail.</p>`,
  });
  if (!enviado.ok) {
    await db.from("verificacoes_email").delete().eq("id", registro.id);
    throw new Error("Não foi possível enviar o código para este e-mail.");
  }
}

/**
 * Confere o código e o marca como usado (uso único). Cada tentativa é contada de forma
 * atômica, então tentativas em paralelo não passam do limite.
 */
export async function consumirCodigoVerificacao(
  db: any,
  params: { email: string; finalidade: FinalidadeVerificacao; codigo: string | null | undefined; userId?: string },
): Promise<void> {
  const email = normalizarEmail(params.email);
  const codigo = (params.codigo ?? "").replace(/\D/g, "");
  if (codigo.length !== 6) throw new Error("Informe o código de 6 dígitos enviado ao seu e-mail.");

  let busca = db
    .from("verificacoes_email")
    .select("id, codigo_hash, tentativas, expira_em")
    .eq("email", email)
    .eq("finalidade", params.finalidade)
    .is("usado_em", null);
  busca = params.userId ? busca.eq("user_id", params.userId) : busca.is("user_id", null);
  const { data: v } = await busca.order("criado_em", { ascending: false }).limit(1).maybeSingle();

  if (!v || new Date(v.expira_em).getTime() < Date.now()) {
    throw new Error("Código expirado ou não encontrado. Peça um novo código.");
  }
  if (v.tentativas >= MAX_TENTATIVAS) {
    throw new Error("Muitas tentativas com este código. Peça um novo código.");
  }
  const { data: reservado } = await db
    .from("verificacoes_email")
    .update({ tentativas: v.tentativas + 1 })
    .eq("id", v.id)
    .eq("tentativas", v.tentativas)
    .is("usado_em", null)
    .select("id");
  if (!reservado?.length) throw new Error("Tente de novo em instantes.");

  const recebido = Buffer.from(hashCodigo(email, codigo), "hex");
  const esperado = Buffer.from(String(v.codigo_hash), "hex");
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    throw new Error("Código incorreto.");
  }

  const { data: usado } = await db
    .from("verificacoes_email")
    .update({ usado_em: new Date().toISOString() })
    .eq("id", v.id)
    .is("usado_em", null)
    .select("id");
  if (!usado?.length) throw new Error("Este código já foi usado. Peça um novo código.");
}
