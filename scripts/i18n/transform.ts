/**
 * Tradução automática da interface (2026-10-13).
 *
 * Usado em dois lugares, com a MESMA regra:
 * - no build (plugin do Vite em vite.config.ts): troca cada texto de interface por __t("texto");
 * - no extrator (scripts/i18n/extrair.ts): lista os textos para gerar os dicionários.
 *
 * Só entra texto de interface: texto entre tags, atributos de exibição (placeholder, title,
 * aria-label, alt, label...), mensagens de toast/confirm/Error e rótulos de objetos (label,
 * titulo, hint...). Ficam de fora: comparações (=== "Pago"), listas, valores gravados no
 * banco, classes CSS e tudo que o usuário digita.
 */
import ts from "typescript";

const ATTR_OK = new Set([
  "placeholder", "title", "aria-label", "alt", "label", "description", "tooltip", "emptyMessage",
  "vazio", "titulo", "subtitulo", "hint", "rotulo", "ajuda", "dica", "aria-description",
]);
const PROP_OK = /^(label|titulo|title|description|hint|rotulo|placeholder|ajuda|subtitulo|vazio|dica|tooltip|emptyMessage|mensagemVazia)$/;
const CALL_OK = /^(toast(\.\w+)?|alert|confirm|window\.confirm|window\.alert)$/;

export type Edicao = { inicio: number; fim: number; novo: string; chave: string };

/** Mesma regra do JSX (Babel) para espaços em texto entre tags. */
export function limparTextoJsx(bruto: string): string {
  const linhas = bruto.split(/\r\n|\n|\r/);
  let ultimaComTexto = 0;
  linhas.forEach((l, i) => {
    if (/[^ \t]/.test(l)) ultimaComTexto = i;
  });
  let out = "";
  linhas.forEach((linha, i) => {
    const primeira = i === 0;
    const ultima = i === linhas.length - 1;
    const ehUltimaComTexto = i === ultimaComTexto;
    let t = linha.replace(/\t/g, " ");
    if (!primeira) t = t.replace(/^[ ]+/, "");
    if (!ultima) t = t.replace(/[ ]+$/, "");
    if (t) {
      if (!ehUltimaComTexto) t += " ";
      out += t;
    }
  });
  return out;
}

export function chaveDe(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function pareceUI(s: string): boolean {
  const t = chaveDe(s);
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-zÀ-ú]/.test(t)) return false;
  if (/^(https?:|\/|#|@|\.|data:|mailto:|tel:)/.test(t)) return false;
  if (/&[a-z#0-9]+;/i.test(t)) return false; // entidades HTML no JSX (ex.: &nbsp;)
  if (/must be used within|^use[A-Z]/.test(t)) return false; // erros de desenvolvimento
  if (/^[a-z0-9_\-:.[\]/%#()&>,*+=!]+$/.test(t)) return false; // ids, chaves, classes
  if (/^[A-Z0-9_]+$/.test(t)) return false; // constantes
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false; // camelCase
  return true;
}

function emContextoUI(n: ts.Node, src: ts.SourceFile): boolean {
  const p = n.parent;
  if (!p) return false;
  if (ts.isJsxAttribute(p)) return ATTR_OK.has(p.name.getText(src));
  if (ts.isJsxExpression(p)) {
    const pp = p.parent;
    if (ts.isJsxAttribute(pp)) return ATTR_OK.has(pp.name.getText(src));
    return ts.isJsxElement(pp) || ts.isJsxFragment(pp);
  }
  if (ts.isPropertyAssignment(p)) return p.initializer === n && PROP_OK.test(p.name.getText(src));
  if (ts.isCallExpression(p)) return p.arguments[0] === n && CALL_OK.test(p.expression.getText(src));
  if (ts.isNewExpression(p)) return /^Error$/.test(p.expression.getText(src)) && p.arguments?.[0] === n;
  if (ts.isConditionalExpression(p)) return p.condition !== n && emContextoUI(p, src);
  if (ts.isParenthesizedExpression(p)) return emContextoUI(p, src);
  if (ts.isBinaryExpression(p)) {
    const op = p.operatorToken.kind;
    const ok =
      op === ts.SyntaxKind.PlusToken ||
      op === ts.SyntaxKind.QuestionQuestionToken ||
      op === ts.SyntaxKind.BarBarToken ||
      (op === ts.SyntaxKind.AmpersandAmpersandToken && p.right === n);
    return ok && emContextoUI(p, src);
  }
  return false;
}

/** Encontra os textos de interface de um arquivo .tsx e as trocas por __t(). */
export function encontrarTextos(codigo: string, arquivo: string): Edicao[] {
  const src = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edicoes: Edicao[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isJsxText(n)) {
      const limpo = limparTextoJsx(n.text);
      if (limpo && pareceUI(limpo)) {
        const chave = chaveDe(limpo);
        const antes = limpo.match(/^\s*/)?.[0] ?? "";
        const depois = limpo.match(/\s*$/)?.[0] ?? "";
        const partes: string[] = [];
        if (antes) partes.push(`{${JSON.stringify(antes)}}`);
        partes.push(`{__t(${JSON.stringify(chave)})}`);
        if (depois) partes.push(`{${JSON.stringify(depois)}}`);
        edicoes.push({ inicio: n.pos, fim: n.end, novo: partes.join(""), chave });
      }
      return;
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && emContextoUI(n, src) && pareceUI(n.text)) {
      const chave = chaveDe(n.text);
      const ehAtributo = ts.isJsxAttribute(n.parent);
      const chamada = `__t(${JSON.stringify(chave)})`;
      edicoes.push({ inicio: n.getStart(src), fim: n.end, novo: ehAtributo ? `{${chamada}}` : chamada, chave });
      return;
    }
    if (ts.isTemplateExpression(n) && emContextoUI(n, src)) {
      let modelo = n.head.text;
      const args: string[] = [];
      n.templateSpans.forEach((sp, i) => {
        modelo += `{${i}}` + sp.literal.text;
        args.push(sp.expression.getText(src));
      });
      if (pareceUI(modelo.replace(/\{\d+\}/g, " "))) {
        const chave = chaveDe(modelo);
        edicoes.push({
          inicio: n.getStart(src),
          fim: n.end,
          novo: `__t(${JSON.stringify(chave)}, [${args.join(", ")}])`,
          chave,
        });
        return;
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(src);
  return edicoes;
}

/** Aplica as trocas e garante o import do __t. */
export function transformarCodigo(codigo: string, arquivo: string): { codigo: string; total: number } | null {
  const edicoes = encontrarTextos(codigo, arquivo);
  if (!edicoes.length) return null;
  let out = codigo;
  for (const e of [...edicoes].sort((a, b) => b.inicio - a.inicio)) {
    out = out.slice(0, e.inicio) + e.novo + out.slice(e.fim);
  }
  out = `import { __t } from "@/lib/i18n/runtime";\n` + out;
  return { codigo: out, total: edicoes.length };
}
