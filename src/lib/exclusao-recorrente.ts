import { competenciaDe, mesesEntreCompetencias, somarMeses } from "@/lib/recorrencia";

/**
 * Exclusão de lançamento fixo (receita ou despesa recorrente).
 *  - "so_competencia": remove só o mês escolhido. Meses anteriores ficam como estão;
 *    a série continua a partir do mês seguinte, em nova linha, se ainda houver meses futuros.
 *  - "futuras": remove o mês escolhido e todos os seguintes. Meses anteriores ficam como estão.
 */
export type ModoExclusao = "so_competencia" | "futuras";

type Serie = {
  recorrencia_inicio: string;
  recorrencia_sem_prazo: boolean;
  recorrencia_meses: number | null;
};

export type PlanoCorte = {
  apagarOriginal: boolean;
  atualizarOriginal: Serie | null;
  novaSerie: Serie | null;
  /** Competência (AAAA-MM) a partir da qual as parcelas passam para a nova série. */
  inicioNovaSerie: string | null;
};

/** AAAA-MM-DD no mês `competencia` com o dia de `dataBase` (limitado ao último dia do mês). */
export function mesmoDiaNoMes(dataBase: string, competencia: string): string {
  const dia = Number(String(dataBase).slice(8, 10)) || 1;
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano!, mes!, 0)).getUTCDate();
  return `${competencia}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

export function planejarCorte(entrada: {
  inicio: string;
  semPrazo: boolean;
  meses: number | null;
  competencia: string;
  modo: ModoExclusao;
}): PlanoCorte {
  const inicioComp = competenciaDe(entrada.inicio);
  const x = competenciaDe(entrada.competencia);
  if (x < inicioComp) throw new Error("Este mês é anterior ao início do lançamento fixo. Nada foi alterado.");
  const fimComp = entrada.semPrazo || !entrada.meses ? null : somarMeses(inicioComp, entrada.meses - 1);
  if (fimComp && x > fimComp) throw new Error("Este mês já está fora do período do lançamento fixo. Nada foi alterado.");

  const proxima = somarMeses(x, 1);
  const temFuturo = entrada.modo === "so_competencia" && (fimComp === null || proxima <= fimComp);
  // 25/10/2026: a nova série mantém o dia do mês da original (salário dia 15 continua dia 15).
  const novaSerie: Serie | null = temFuturo
    ? {
        recorrencia_inicio: mesmoDiaNoMes(entrada.inicio, proxima),
        recorrencia_sem_prazo: fimComp === null,
        recorrencia_meses: fimComp === null ? null : mesesEntreCompetencias(proxima, fimComp) + 1,
      }
    : null;
  const inicioNovaSerie = temFuturo ? proxima : null;

  if (x === inicioComp) {
    return { apagarOriginal: true, atualizarOriginal: null, novaSerie, inicioNovaSerie };
  }
  // O original passa a terminar no mês anterior ao excluído.
  return {
    apagarOriginal: false,
    atualizarOriginal: {
      recorrencia_inicio: `${inicioComp}-01`,
      recorrencia_sem_prazo: false,
      recorrencia_meses: mesesEntreCompetencias(inicioComp, x),
    },
    novaSerie,
    inicioNovaSerie,
  };
}

/** Receita fixa: corta a série no banco. `linha` é a linha completa de `receitas`. */
export async function excluirReceitaSerie(db: any, linha: any, competencia: string, modo: ModoExclusao): Promise<void> {
  const inicio = linha.recorrencia_inicio ?? linha.data_recebimento;
  const plano = planejarCorte({
    inicio,
    semPrazo: linha.recorrencia_sem_prazo !== false && !linha.recorrencia_meses,
    meses: linha.recorrencia_meses ?? null,
    competencia,
    modo,
  });

  if (plano.novaSerie) {
    const { id: _i, created_at: _c, updated_at: _u, ...resto } = linha;
    const { error } = await db.from("receitas").insert({
      ...resto,
      origem: "manual",
      pluggy_transaction_id: null,
      importada_em: null,
      congelada: false,
      possivel_duplicidade: false,
      data_recebimento: plano.novaSerie.recorrencia_inicio,
      ...plano.novaSerie,
    });
    if (error) throw error;
  }

  if (plano.apagarOriginal) {
    const { data, error } = await db.from("receitas").delete().eq("id", linha.id).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Não foi possível excluir esta receita. Verifique suas permissões.");
  } else if (plano.atualizarOriginal) {
    const { data, error } = await db.from("receitas").update(plano.atualizarOriginal).eq("id", linha.id).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Não foi possível alterar esta receita. Verifique suas permissões.");
  }
}

/**
 * Despesa fixa: corta a série e cuida das parcelas. Parcelas do mês excluído (e, em "futuras",
 * de todos os meses seguintes) saem do original; em "so_competencia" as seguintes vão para a nova série.
 */
export async function excluirDespesaSerie(db: any, despesaId: string, competencia: string, modo: ModoExclusao): Promise<void> {
  const { data: linha, error: erroLinha } = await db.from("despesas").select("*").eq("id", despesaId).single();
  if (erroLinha || !linha) throw new Error("Não foi possível localizar esta despesa.");

  const inicio = linha.recorrencia_inicio ?? linha.data_primeira_parcela ?? linha.data_compra;
  const plano = planejarCorte({
    inicio,
    semPrazo: linha.recorrencia_sem_prazo !== false && !linha.recorrencia_meses,
    meses: linha.recorrencia_meses ?? null,
    competencia,
    modo,
  });
  const x = competenciaDe(competencia);
  const inicioMesX = `${x}-01`;
  const inicioMesSeguinte = `${somarMeses(x, 1)}-01`;

  if (plano.novaSerie) {
    const { id: _i, created_at: _c, updated_at: _u, parcelas: _p, ...resto } = linha;
    const { data: nova, error } = await db
      .from("despesas")
      .insert({
        ...resto,
        origem: "manual",
        pluggy_transaction_id: null,
        pluggy_grupo: null,
        importada_em: null,
        congelada: false,
        possivel_duplicidade: false,
        data_primeira_parcela: plano.novaSerie.recorrencia_inicio,
        ...plano.novaSerie,
      })
      .select("id")
      .single();
    if (error || !nova) throw new Error("Não foi possível criar a nova série desta despesa.");
    const { error: e2 } = await db
      .from("parcelas")
      .update({ despesa_id: nova.id })
      .eq("despesa_id", despesaId)
      .gte("vencimento", inicioMesSeguinte);
    if (e2) throw new Error("Não foi possível mover as parcelas futuras.");
  }

  // Parcelas do mês excluído (no caso "futuras", de todos os meses a partir dele) saem do original.
  let apagarParcelas = db.from("parcelas").delete().eq("despesa_id", despesaId).gte("vencimento", inicioMesX);
  if (modo === "so_competencia") apagarParcelas = apagarParcelas.lt("vencimento", inicioMesSeguinte);
  const { error: e3 } = await apagarParcelas;
  if (e3) throw new Error("Não foi possível remover as parcelas deste mês.");

  if (plano.apagarOriginal) {
    const { data, error } = await db.from("despesas").delete().eq("id", despesaId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Não foi possível excluir esta despesa. Verifique suas permissões.");
  } else if (plano.atualizarOriginal) {
    const { data, error } = await db.from("despesas").update(plano.atualizarOriginal).eq("id", despesaId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Não foi possível alterar esta despesa. Verifique suas permissões.");
  }
}
