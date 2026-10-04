/**
 * Etapa E (plano-importacao-v2.md): import de planilha Excel/CSV genérica,
 * de qualquer banco — mesma abordagem de auto-detecção de colunas já usada
 * no importador de De-para (`achar`/`lerCsv` de `depara.ts`), em vez de um
 * layout fixo. Reaproveita também os parsers já testados de valor
 * monetário (`lerValorMonetario`) e parcela (`extrairParcelaSegura`) de
 * `importacao-modelo.ts`, para não duplicar lógica que já existe e já foi
 * validada.
 */
import { readSheet } from "read-excel-file/browser";

import { achar, lerCsv } from "@/lib/depara";
import { extrairParcelaSegura, lerValorMonetario } from "@/lib/importacao-modelo";

const COL_DATA = [
  "data",
  "data da compra",
  "data compra",
  "data lancamento",
  "data lançamento",
  "data transacao",
  "data transação",
  "dt",
  "date",
];
const COL_DESCRICAO = [
  "descricao",
  "descrição",
  "estabelecimento",
  "historico",
  "histórico",
  "lancamento",
  "lançamento",
  "nome",
];
const COL_VALOR = ["valor", "valor (r$)", "valor r$", "montante", "amount", "total"];
const COL_PARCELA = ["parcela", "parc", "parcelas", "installment"];

export type LinhaPlanilha = {
  /** `yyyy-mm-dd`, ou `null` quando a coluna de data não foi identificada
   * ou a célula não pôde ser interpretada. */
  data: string | null;
  descricao: string;
  /** Sempre positivo — o sinal vira `direcao`. */
  valor: number;
  direcao: "debito" | "credito";
  parcela_numero: number;
  parcela_total: number;
};

export type ColunasDetectadasPlanilha = {
  data: string | null;
  descricao: string | null;
  valor: string | null;
  parcela: string | null;
};

export type ResultadoPlanilha = {
  linhas: LinhaPlanilha[];
  colunas: ColunasDetectadasPlanilha;
};

/** Aceita `Date` (célula de data nativa do Excel) ou texto em `dd/mm/aaaa`,
 * `dd-mm-aaaa` ou `aaaa-mm-dd` (com ano de 2 ou 4 dígitos). */
function normalizarData(valor: unknown): string | null {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }
  const texto = String(valor ?? "").trim();
  if (!texto) return null;

  let m = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;

  m = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (m) {
    const ano = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${ano}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }

  return null;
}

/** Lê o arquivo (.xlsx ou .csv) e devolve as linhas já interpretadas,
 * prontas para virar `LancamentoExtraido` na tela de importação. Linhas
 * sem descrição ou sem um valor monetário reconhecível são ignoradas
 * silenciosamente (célula vazia, linha de subtotal, etc.). */
export async function lerPlanilhaImportacao(file: File): Promise<ResultadoPlanilha> {
  if (file.size > 5 * 1024 * 1024) throw new Error("A planilha deve ter no máximo 5 MB.");
  const nome = file.name.toLowerCase();
  let matriz: unknown[][];
  if (nome.endsWith(".xlsx")) {
    matriz = await readSheet(file);
  } else if (nome.endsWith(".csv")) {
    matriz = lerCsv(await file.text());
  } else {
    throw new Error(
      "Use um arquivo .xlsx ou .csv. Para .xls, exporte como .xlsx antes de importar.",
    );
  }
  if (matriz.length > 10001) throw new Error("A planilha pode ter no máximo 10 mil linhas.");

  const vazio: ResultadoPlanilha = {
    linhas: [],
    colunas: { data: null, descricao: null, valor: null, parcela: null },
  };
  if (matriz.length < 2) return vazio;

  const colunas = (matriz[0] ?? []).map((v) => String(v ?? "").trim());
  const cData = achar(colunas, COL_DATA);
  const cDesc = achar(colunas, COL_DESCRICAO) ?? colunas[0] ?? null;
  const cValor = achar(colunas, COL_VALOR);
  const cParcela = achar(colunas, COL_PARCELA);
  const colunasDetectadas: ColunasDetectadasPlanilha = {
    data: cData,
    descricao: cDesc,
    valor: cValor,
    parcela: cParcela,
  };
  if (!cDesc || !cValor) return { linhas: [], colunas: colunasDetectadas };

  const idxData = cData ? colunas.indexOf(cData) : -1;
  const idxDesc = colunas.indexOf(cDesc);
  const idxValor = colunas.indexOf(cValor);
  const idxParcela = cParcela ? colunas.indexOf(cParcela) : -1;

  const linhas: LinhaPlanilha[] = [];
  for (const linha of matriz.slice(1)) {
    const descricao = String(linha[idxDesc] ?? "").trim();
    const valorBruto = linha[idxValor];
    if (!descricao || valorBruto == null || String(valorBruto).trim() === "") continue;
    const lido = lerValorMonetario(String(valorBruto));
    if (!lido) continue;

    const valor = lido.centavosAbsolutos / 100;
    // Convenção matemática (sinal à frente): negativo/parênteses = crédito
    // (pagamento, estorno); positivo = débito (compra normal). Mesma regra
    // já usada como padrão no restante da importação para emissores sem
    // notação contábil própria — ver Etapa A.1 do plano.
    const direcao: "debito" | "credito" = lido.sinalOriginal === "positivo" ? "debito" : "credito";
    const data = idxData >= 0 ? normalizarData(linha[idxData]) : null;

    let parcela_numero = 1;
    let parcela_total = 1;
    if (idxParcela >= 0) {
      const brutaParcela = String(linha[idxParcela] ?? "").trim();
      if (brutaParcela) {
        const extraida = extrairParcelaSegura(brutaParcela);
        if (extraida) {
          parcela_numero = extraida.atual;
          parcela_total = extraida.total;
        } else {
          const n = Number(brutaParcela.replace(",", "."));
          if (Number.isFinite(n) && n >= 1) parcela_total = Math.round(n);
        }
      }
    }

    linhas.push({ data, descricao, valor, direcao, parcela_numero, parcela_total });
  }

  return { linhas, colunas: colunasDetectadas };
}

/** Modelo em CSV para o usuário preencher, no mesmo espírito do modelo do
 * de-para (`modeloCsv` em `depara.ts`). */
export function modeloCsvPlanilha(): string {
  return [
    "data,descricao,valor,parcela",
    "2026-10-01,Supermercado ABC,345.90,",
    "2026-10-03,Loja XYZ,120.00,2/3",
    "2026-10-05,Pagamento recebido,-80.00,",
  ].join("\n");
}
