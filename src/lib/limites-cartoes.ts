// Limite dos cartões para a tela Limites (14/11/2026). Mesma regra no site e no app.
// Origem do dado, nesta ordem: Open Finance (conta de crédito da Pluggy) > fatura importada mais recente > cadastro do cartão.

export type OrigemLimite = "open_finance" | "fatura" | "cadastro";

export type LimiteCartao = {
  key: string;
  banco: string;
  nome: string;
  total: number;
  consumido: number;
  disponivel: number;
  origem: OrigemLimite;
  /** "Open Finance", "Fatura importada em dd/mm" ou "Cadastro". */
  origemRotulo: string;
};

export type LimitesConsolidado = { total: number; consumido: number; disponivel: number; percentual: number };

type Conv = (valor: number, moeda: string) => number;

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

function dataCurta(iso: string | null | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : "";
}

/** Parcelas em aberto (não pagas) de um cartão, em R$. */
function emAberto(despesas: any[], cartaoId: string, conv: Conv): number {
  let s = 0;
  for (const d of despesas) {
    if (d.cartao_id !== cartaoId || d.direcao === "entrada" || d.direcao === "receita") continue;
    for (const p of d.parcelas ?? []) if (!p.paga) s += conv(Number(p.valor) || 0, p.moeda ?? d.moeda ?? "BRL");
  }
  return s;
}

export function calcularLimitesCartoes(args: {
  cartoes: any[];
  faturas: any[];
  contasPluggy: any[];
  despesas: any[];
  conv: Conv;
}): { itens: LimiteCartao[]; consolidado: LimitesConsolidado } {
  const { cartoes, faturas, despesas, conv } = args;
  const credito = (args.contasPluggy ?? []).filter((c) => String(c.tipo ?? "").toUpperCase() === "CREDIT" && c.limite != null);
  const itens: LimiteCartao[] = [];
  const pluggyUsadas = new Set<string>();
  const bancosCobertos = new Set<string>();

  const nomeBancoDe = (c: any) => String(c.bancos?.nome ?? c.banco_nome ?? c.apelido ?? "");
  const faturaComLimite = (f: any) => f.limite_total != null || f.limite_utilizado != null || f.limite_disponivel != null;
  const maisRecente = (lista: any[]) =>
    [...lista].sort((a, b) => String(b.competencia ?? "").localeCompare(String(a.competencia ?? "")) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];

  for (const c of cartoes) {
    const nome = `${c.apelido || c.bandeira || "Cartão"}${c.final ? ` •${c.final}` : ""}`;
    const banco = nomeBancoDe(c);
    const pl = credito.find((p) => c.final && String(p.cartao_final ?? "") === String(c.final) && !pluggyUsadas.has(p.id));
    let item: LimiteCartao | null = null;
    if (pl) {
      pluggyUsadas.add(pl.id);
      const total = Number(pl.limite) || 0;
      const disp = pl.limite_disponivel != null ? Number(pl.limite_disponivel) : null;
      const consumido = disp != null ? Math.max(0, total - disp) : emAberto(despesas, c.id, conv);
      item = { key: `c:${c.id}`, banco, nome, total, consumido, disponivel: Math.max(0, total - consumido), origem: "open_finance", origemRotulo: "Open Finance" };
    } else {
      const f = maisRecente(faturas.filter((x) => x.cartao_id === c.id && faturaComLimite(x)));
      if (f && (f.limite_total != null || (f.limite_utilizado != null && f.limite_disponivel != null))) {
        const disp = f.limite_disponivel != null ? Number(f.limite_disponivel) : null;
        const total = f.limite_total != null ? Number(f.limite_total) : Number(f.limite_utilizado) + (disp ?? 0);
        const consumido = f.limite_utilizado != null ? Number(f.limite_utilizado) : disp != null ? total - disp : emAberto(despesas, c.id, conv);
        const quando = dataCurta(f.created_at ?? f.updated_at ?? f.competencia);
        item = {
          key: `c:${c.id}`, banco, nome, total, consumido: Math.max(0, consumido), disponivel: Math.max(0, total - Math.max(0, consumido)),
          origem: "fatura", origemRotulo: quando ? `Fatura importada em ${quando}` : "Fatura importada",
        };
      } else if (c.limite != null && Number(c.limite) > 0) {
        const total = Number(c.limite);
        const consumido = emAberto(despesas, c.id, conv);
        item = { key: `c:${c.id}`, banco, nome, total, consumido, disponivel: Math.max(0, total - consumido), origem: "cadastro", origemRotulo: "Cadastro" };
      }
    }
    if (item) {
      itens.push(item);
      bancosCobertos.add(norm(banco));
    }
  }

  // Cartões do Open Finance que não existem no cadastro.
  for (const p of credito) {
    if (pluggyUsadas.has(p.id)) continue;
    const total = Number(p.limite) || 0;
    const disp = p.limite_disponivel != null ? Number(p.limite_disponivel) : null;
    const consumido = disp != null ? Math.max(0, total - disp) : 0;
    const banco = String(p.banco_nome ?? p.nome ?? "");
    itens.push({
      key: `p:${p.id}`, banco, nome: `${p.nome ?? "Cartão"}${p.cartao_final ? ` •${p.cartao_final}` : ""}`, total, consumido,
      disponivel: Math.max(0, total - consumido), origem: "open_finance", origemRotulo: "Open Finance",
    });
    bancosCobertos.add(norm(banco));
  }

  // Faturas sem cartão identificado, de bancos ainda sem linha.
  const semCartao = new Map<string, any[]>();
  for (const f of faturas) if (!f.cartao_id && faturaComLimite(f)) semCartao.set(norm(f.banco), [...(semCartao.get(norm(f.banco)) ?? []), f]);
  for (const [b, lista] of semCartao) {
    if (bancosCobertos.has(b)) continue;
    const f = maisRecente(lista);
    const disp = f.limite_disponivel != null ? Number(f.limite_disponivel) : null;
    const total = f.limite_total != null ? Number(f.limite_total) : Number(f.limite_utilizado ?? 0) + (disp ?? 0);
    const consumido = f.limite_utilizado != null ? Number(f.limite_utilizado) : disp != null ? total - disp : 0;
    const quando = dataCurta(f.created_at ?? f.updated_at ?? f.competencia);
    itens.push({
      key: `f:${f.id}`, banco: String(f.banco ?? ""), nome: "Cartão não identificado", total, consumido: Math.max(0, consumido),
      disponivel: Math.max(0, total - Math.max(0, consumido)), origem: "fatura", origemRotulo: quando ? `Fatura importada em ${quando}` : "Fatura importada",
    });
  }

  itens.sort((a, b) => b.total - a.total);
  const total = itens.reduce((s, i) => s + i.total, 0);
  const consumido = itens.reduce((s, i) => s + i.consumido, 0);
  return { itens, consolidado: { total, consumido, disponivel: Math.max(0, total - consumido), percentual: total > 0 ? (consumido / total) * 100 : 0 } };
}
