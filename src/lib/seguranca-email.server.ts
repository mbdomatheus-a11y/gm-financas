// E-mails de segurança da conta (2026-10-24): logo do Control ALL, aparelho, data e local de quem
// pediu, e link "Não fui eu" para bloquear a conta. Só usar em código de servidor.
import { getRequest } from "@tanstack/react-start/server";
import { createHash, randomBytes } from "node:crypto";

export type ContextoRequisicao = {
  aparelho: string;
  dataHora: string;
  local: string;
  ip: string;
};

function urlBase(): string {
  return (process.env["SITE_URL"] || "https://www.controlall.com.br").replace(/\/+$/, "");
}

function escapar(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function sistema(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Aparelho não identificado";
}

function navegador(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/CriOS|Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/CFNetwork|Expo|okhttp/i.test(ua)) return "app Control ALL";
  return "navegador não identificado";
}

function cabecalho(nome: string): string {
  const v = getRequest()?.headers.get(nome) ?? "";
  try {
    return decodeURIComponent(v).trim();
  } catch {
    return v.trim();
  }
}

/** Aparelho, data e hora (Brasília) e local aproximado pela rede (cabeçalhos da Vercel). */
export function contextoDaRequisicao(): ContextoRequisicao {
  const ua = cabecalho("user-agent");
  const cidade = cabecalho("x-vercel-ip-city");
  const estado = cabecalho("x-vercel-ip-country-region");
  const pais = cabecalho("x-vercel-ip-country");
  const ipBruto = (cabecalho("x-forwarded-for").split(",")[0] ?? "").trim();
  // IP parcialmente oculto no e-mail: suficiente para reconhecer, sem expor o endereço inteiro.
  const ip = ipBruto.includes(".") ? ipBruto.replace(/\.\d+\.\d+$/, ".x.x") : ipBruto ? ipBruto.split(":").slice(0, 3).join(":") + ":…" : "";
  const local = [cidade, estado, pais].filter(Boolean).join(", ") || "local não identificado";
  const dataHora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "long",
    timeStyle: "short",
  });
  return { aparelho: `${sistema(ua)} · ${navegador(ua)}`, dataHora: `${dataHora} (horário de Brasília)`, local, ip };
}

/** Bloco com os dados de quem fez o pedido, para o usuário reconhecer (ou não). */
export function blocoDoPedido(c: ContextoRequisicao): string {
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px">${rotulo}</td><td style="padding:4px 0;font-size:13px;color:#111827"><strong>${escapar(valor)}</strong></td></tr>`;
  return `<table role="presentation" style="border-collapse:collapse;margin:16px 0;background:#f3f6f9;border-radius:10px;padding:8px 14px;display:block">
${linha("Aparelho", c.aparelho)}
${linha("Data e hora", c.dataHora)}
${linha("Local aproximado", c.local)}
${c.ip ? linha("Rede (IP)", c.ip) : ""}
</table>`;
}

/** Moldura padrão dos e-mails de segurança, com a logo do Control ALL. */
export function layoutEmailSeguranca(titulo: string, corpo: string): string {
  const base = urlBase();
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
  <div style="text-align:center;padding:24px 0 8px">
    <img src="${base}/icons/icon-192.png" width="64" height="64" alt="Control ALL" style="border-radius:14px" />
    <div style="font-size:18px;font-weight:800;margin-top:8px">Control ALL</div>
  </div>
  <h1 style="font-size:20px;margin:16px 0 8px">${escapar(titulo)}</h1>
  ${corpo}
  <p style="color:#9ca3af;font-size:11px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px">
    Este é um aviso automático de segurança do Control ALL. Nunca pedimos sua senha por e-mail.
  </p>
</div>`;
}

/** Cria o link "Não fui eu, bloquear minha conta" (vale 24 horas, uso único). */
export async function criarLinkBloqueio(db: any, userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.from("bloqueio_conta_tokens").insert({
    user_id: userId,
    token_hash: createHash("sha256").update(token).digest("hex"),
    expira_em: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
  });
  return `${urlBase()}/bloquear-conta?token=${token}`;
}

export function botaoEmail(href: string, texto: string, cor = "#0079BF"): string {
  return `<p style="margin:20px 0"><a href="${href}" style="background:${cor};color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;display:inline-block">${escapar(texto)}</a></p>`;
}
