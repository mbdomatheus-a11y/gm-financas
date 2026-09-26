import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { verificarTurnstileToken } from "@/lib/turnstile.functions";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";

/**
 * Item 6 do backlog do proprietário: ferramenta pública (sem login), no
 * mesmo espírito das calculadoras — texto aberto, gera um link único que
 * expira depois de um número limitado de aberturas (1 a 3) ou em 7 dias,
 * o que vier primeiro. Se o remetente escolher senha, a criptografia é
 * feita NO NAVEGADOR (ver links-temporarios-crypto.ts): o servidor nunca
 * vê a senha nem o texto original quando há senha — só guarda o texto
 * cifrado, o salt e o IV. Sem senha, o texto fica em claro no banco
 * (mesmo modelo de "cofre temporário" de ferramentas como o Privnote),
 * mas com as mesmas regras de expiração e apagamento definitivo.
 *
 * Auditoria: cada criação/abertura gera uma linha em
 * `links_temporarios_auditoria` (evento, hash do IP, data) — nunca o
 * conteúdo da mensagem. Ao esgotar as aberturas ou expirar, a linha em
 * `links_temporarios` é DELETADA (não só marcada) — o conteúdo não fica
 * recuperável depois disso.
 */

const CONTEUDO_MAX = 20_000; // acomoda texto cifrado em base64 (expansão ~1.4x de até 10.000 caracteres) + tag do AES-GCM
const CRIACOES_POR_HORA_POR_IP = 20;

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

function ipDaRequisicao(): string {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "desconhecido";
}

export const criarLinkTemporario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        conteudo: z.string().min(1).max(CONTEUDO_MAX),
        criptografado: z.boolean(),
        salt: z.string().max(200).optional(),
        iv: z.string().max(200).optional(),
        aberturasMax: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        turnstileToken: z.string().optional(),
      })
      .refine((v) => !v.criptografado || (v.salt && v.iv), {
        message: "Faltam dados de criptografia.",
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (TURNSTILE_ATIVO) {
      const ok = await verificarTurnstileToken(data.turnstileToken ?? "");
      if (!ok) throw new Error("Verificação de segurança falhou. Recarregue e tente de novo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const ipHash = hashIp(ipDaRequisicao());

    const umaHoraAtras = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count: criacoesRecentes } = await db
      .from("links_temporarios_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("evento", "criado")
      .eq("ip_hash", ipHash)
      .gte("criado_em", umaHoraAtras);
    if ((criacoesRecentes ?? 0) >= CRIACOES_POR_HORA_POR_IP) {
      throw new Error("Muitos links criados recentemente. Tente novamente mais tarde.");
    }

    const { data: link, error } = await db
      .from("links_temporarios")
      .insert({
        conteudo: data.conteudo,
        criptografado: data.criptografado,
        salt: data.salt ?? null,
        iv: data.iv ?? null,
        aberturas_max: data.aberturasMax,
        criador_ip_hash: ipHash,
      })
      .select("id,expira_em")
      .single();
    if (error) throw new Error("Não foi possível gerar o link.");

    await db
      .from("links_temporarios_auditoria")
      .insert({ link_id: link.id, evento: "criado", ip_hash: ipHash });

    return { id: link.id as string, expiraEm: link.expira_em as string };
  });

export const abrirLinkTemporario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const ipHash = hashIp(ipDaRequisicao());

    const { data: link, error } = await db
      .from("links_temporarios")
      .select("id,conteudo,criptografado,salt,iv,aberturas_max,aberturas_usadas,expira_em")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Não foi possível abrir o link.");
    if (!link) {
      return { status: "nao_encontrado" as const };
    }

    if (new Date(link.expira_em).getTime() < Date.now()) {
      await db.from("links_temporarios").delete().eq("id", link.id);
      await db
        .from("links_temporarios_auditoria")
        .insert({ link_id: link.id, evento: "expirado_por_tempo", ip_hash: ipHash });
      return { status: "expirado" as const };
    }

    if (link.aberturas_usadas >= link.aberturas_max) {
      // Não deveria sobrar linha nesse estado (é deletada abaixo assim que
      // esgota), mas cobre o caso de corrida entre duas aberturas simultâneas.
      await db.from("links_temporarios").delete().eq("id", link.id);
      await db
        .from("links_temporarios_auditoria")
        .insert({ link_id: link.id, evento: "esgotado", ip_hash: ipHash });
      return { status: "esgotado" as const };
    }

    const novasAberturas = link.aberturas_usadas + 1;
    const esgotouAgora = novasAberturas >= link.aberturas_max;

    // Nota de segurança: cada abertura desta página consome uma das
    // aberturas permitidas, MESMO que a senha digitada esteja errada — o
    // servidor nunca sabe se a senha estava correta (a decodificação é só
    // no navegador). Avise a pessoa a senha certa antes dela abrir o link.
    if (esgotouAgora) {
      await db.from("links_temporarios").delete().eq("id", link.id);
    } else {
      await db
        .from("links_temporarios")
        .update({ aberturas_usadas: novasAberturas })
        .eq("id", link.id);
    }
    await db
      .from("links_temporarios_auditoria")
      .insert({ link_id: link.id, evento: "aberto", ip_hash: ipHash });

    return {
      status: "ok" as const,
      conteudo: link.conteudo as string,
      criptografado: link.criptografado as boolean,
      salt: link.salt as string | null,
      iv: link.iv as string | null,
      aberturasRestantes: Math.max(0, link.aberturas_max - novasAberturas),
    };
  });
