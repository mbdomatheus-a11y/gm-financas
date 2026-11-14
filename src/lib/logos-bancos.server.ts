import { createHash } from "node:crypto";

import { BANCOS_CATALOGO, idBanco } from "@/lib/bancos-catalogo";

/**
 * Busca e grava logos de bancos (14/11/2026). Fontes públicas do próprio domínio: ícones declarados no HTML,
 * apple-touch-icon, favicon (só PNG dentro do .ico) e o Google s2 em 128 px. Grava no bucket "logos-bancos"
 * e na tabela logos_bancos. Nunca sobrescreve origem 'admin'.
 */
export const BUCKET = "logos-bancos";
export const LIMITE_BYTES = 200 * 1024;
const VALIDADE_MS = 6 * 24 * 3600_000;
const UA = "Mozilla/5.0 (compatible; ControlALL-logos/1.0)";

export type Imagem = { bytes: Buffer; tipo: "image/png" | "image/svg+xml" | "image/webp"; largura: number; altura: number };
export type OpcaoLogo = { url: string; fonte: string; tipo: string; largura: number; altura: number; bytes: number; dataUrl: string };
export type BancoBase = { chave: string; nome: string; dominio: string | null; cor: string | null };

const EXT: Record<Imagem["tipo"], string> = { "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp" };

/** Reconhece a imagem pelos bytes (não confia no content-type). Do .ico tira o maior PNG embutido. */
export function lerImagem(buf: Buffer): Imagem | null {
  if (!buf.length || buf.length > LIMITE_BYTES) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (buf.length < 24) return null;
    return { bytes: buf, tipo: "image/png", largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
  }
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP" && buf.length >= 30) {
    const fmt = buf.toString("ascii", 12, 16);
    let w = 0;
    let h = 0;
    if (fmt === "VP8X") {
      w = 1 + buf.readUIntLE(24, 3);
      h = 1 + buf.readUIntLE(27, 3);
    } else if (fmt === "VP8 ") {
      w = buf.readUInt16LE(26) & 0x3fff;
      h = buf.readUInt16LE(28) & 0x3fff;
    } else if (fmt === "VP8L") {
      const b = buf.readUInt32LE(21);
      w = (b & 0x3fff) + 1;
      h = ((b >> 14) & 0x3fff) + 1;
    }
    return { bytes: buf, tipo: "image/webp", largura: w, altura: h };
  }
  if (buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) {
    const n = buf.readUInt16LE(4);
    let melhor: Imagem | null = null;
    for (let i = 0; i < n && 6 + i * 16 + 16 <= buf.length; i++) {
      const o = 6 + i * 16;
      const tam = buf.readUInt32LE(o + 8);
      const ini = buf.readUInt32LE(o + 12);
      if (ini + tam > buf.length) continue;
      const png = buf.subarray(ini, ini + tam);
      const img = png[0] === 0x89 ? lerImagem(Buffer.from(png)) : null;
      if (img && (!melhor || img.largura > melhor.largura)) melhor = img;
    }
    return melhor;
  }
  const texto = buf.toString("utf8", 0, Math.min(buf.length, 2048)).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(texto)) {
    const svg = buf.toString("utf8");
    if (/<script|\bon[a-z]+\s*=|javascript:/i.test(svg)) return null; // SVG com script não entra no bucket público
    return { bytes: buf, tipo: "image/svg+xml", largura: 512, altura: 512 };
  }
  return null;
}

async function baixar(url: string, limite = LIMITE_BYTES, ms = 6000): Promise<Buffer | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(u.hostname) || !u.hostname.includes(".")) return null;
    const r = await fetch(u, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    if (!r.ok || !r.body) return null;
    const partes: Uint8Array[] = [];
    let total = 0;
    const leitor = r.body.getReader();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.length;
      if (total > limite) {
        await leitor.cancel().catch(() => {});
        return null;
      }
      partes.push(value);
    }
    return Buffer.concat(partes);
  } catch {
    return null;
  }
}

export async function baixarImagem(url: string): Promise<Imagem | null> {
  const b = await baixar(url);
  return b ? lerImagem(b) : null;
}

/** Ícones declarados no <head> da página inicial (link rel icon / apple-touch-icon / mask-icon). */
async function iconesDoHtml(base: string): Promise<{ url: string; fonte: string }[]> {
  const b = await baixar(base, 600 * 1024, 7000);
  if (!b) return [];
  const html = b.toString("utf8");
  const out: { url: string; fonte: string }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (!/icon/.test(rel)) continue;
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!href || href.startsWith("data:")) continue;
    try {
      out.push({ url: new URL(href.replace(/&amp;/g, "&"), base).toString(), fonte: rel.includes("apple") ? "apple-touch-icon (página)" : "ícone da página" });
    } catch {
      /* href inválido */
    }
  }
  return out;
}

/** Todas as opções encontradas online para o domínio, da melhor para a pior. */
export async function pesquisarOpcoes(dominio: string): Promise<OpcaoLogo[]> {
  const d = dominio.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!d) return [];
  const bases = d.startsWith("www.") ? [`https://${d}/`] : [`https://${d}/`, `https://www.${d}/`];
  const fixos = bases.flatMap((b) => [
    { url: `${b}apple-touch-icon.png`, fonte: "apple-touch-icon" },
    { url: `${b}apple-touch-icon-precomposed.png`, fonte: "apple-touch-icon" },
    { url: `${b}favicon.svg`, fonte: "favicon.svg" },
    { url: `${b}favicon.png`, fonte: "favicon.png" },
    { url: `${b}favicon.ico`, fonte: "favicon.ico" },
  ]);
  const doHtml = (await Promise.all(bases.map(iconesDoHtml))).flat();
  const candidatos = [...doHtml, ...fixos, { url: `https://www.google.com/s2/favicons?domain=${d}&sz=128`, fonte: "Google s2 (128 px)" }];
  const vistos = new Set<string>();
  const unicos = candidatos.filter((c) => (vistos.has(c.url) ? false : (vistos.add(c.url), true))).slice(0, 16);
  const imgs = await Promise.all(unicos.map(async (c) => ({ c, img: await baixarImagem(c.url) })));
  const hashes = new Set<string>();
  const opcoes: (OpcaoLogo & { nota: number })[] = [];
  for (const { c, img } of imgs) {
    if (!img || img.largura < 16) continue;
    const h = createHash("sha256").update(img.bytes).digest("hex");
    if (hashes.has(h)) continue;
    hashes.add(h);
    const lado = Math.min(img.largura, img.altura);
    const quadrado = img.largura === img.altura ? 1 : 0.6;
    opcoes.push({
      url: c.url,
      fonte: c.fonte,
      tipo: img.tipo,
      largura: img.largura,
      altura: img.altura,
      bytes: img.bytes.length,
      dataUrl: `data:${img.tipo};base64,${img.bytes.toString("base64")}`,
      nota: (img.tipo === "image/svg+xml" ? 300 : Math.min(lado, 512)) * quadrado,
    });
  }
  return opcoes.sort((a, b) => b.nota - a.nota).map(({ nota: _n, ...o }) => o);
}

/** Grava a imagem no bucket (nome pelo hash: mesmo arquivo, mesmo caminho) e apaga o arquivo antigo. */
export async function gravarLogo(db: any, chave: string, img: Imagem, antigo: string | null): Promise<string> {
  const hash = createHash("sha256").update(img.bytes).digest("hex").slice(0, 16);
  const caminho = `${chave}/${hash}.${EXT[img.tipo]}`;
  if (caminho === antigo) return caminho;
  const { error } = await db.storage.from(BUCKET).upload(caminho, img.bytes, { contentType: img.tipo, upsert: true, cacheControl: "604800" });
  if (error) throw new Error(`Falha ao gravar o logo: ${error.message}`);
  if (antigo) await db.storage.from(BUCKET).remove([antigo]).catch(() => {});
  return caminho;
}

/** Catálogo completo: o do código mais os bancos adicionados pelo admin. */
export async function listarBancosBase(db: any): Promise<{ bancos: BancoBase[]; linhas: Map<string, any> }> {
  const { data } = await db.from("logos_bancos").select("*");
  const linhas = new Map<string, any>(((data ?? []) as any[]).map((l) => [l.chave, l]));
  const bancos: BancoBase[] = BANCOS_CATALOGO.map((b) => ({ chave: idBanco(b.nome), nome: b.nome, dominio: b.dominio, cor: b.cor }));
  const doCodigo = new Set(bancos.map((b) => b.chave));
  for (const l of linhas.values()) {
    if (!doCodigo.has(l.chave)) bancos.push({ chave: l.chave, nome: l.nome, dominio: l.dominio, cor: l.cor });
  }
  return { bancos, linhas };
}

/**
 * Renova os logos automáticos. Sem `forcar`, só os que têm mais de 6 dias. Para quando passa do tempo e
 * devolve quantos faltam (o botão "Atualizar todos agora" chama de novo até zerar).
 */
export async function atualizarLogosAutomaticos(db: any, opcoes: { forcar?: boolean; depoisDe?: string | undefined; orcamentoMs?: number } = {}) {
  const inicio = Date.now();
  const orcamento = opcoes.orcamentoMs ?? 40_000;
  const { bancos, linhas } = await listarBancosBase(db);
  const fila = bancos
    .filter((b) => linhas.get(b.chave)?.origem !== "admin")
    .filter((b) => opcoes.forcar || !linhas.get(b.chave)?.logo_path || Date.now() - new Date(linhas.get(b.chave).atualizado_em).getTime() > VALIDADE_MS)
    .sort((a, b) => a.chave.localeCompare(b.chave))
    .filter((b) => !opcoes.depoisDe || b.chave > opcoes.depoisDe);
  let atualizados = 0;
  let falhas = 0;
  let ultimo: string | null = null;
  const LOTE = 4;
  for (let i = 0; i < fila.length; i += LOTE) {
    if (Date.now() - inicio > orcamento) break;
    await Promise.all(
      fila.slice(i, i + LOTE).map(async (b) => {
        const linha = linhas.get(b.chave);
        let caminho: string | null = linha?.logo_path ?? null;
        try {
          const melhor = b.dominio ? (await pesquisarOpcoes(b.dominio))[0] : undefined;
          const img = melhor ? lerImagem(Buffer.from(melhor.dataUrl.split(",")[1] ?? "", "base64")) : null;
          if (img) {
            caminho = await gravarLogo(db, b.chave, img, caminho);
            atualizados++;
          } else falhas++;
        } catch {
          falhas++;
        }
        // Não sobrescreve se o admin escolheu um logo enquanto isso rodava.
        const { data: agora } = await db.from("logos_bancos").select("origem").eq("chave", b.chave).maybeSingle();
        if (agora?.origem === "admin") return;
        await db.from("logos_bancos").upsert(
          { chave: b.chave, nome: b.nome, dominio: b.dominio, cor: b.cor, logo_path: caminho, origem: "automatico", atualizado_em: new Date().toISOString() },
          { onConflict: "chave" },
        );
      }),
    );
    ultimo = fila[Math.min(i + LOTE, fila.length) - 1]?.chave ?? ultimo;
  }
  const restantes = ultimo ? fila.filter((b) => b.chave > ultimo!).length : fila.length;
  return { atualizados, falhas, restantes, ultimo };
}
