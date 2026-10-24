import { Fragment, type ReactNode } from "react";
import type { Bloco, DocumentoLegal } from "@/lib/textos-legais";

/** Mostra e-mails como link e destaca trechos pendentes ([A PREENCHER: ...] e [DECIDIR: ...]). */
function TextoRico({ texto }: { texto: string }) {
  const partes = texto.split(/(\[(?:A PREENCHER|DECIDIR)[^\]]*\]|[\w.+-]+@[\w-]+\.[\w.]+[a-z])/gi);
  return (
    <>
      {partes.map((p, i) => {
        if (!p) return null;
        if (/^\[(A PREENCHER|DECIDIR)/i.test(p))
          return (
            <mark key={i} className="rounded bg-amber-200 px-1 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100">
              {p}
            </mark>
          );
        if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(p))
          return (
            <a key={i} className="underline" href={`mailto:${p}`}>
              {p}
            </a>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function BlocoView({ bloco }: { bloco: Bloco }): ReactNode {
  if (typeof bloco === "string") return <p><TextoRico texto={bloco} /></p>;
  if ("sub" in bloco) return <h3 className="pt-1 font-semibold">{bloco.sub}</h3>;
  if ("lista" in bloco)
    return (
      <ul className="list-disc space-y-1 pl-5">
        {bloco.lista.map((item) => (
          <li key={item}><TextoRico texto={item} /></li>
        ))}
      </ul>
    );
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-left text-xs leading-5">
        <thead className="bg-muted/60">
          <tr>
            {bloco.tabela.cabecalho.map((c) => (
              <th key={c} className="px-3 py-2 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloco.tabela.linhas.map((linha, i) => (
            <tr key={i} className="border-t align-top">
              {linha.map((cel, j) => (
                <td key={j} className="px-3 py-2"><TextoRico texto={cel} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Documento legal completo (Termos, Privacidade ou Cookies) a partir de src/lib/textos-legais.ts. */
export function DocumentoLegalView({ doc, depois }: { doc: DocumentoLegal; depois?: ReactNode }) {
  return (
    <div className="space-y-7 text-sm leading-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{doc.titulo}</h1>
        <p className="text-muted-foreground">Control ALL, versão {doc.versao}. Vale para o site e para o app.</p>
        <p><TextoRico texto={doc.resumo} /></p>
      </div>
      <nav aria-label="Índice" className="rounded-lg border bg-muted/30 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nesta página</p>
        <ol className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
          {doc.secoes.map((s, i) => (
            <li key={s.titulo}>
              <a className="text-xs hover:underline" href={`#${doc.id}-${i + 1}`}>{s.titulo}</a>
            </li>
          ))}
        </ol>
      </nav>
      {doc.secoes.map((s, i) => (
        <section key={s.titulo} id={`${doc.id}-${i + 1}`} className="scroll-mt-24 space-y-2">
          <h2 className="text-base font-semibold">{s.titulo}</h2>
          {s.blocos.map((b, j) => (
            <BlocoView key={j} bloco={b} />
          ))}
        </section>
      ))}
      {depois}
    </div>
  );
}
