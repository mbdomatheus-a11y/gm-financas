import type { ReactNode } from "react";

/**
 * Formatação básica segura (sem HTML): **negrito**, *itálico*, [texto](https://link),
 * "# título", "- item de lista" e parágrafos separados por linha em branco.
 * Tudo vira elementos React; nenhum HTML do texto é interpretado.
 */

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;

function inline(texto: string, chave: string): ReactNode[] {
  return texto.split(INLINE).map((parte, i) => {
    const k = `${chave}-${i}`;
    if (/^\*\*[^*\n]+\*\*$/.test(parte)) return <strong key={k}>{parte.slice(2, -2)}</strong>;
    if (/^\*[^*\n]+\*$/.test(parte)) return <em key={k}>{parte.slice(1, -1)}</em>;
    const m = /^\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)$/.exec(parte);
    if (m) {
      return (
        <a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline">
          {m[1]}
        </a>
      );
    }
    return <span key={k}>{parte}</span>;
  });
}

export function TextoFormatado({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let paragrafo: string[] = [];
  let lista: string[] = [];
  const fechaParagrafo = () => {
    if (paragrafo.length) {
      const i = blocos.length;
      blocos.push(
        <p key={`p${i}`} className="leading-7">
          {paragrafo.flatMap((l, j) => [...inline(l, `p${i}-${j}`), j < paragrafo.length - 1 ? <br key={`br${i}-${j}`} /> : null])}
        </p>,
      );
      paragrafo = [];
    }
  };
  const fechaLista = () => {
    if (lista.length) {
      const i = blocos.length;
      blocos.push(
        <ul key={`u${i}`} className="list-disc space-y-1 pl-6">
          {lista.map((l, j) => (
            <li key={j}>{inline(l, `u${i}-${j}`)}</li>
          ))}
        </ul>,
      );
      lista = [];
    }
  };
  for (const linha of linhas) {
    if (!linha.trim()) {
      fechaParagrafo();
      fechaLista();
    } else if (/^# /.test(linha)) {
      fechaParagrafo();
      fechaLista();
      const i = blocos.length;
      blocos.push(
        <h2 key={`h${i}`} className="text-xl font-bold">
          {inline(linha.slice(2), `h${i}`)}
        </h2>,
      );
    } else if (/^- /.test(linha)) {
      fechaParagrafo();
      lista.push(linha.slice(2));
    } else {
      fechaLista();
      paragrafo.push(linha);
    }
  }
  fechaParagrafo();
  fechaLista();
  return <div className="space-y-3 break-words text-sm">{blocos}</div>;
}
