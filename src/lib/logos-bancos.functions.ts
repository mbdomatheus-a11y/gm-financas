import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { idBanco } from "@/lib/bancos-catalogo";

/** Administração de logos dos bancos (14/11/2026). Tela: aba "Bancos e logos" em Administração. */
async function admin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("site_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração do site.");
}

async function srv() {
  const [{ supabaseAdmin }, mod] = await Promise.all([import("@/integrations/supabase/client.server"), import("@/lib/logos-bancos.server")]);
  return { db: supabaseAdmin as any, mod };
}

export type LinhaLogoAdmin = {
  chave: string;
  nome: string;
  dominio: string | null;
  cor: string | null;
  apelidos: string[];
  personalizado: boolean;
  logo_path: string | null;
  origem: "automatico" | "admin" | null;
  atualizado_em: string | null;
};

export const adminListarLogosBancos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LinhaLogoAdmin[]> => {
    await admin(context);
    const { db, mod } = await srv();
    const { bancos, linhas } = await mod.listarBancosBase(db);
    return bancos
      .map((b) => {
        const l = linhas.get(b.chave);
        return {
          ...b,
          apelidos: l?.apelidos ?? [],
          personalizado: !!l?.personalizado,
          logo_path: l?.logo_path ?? null,
          origem: l?.origem ?? null,
          atualizado_em: l?.atualizado_em ?? null,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

export const adminPesquisarLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ dominio: z.string().min(3).max(120) }).parse(v))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { mod } = await srv();
    return mod.pesquisarOpcoes(data.dominio);
  });

/** Grava como admin: de uma URL (opção pesquisada ou colada) ou de um arquivo enviado (base64). */
export const adminUsarLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({ chave: z.string().min(1).max(80), url: z.string().url().max(2000).optional(), base64: z.string().max(300_000).optional() })
      .refine((o) => !!o.url !== !!o.base64, "Informe a URL ou o arquivo.")
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { db, mod } = await srv();
    const { bancos, linhas } = await mod.listarBancosBase(db);
    const banco = bancos.find((b) => b.chave === data.chave);
    if (!banco) throw new Error("Banco não encontrado.");
    const img = data.url ? await mod.baixarImagem(data.url) : mod.lerImagem(Buffer.from(data.base64!.replace(/^data:[^,]*,/, ""), "base64"));
    if (!img) throw new Error("Imagem inválida: use PNG, SVG ou WEBP de até 200 KB.");
    const caminho = await mod.gravarLogo(db, banco.chave, img, linhas.get(banco.chave)?.logo_path ?? null);
    const { error } = await db.from("logos_bancos").upsert(
      { chave: banco.chave, nome: banco.nome, dominio: banco.dominio, cor: banco.cor, logo_path: caminho, origem: "admin", atualizado_em: new Date().toISOString(), atualizado_por: context.userId },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    return { logo_path: caminho };
  });

export const adminVoltarLogoAutomatico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ chave: z.string().min(1).max(80) }).parse(v))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { db, mod } = await srv();
    await db.from("logos_bancos").update({ origem: "automatico", atualizado_por: context.userId }).eq("chave", data.chave);
    const { bancos, linhas } = await mod.listarBancosBase(db);
    const banco = bancos.find((b) => b.chave === data.chave);
    const melhor = banco?.dominio ? (await mod.pesquisarOpcoes(banco.dominio))[0] : undefined;
    const img = melhor ? mod.lerImagem(Buffer.from(melhor.dataUrl.split(",")[1] ?? "", "base64")) : null;
    const caminho = img ? await mod.gravarLogo(db, data.chave, img, linhas.get(data.chave)?.logo_path ?? null) : null;
    await db
      .from("logos_bancos")
      .update({ logo_path: caminho, origem: "automatico", atualizado_em: new Date().toISOString(), atualizado_por: context.userId })
      .eq("chave", data.chave);
    return { logo_path: caminho };
  });

export const adminAdicionarBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(80),
        dominio: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Domínio inválido (ex.: banco.com.br)"),
        apelidos: z.array(z.string().trim().min(1).max(60)).max(20),
        cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor no formato #RRGGBB"),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { db, mod } = await srv();
    const chave = idBanco(data.nome);
    if (!chave) throw new Error("Nome inválido.");
    const { bancos } = await mod.listarBancosBase(db);
    if (bancos.some((b) => b.chave === chave)) throw new Error("Esse banco já está no catálogo.");
    const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const apelidos = [...new Set([semAcento(data.nome), ...data.apelidos.map(semAcento)].filter(Boolean))];
    const { error } = await db.from("logos_bancos").insert({
      chave,
      nome: data.nome,
      dominio: data.dominio.replace(/^www\./, ""),
      cor: data.cor.toUpperCase(),
      apelidos,
      personalizado: true,
      origem: "automatico",
      atualizado_em: new Date(0).toISOString(), // entra na próxima atualização
      atualizado_por: context.userId,
    });
    if (error) throw new Error(error.message);
    // Já busca o logo do domínio novo (se falhar, a atualização diária tenta de novo).
    try {
      const melhor = (await mod.pesquisarOpcoes(data.dominio))[0];
      const img = melhor ? mod.lerImagem(Buffer.from(melhor.dataUrl.split(",")[1] ?? "", "base64")) : null;
      if (img) {
        const caminho = await mod.gravarLogo(db, chave, img, null);
        await db.from("logos_bancos").update({ logo_path: caminho, atualizado_em: new Date().toISOString() }).eq("chave", chave);
      }
    } catch {
      /* fica para a próxima atualização */
    }
    return { chave };
  });

/** "Atualizar todos agora": a tela chama em sequência passando `depoisDe` até `restantes` zerar. */
export const adminAtualizarLogosAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ depoisDe: z.string().max(80).optional() }).parse(v))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { db, mod } = await srv();
    return mod.atualizarLogosAutomaticos(db, { forcar: true, depoisDe: data.depoisDe, orcamentoMs: 20_000 });
  });
