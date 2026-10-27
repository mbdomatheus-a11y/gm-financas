// Extrai textos de interface (JSX e strings literais) dos .tsx do site.
const ts = require(process.cwd() + "/node_modules/typescript");
const fs = require("fs"), path = require("path");
const raiz = process.cwd();
const arquivos = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!/node_modules|integrations|__tests__/.test(p)) walk(p); }
    else if (/\.tsx$/.test(n) && !/\.test\./.test(n) && !/routeTree\.gen/.test(n)) arquivos.push(p);
  }
})(path.join(raiz, "src"));

const ATTR_OK = new Set(["placeholder","title","aria-label","alt","label","description","tooltip","emptyMessage","vazio","texto","titulo","subtitulo","hint","rotulo","mensagem","descricao","nome","acao","ajuda","dica"]);
const CALL_OK = /^(toast(\.\w+)?|alert|confirm|window\.confirm|setErro|setMensagem|Error)$/;
const textos = new Map(); // texto -> {arquivos:Set}
function pareceUI(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 400) return null;
  if (!/[A-Za-zÀ-ú]/.test(t)) return null;
  if (/^(https?:|\/|#|@|\.|data:|mailto:)/.test(t)) return null;
  if (/^[a-z0-9_\-:.\[\]\/%#()&>,*+=!]+$/.test(t) && !/[A-Z ]/.test(t)) return null; // chaves, ids
  if (/^[a-z0-9:\-\[\]\/._%!]+( [a-z0-9:\-\[\]\/._%!@()]+)+$/.test(t) && /[-:]/.test(t)) return null; // classes tailwind
  if (/^[a-z_]+(,[a-z_*]+)+/.test(t)) return null; // listas de colunas
  if (/^[A-Z_]+$/.test(t)) return null;
  if (!/[ áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(t) && !/^[A-ZÁÉÍÓÚ][a-záéíóúãõç]+$/.test(t)) return null;
  return t;
}
function add(t, arq) { const v = pareceUI(t); if (!v) return; if (!textos.has(v)) textos.set(v, new Set()); textos.get(v).add(path.relative(raiz, arq)); }
function templ(n) { // template literal -> "texto {0} texto"
  let s = n.head.text; n.templateSpans.forEach((sp, i) => { s += `{${i}}` + sp.literal.text; }); return s;
}
for (const arq of arquivos) {
  const src = ts.createSourceFile(arq, fs.readFileSync(arq, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function emContextoUI(n) {
    const p = n.parent;
    if (!p) return false;
    if (ts.isJsxAttribute(p)) return ATTR_OK.has(p.name.getText(src));
    if (ts.isJsxExpression(p)) { const pp = p.parent; if (ts.isJsxAttribute(pp)) return ATTR_OK.has(pp.name.getText(src)); return true; }
    if (ts.isPropertyAssignment(p)) return ATTR_OK.has(p.name.getText(src)) || /^(label|titulo|title|description|descricao|texto|hint|rotulo|nome|mensagem|placeholder|ajuda|subtitulo|vazio|dica|resumo|detalhe|categoria)$/.test(p.name.getText(src));
    if (ts.isCallExpression(p)) return CALL_OK.test(p.expression.getText(src));
    if (ts.isNewExpression(p)) return /Error/.test(p.expression.getText(src));
    if (ts.isConditionalExpression(p) || ts.isBinaryExpression(p) || ts.isParenthesizedExpression(p) || ts.isArrayLiteralExpression(p) || ts.isReturnStatement(p)) return emContextoUI(p);
    return false;
  }
  (function visit(n) {
    if (ts.isJsxText(n)) add(n.text, arq);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && emContextoUI(n)) add(n.text, arq);
    else if (ts.isTemplateExpression(n) && emContextoUI(n)) add(templ(n), arq);
    ts.forEachChild(n, visit);
  })(src);
}
const lista = [...textos.keys()].sort();
fs.writeFileSync(path.join(raiz, "scripts/i18n/textos-pt.json"), JSON.stringify(lista, null, 1));
console.log("arquivos", arquivos.length, "textos", lista.length, "chars", lista.join("").length);
