export type ResultadoDuplicidade = {
  duplicata: boolean;
  motivo: string | null;
};

function extrairPalavrasChave(texto: string): string[] {
  const ignorar = new Set([
    "de",
    "do",
    "da",
    "dos",
    "das",
    "e",
    "em",
    "para",
    "com",
    "no",
    "na",
    "saopaulo",
    "sp",
    "br",
    "bra",
    "compra",
    "parcela",
    "parc",
    "pagamento",
  ]);
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !ignorar.has(p));
}

export function verificarPossivelDuplicata(
  item: { id?: string; descricao: string; valor: number },
  outrosItens: Array<{ id?: string; descricao: string; valor_total?: number; valor?: number }>,
): ResultadoDuplicidade {
  if (!item.descricao || !item.valor) return { duplicata: false, motivo: null };
  const palItem = extrairPalavrasChave(item.descricao);
  if (!palItem.length) return { duplicata: false, motivo: null };

  for (const ex of outrosItens) {
    if (ex === item || (ex.id && item.id && ex.id === item.id)) continue;
    const valEx = Number(ex.valor_total ?? ex.valor ?? 0);
    if (!valEx) continue;

    const difValor = Math.abs(item.valor - valEx);
    if (difValor < 0.01) {
      const palEx = extrairPalavrasChave(ex.descricao ?? "");
      const intersecao = palItem.filter((p) => palEx.includes(p));

      if (intersecao.length > 0) {
        return {
          duplicata: true,
          motivo: `Valor igual (${formatarBrlSimples(item.valor)}) e termo em comum: "${intersecao[0]}"`,
        };
      }
    }
  }

  return { duplicata: false, motivo: null };
}

function formatarBrlSimples(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
