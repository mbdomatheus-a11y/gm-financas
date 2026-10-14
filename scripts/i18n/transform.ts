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
  "vazio", "titulo", "subtitulo", "hint", "rotulo", "ajuda", "dica", "aria-description", "display",
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
  if (ts.isPropertyAssignment(p)) {
    if (p.initializer !== n) return false;
    const nome = p.name.getText(src);
    if (PROP_OK.test(nome)) return true;
    // "descricao" só quando é texto de cartão (tem "titulo" ao lado); em lançamentos é dado gravado.
    return nome === "descricao" && ts.isObjectLiteralExpression(p.parent) &&
      p.parent.properties.some((q) => q.name?.getText(src) === "titulo");
  }
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

/**
 * Arquivos que passam pela tradução: todo .tsx de src e os .ts de src que guardam textos de
 * tela (ex.: src/lib/areas.ts com títulos e descrições dos cartões da Início). Ficam de fora
 * os .ts que rodam só no servidor (*.functions.ts, *.server.ts), o próprio i18n e testes.
 */
export function arquivoTraduzivel(caminho: string): boolean {
  const a = caminho.replace(/\\/g, "/");
  if (!a.includes("/src/")) return false;
  if (/routeTree\.gen|\.test\.|\.spec\.|\/integrations\/|\/lib\/i18n\/|\.d\.ts$|\/src\/server(\/|\.ts$)/.test(a)) return false;
  if (a.endsWith(".tsx")) return true;
  return a.endsWith(".ts") && !/\.(functions|server)\.ts$/.test(a);
}

/** Encontra os textos de interface de um arquivo .tsx/.ts e as trocas por __t(). */
export function encontrarTextos(
  codigo: string,
  arquivo: string,
  raizBusca?: ts.Node,
  srcPronto?: ts.SourceFile,
): Edicao[] {
  const tipo = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const src = srcPronto ?? ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, tipo);
  const edicoes: Edicao[] = [];
  const visitar = (n: ts.Node) => {
    // Datas no idioma da interface: toLocaleDateString("pt-BR") vira toLocaleDateString(__locale()).
    // Números e moeda continuam em pt-BR (os valores são em reais).
    if (ts.isCallExpression(n) && ehFormatoDeData(n, src)) {
      const a = n.arguments[0]!;
      edicoes.push({ inicio: a.getStart(src), fim: a.end, novo: "__locale()", chave: "" });
    }
    // Texto misturado com valores no mesmo elemento (ex.: <Badge>{n} parcela{s}</Badge>,
    // +{valor}/mês): vira uma frase só com marcadores, __tj("{0} parcela{1}", [n, s]),
    // para a tradução ter o contexto inteiro e poder mudar a ordem das partes.
    if ((ts.isJsxElement(n) || ts.isJsxFragment(n)) && textoMisturado(n, src)) {
      const filhos = n.children.filter((c) => !(ts.isJsxExpression(c) && !c.expression));
      let modelo = "";
      const args: string[] = [];
      for (const c of filhos) {
        if (ts.isJsxText(c)) modelo += limparTextoJsx(c.text);
        else if (ts.isJsxExpression(c) && c.expression) {
          const interno = encontrarEm(c.expression, codigo, arquivo, src);
          modelo += `{${args.length}}`;
          args.push(aplicar(c.expression.getText(src), c.expression.getStart(src), interno));
        }
      }
      const antes = modelo.match(/^\s*/)?.[0] ?? "";
      const depois = modelo.match(/\s*$/)?.[0] ?? "";
      const chave = chaveDe(modelo);
      const tag = ts.isJsxElement(n) ? n.openingElement.tagName.getText(src) : "";
      const funcao = /^(option|title|textarea)$/.test(tag) ? "__t" : "__tj";
      const partes: string[] = [];
      if (antes) partes.push(`{${JSON.stringify(antes)}}`);
      partes.push(`{${funcao}(${JSON.stringify(chave)}, [${args.join(", ")}])}`);
      if (depois) partes.push(`{${JSON.stringify(depois)}}`);
      const primeiro = n.children[0]!;
      const ultimo = n.children[n.children.length - 1]!;
      edicoes.push({ inicio: primeiro.pos, fim: ultimo.end, novo: partes.join(""), chave });
      return;
    }
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
  visitar(raizBusca ?? src);
  return edicoes;
}

/** Textos de interface dentro de um trecho (usado nos valores de uma frase misturada). */
function encontrarEm(no: ts.Node, codigo: string, arquivo: string, src: ts.SourceFile): Edicao[] {
  return encontrarTextos(codigo, arquivo, no, src);
}

/** Aplica trocas (posições absolutas no arquivo) a um trecho que começa em `base`. */
function aplicar(texto: string, base: number, edicoes: Edicao[]): string {
  let out = texto;
  for (const e of [...edicoes].sort((a, b) => b.inicio - a.inicio)) {
    out = out.slice(0, e.inicio - base) + e.novo + out.slice(e.fim - base);
  }
  return out;
}

function ehFormatoDeData(n: ts.CallExpression, src: ts.SourceFile): boolean {
  const a = n.arguments[0];
  if (!a || !ts.isStringLiteral(a) || a.text !== "pt-BR") return false;
  if (!ts.isPropertyAccessExpression(n.expression)) return false;
  const nome = n.expression.name.getText(src);
  if (nome === "toLocaleDateString" || nome === "toLocaleTimeString") return true;
  if (nome !== "toLocaleString") return false;
  let alvo: ts.Expression = n.expression.expression;
  while (ts.isParenthesizedExpression(alvo)) alvo = alvo.expression;
  return ts.isNewExpression(alvo) && alvo.expression.getText(src) === "Date";
}

/** Elemento só com texto e valores ({...}), sem outras tags dentro, e com palavra para traduzir. */
function textoMisturado(n: ts.JsxElement | ts.JsxFragment, src: ts.SourceFile): boolean {
  let temValor = false;
  let texto = "";
  for (const c of n.children) {
    if (ts.isJsxText(c)) texto += " " + limparTextoJsx(c.text);
    else if (ts.isJsxExpression(c)) {
      if (c.expression) temValor = true;
    } else return false;
  }
  if (!temValor) return false;
  const t = chaveDe(texto);
  if (!/[A-Za-zÀ-ú]{2,}/.test(t)) return false;
  if (/&[a-z#0-9]+;/i.test(t) || /must be used within/.test(t)) return false;
  void src;
  return true;
}

/** Aplica as trocas e garante o import do __t. */
export function transformarCodigo(codigo: string, arquivo: string): { codigo: string; total: number } | null {
  const edicoes = encontrarTextos(codigo, arquivo);
  if (!edicoes.length) return null;
  let out = codigo;
  for (const e of [...edicoes].sort((a, b) => b.inicio - a.inicio)) {
    out = out.slice(0, e.inicio) + e.novo + out.slice(e.fim);
  }
  out = `import { __t, __tj, __locale } from "@/lib/i18n/runtime";\n` + out;
  return { codigo: out, total: edicoes.length };
}
