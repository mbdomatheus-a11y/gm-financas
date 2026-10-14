/**
 * Tradução de toda a interface (2026-10-13).
 *
 * O build troca cada texto de tela por __t("texto em português") (ver scripts/i18n/transform.ts).
 * Aqui __t devolve o texto no idioma escolhido, usando um dicionário por idioma
 * (src/lib/i18n/dicionarios/<idioma>.json, chave = texto em português).
 *
 * O dicionário do idioma fica guardado no navegador. Na primeira vez em outro idioma ele é
 * baixado e a página recarrega uma vez; daí em diante a tradução já vale desde a abertura,
 * inclusive para textos definidos fora dos componentes. No servidor fica tudo em português.
 * O que o usuário digita (descrições, nomes, valores) nunca passa por aqui.
 */
import { createElement, Fragment, type ReactNode } from "react";

import { IDIOMA_PADRAO, idiomaDoNavegador, idiomaValido, type Idioma } from "./idiomas";

declare const __APP_VERSION__: string;

export const CHAVE_IDIOMA = "control-all.idioma";
// Cada deploy tem sua versão do dicionário; a versão anterior continua valendo até a nova
// ser baixada em segundo plano (sem recarregar a página).
const VERSAO = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
const prefixo = (idioma: string) => `control-all.i18n.${idioma}.`;

type Dicionario = Record<string, string>;

const carregadores: Record<string, () => Promise<{ default: Dicionario }>> = {
  en: () => import("./dicionarios/en.json"),
  es: () => import("./dicionarios/es.json"),
  hi: () => import("./dicionarios/hi.json"),
  fr: () => import("./dicionarios/fr.json"),
  de: () => import("./dicionarios/de.json"),
  it: () => import("./dicionarios/it.json"),
  zh: () => import("./dicionarios/zh.json"),
  ar: () => import("./dicionarios/ar.json"),
};

function lerIdiomaSalvo(): Idioma | null {
  try {
    return idiomaValido(localStorage.getItem(CHAVE_IDIOMA));
  } catch {
    return null;
  }
}

let cacheDesatualizado = false;

function lerCache(idioma: Idioma): Dicionario | null {
  try {
    const exato = localStorage.getItem(prefixo(idioma) + VERSAO);
    if (exato) return JSON.parse(exato) as Dicionario;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefixo(idioma))) {
        cacheDesatualizado = true;
        return JSON.parse(localStorage.getItem(k) ?? "{}") as Dicionario;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const noNavegador = typeof window !== "undefined";
const idiomaInicial: Idioma = noNavegador ? (lerIdiomaSalvo() ?? idiomaDoNavegador()) : IDIOMA_PADRAO;
let dicionario: Dicionario | null = idiomaInicial === IDIOMA_PADRAO ? null : lerCache(idiomaInicial);

/** Idioma em que a interface foi montada nesta abertura da página. */
export function idiomaDaInterface(): Idioma {
  return dicionario ? idiomaInicial : IDIOMA_PADRAO;
}

function preencher(modelo: string, args?: unknown[]): string {
  if (!args?.length) return modelo;
  return modelo.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < args.length ? String(args[Number(i)] ?? "") : m));
}

/** Texto de interface no idioma ativo (chave = texto em português). */
export function __t(texto: string, args?: unknown[]): string {
  const traduzido = dicionario?.[texto];
  return preencher(traduzido || texto, args);
}

/**
 * Frase com valores no meio (ex.: "{0} parcela{1}"): devolve os pedaços já traduzidos
 * intercalados com os valores originais, que podem ser números, textos ou elementos.
 */
export function __tj(modelo: string, args: ReactNode[]): ReactNode {
  const texto = dicionario?.[modelo] || modelo;
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(/\{(\d+)\}/g)) {
    const pos = m.index ?? 0;
    if (pos > ultimo) partes.push(texto.slice(ultimo, pos));
    const i = Number(m[1]);
    partes.push(i < args.length ? args[i] : m[0]);
    ultimo = pos + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return createElement(Fragment, null, ...partes);
}

const LOCALE_DATAS: Record<string, string> = {
  "pt-BR": "pt-BR", en: "en-GB", es: "es-ES", hi: "hi-IN", fr: "fr-FR",
  de: "de-DE", it: "it-IT", zh: "zh-CN", ar: "ar-u-nu-latn",
};

/** Locale das datas (nomes de mês e dia) no idioma da interface. Moeda segue em pt-BR. */
export function __locale(): string {
  return LOCALE_DATAS[idiomaDaInterface()] ?? "pt-BR";
}

/** Baixa e guarda o dicionário de um idioma. Devolve false se não deu para guardar. */
export async function prepararIdioma(idioma: Idioma): Promise<boolean> {
  if (idioma === IDIOMA_PADRAO) return true;
  const carregar = carregadores[idioma];
  if (!carregar) return false;
  const modulo = await carregar();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefixo(idioma))) localStorage.removeItem(k);
    }
    localStorage.setItem(prefixo(idioma) + VERSAO, JSON.stringify(modulo.default));
    return true;
  } catch {
    return false;
  }
}

/**
 * Garante que a interface está no idioma pedido; se não estiver, prepara o dicionário e
 * recarrega a página uma vez (protegido contra recarregar em laço).
 */
export async function aplicarIdioma(idioma: Idioma): Promise<void> {
  if (!noNavegador) return;
  if (idioma === idiomaDaInterface()) return;
  try {
    const marca = `control-all.i18n.recarga.${idioma}`;
    if (sessionStorage.getItem(marca)) return;
    const ok = await prepararIdioma(idioma);
    localStorage.setItem(CHAVE_IDIOMA, idioma);
    if (!ok && idioma !== IDIOMA_PADRAO) return;
    if (localStorage.getItem(CHAVE_IDIOMA) !== idioma) return;
    sessionStorage.setItem(marca, "1");
    window.location.reload();
  } catch {
    /* sem armazenamento: segue em português */
  }
}

/** Limpa a proteção de recarga quando o idioma já está aplicado e atualiza o dicionário antigo. */
if (noNavegador) {
  try {
    sessionStorage.removeItem(`control-all.i18n.recarga.${idiomaDaInterface()}`);
  } catch {
    /* ignora */
  }
  if (cacheDesatualizado) void prepararIdioma(idiomaInicial).catch(() => undefined);
}
