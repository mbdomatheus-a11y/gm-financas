import { chaveEstabelecimento } from "./categorizacao";

export type FixaCandidata = {
  id: string;
  descricao: string;
  valor_total: number;
  tipo: string;
  direcao: string;
  cartao_id: string | null;
  cartao_final: string | null;
  banco_id: string | null;
  recorrencia_inicio: string | null;
  recorrencia_meses: number | null;
  data_primeira_parcela: string;
  total_parcelas: number;
};

export type LancamentoCandidato = {
  descricao: string;
  valor: number;
  direcao: string;
  data_compra: string;
  parcela_total: number;
  cartao_final: string | null;
  cartao_id: string | null;
  banco_id: string | null;
  competencia: string | null;
};

export type CorrespondenciaFixa = {
  fixa: FixaCandidata;
  titulo: "Possível correspondência";
  motivos: string[];
};

function mes(data: string | null | undefined): string | null {
  return data && /^\d{4}-\d{2}/.test(data) ? data.slice(0, 7) : null;
}

function adicionarMeses(competencia: string, quantidade: number): string {
  const [ano, mesNumero] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mesNumero! - 1 + quantidade, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function encontrarCorrespondenciaFixa(
  despesas: FixaCandidata[],
  lancamento: LancamentoCandidato,
): CorrespondenciaFixa | null {
  if (lancamento.parcela_total > 1 || lancamento.direcao !== "debito") return null;
  const competencia = mes(lancamento.competencia) ?? mes(lancamento.data_compra);
  if (!competencia) return null;
  const descricao = chaveEstabelecimento(lancamento.descricao);
  if (!descricao) return null;

  for (const fixa of despesas) {
    if (fixa.tipo !== "fixa" || fixa.direcao !== lancamento.direcao || fixa.total_parcelas > 1) continue;
    if (chaveEstabelecimento(fixa.descricao) !== descricao) continue;

    const inicio = mes(fixa.recorrencia_inicio) ?? mes(fixa.data_primeira_parcela);
    if (!inicio || competencia < inicio) continue;
    if (fixa.recorrencia_meses && competencia >= adicionarMeses(inicio, fixa.recorrencia_meses)) continue;

    const mesmoCartao = !!lancamento.cartao_id && fixa.cartao_id === lancamento.cartao_id;
    const mesmoFinal = !!lancamento.cartao_final && fixa.cartao_final === lancamento.cartao_final;
    const mesmoBanco = !!lancamento.banco_id && fixa.banco_id === lancamento.banco_id;
    if (!mesmoCartao && !mesmoFinal && !mesmoBanco) continue;

    const diferenca = Math.abs(Number(fixa.valor_total) - lancamento.valor);
    const tolerancia = Math.max(0.01, lancamento.valor * 0.02);
    if (diferenca > tolerancia) continue;

    return {
      fixa,
      titulo: "Possível correspondência",
      motivos: [
        "descrição igual",
        diferenca <= 0.01 ? "valor igual" : "valor próximo (até 2%)",
        "mesmo cartão ou conta",
        `competência ${competencia}`,
      ],
    };
  }
  return null;
}
