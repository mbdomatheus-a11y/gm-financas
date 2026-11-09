/**
 * Teste da regra do ciclo (versão final do usuário, 09/11/2026): docs/regra-ciclo-2026-11-08.md e docs/numeros-ciclo.md.
 * Rodar: npx tsx scripts/teste-regra-ciclo.ts
 * Virada D=15, hoje 08/11/2026. Ciclo de novembro (chave "2026-10"): 16/out a 15/nov.
 *  Receitas: 15/out 5.000 (NÃO entra, é do ciclo que terminou em 15/out), 30/out 3.000 (entra), 15/nov 5.000 (entra).
 *  Pernambucanas fecha 07 vence 15: fecha 07/out vence 15/out 900 NÃO entra; fecha 07/nov vence 15/nov 1.200 entra.
 *  Itaú fecha 03 vence 10: fecha 03/nov vence 10/nov 1.800 entra.
 *  Cartão C fecha 28 vence 05: fecha 28/out vence 05/nov 400 NÃO entra; fecha 28/nov vence 05/dez 600 entra.
 *  Aluguel vence 25: 25/out 2.000 entra; 25/nov NÃO entra. Condomínio vence 10: 10/nov 500 entra.
 *  Receitas 8.000; despesas 1.200 + 1.800 + 600 + 2.000 + 500 = 6.100; vai sobrar 1.900.
 */
import { definirViradaDoGrupo } from "../src/lib/format";
import { vencimentoDaFatura } from "../src/lib/fatura-ciclo";
import { vencimentoDaCompetencia } from "../src/lib/recorrencia";
import {
  calcularNumerosCiclo,
  cicloAnterior,
  cicloAtual,
  detalheEconomia,
  economiaDoCiclo,
  janelasDoCiclo,
  lancamentosDoCiclo,
  mesDoCicloEm,
  receitasDoCiclo,
  ritmoDoCiclo,
  textoDisponivel,
  textoPorDia,
  textoRitmo,
  textoVaiSobrar,
} from "../src/lib/numeros-ciclo";

const D = 15;
definirViradaDoGrupo(D);

let falhas = 0;
function igual(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome}: ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const pern = { id: "pern", apelido: "Pernambucanas", tipo: "credito", dia_fechamento: 7, dia_vencimento: 15 };
const itau = { id: "itau", apelido: "Itaú", tipo: "credito", dia_fechamento: 3, dia_vencimento: 10 };
const cc = { id: "cc", apelido: "Cartão C", tipo: "credito", dia_fechamento: 28, dia_vencimento: 5 };
const compra = (id: string, cartao: any, data: string, valor: number) => {
  const venc = vencimentoDaFatura(data, { diaFechamento: cartao.dia_fechamento, diaVencimento: cartao.dia_vencimento });
  return {
    id,
    tipo: "variavel",
    moeda: "BRL",
    valor_total: valor,
    cartao_id: cartao.id,
    data_compra: data,
    parcelas: [{ id: `${id}-1`, despesa_id: id, numero: 1, total: 1, valor, vencimento: venc, paga: false }],
  };
};
const fixa = (id: string, dia: number, valor: number) => ({
  id,
  tipo: "fixa",
  moeda: "BRL",
  valor_total: valor,
  recorrencia_inicio: `2026-10-${String(dia).padStart(2, "0")}`,
  recorrencia_sem_prazo: true,
  parcelas: [],
});

const despesas = [
  compra("pern-out", pern, "2026-10-01", 900), // fecha 07/out, vence 15/out: ciclo anterior
  compra("pern-nov", pern, "2026-10-20", 1200), // fecha 07/nov, vence 15/nov: entra
  compra("itau-nov", itau, "2026-10-20", 1800), // fecha 03/nov, vence 10/nov: entra
  compra("c-out", cc, "2026-10-10", 400), // fecha 28/out, vence 05/nov: ciclo anterior
  compra("c-nov", cc, "2026-11-05", 600), // fecha 28/nov, vence 05/dez: entra
  fixa("aluguel", 25, 2000), // 25/out entra; 25/nov não
  fixa("condominio", 10, 500), // 10/nov entra (10/out é anterior ao início da recorrência)
];
// Salário do dia 15 começa em 15/out (não entra neste ciclo; o de 15/nov entra). Salário do dia 30 em 30/out.
const receitas = [
  { id: "s15", descricao: "Salário dia 15", responsavel: "Ana", recorrente: true, recorrencia_inicio: "2026-10-15", data_recebimento: "2026-10-15", valor: 5000, moeda: "BRL" },
  { id: "s30", descricao: "Salário dia 30", responsavel: "Ana", recorrente: true, recorrencia_inicio: "2026-10-30", data_recebimento: "2026-10-30", valor: 3000, moeda: "BRL" },
];
const cartoes = [pern, itau, cc];
const dados = { despesas, receitas, faturas: [], cotacao: 5, cartoes };
const brl = (v: number) => `R$ ${v.toFixed(2)}`;
const hoje = new Date(2026, 10, 8, 12);

igual("vencimento Pernambucanas compra 20/out", despesas[1]!.parcelas[0]!.vencimento, "2026-11-15");
igual("vencimento Itaú compra 20/out", despesas[2]!.parcelas[0]!.vencimento, "2026-11-10");
igual("vencimento C compra 10/out", despesas[3]!.parcelas[0]!.vencimento, "2026-11-05");
igual("vencimento C compra 05/nov", despesas[4]!.parcelas[0]!.vencimento, "2026-12-05");

const j = janelasDoCiclo("2026-10", D);
igual("janela receitas", j.receitas, { inicio: "2026-10-16", fim: "2026-11-15" });
igual("janela contas", j.despesas, { inicio: "2026-10-16", fim: "2026-11-15" });
igual("janela faturas (fechamento)", j.faturas, { inicio: "2026-11-01", fim: "2026-11-30", porFechamento: true });
igual("rótulo", j.rotulo, "16/out a 15/nov");
igual("linha de origem", j.descricao, "Receitas de 16/out a 15/nov · faturas que fecham em novembro · contas que vencem de 16/out a 15/nov");

igual("ciclo em 08/11", mesDoCicloEm(hoje, D), "2026-10");
igual("ciclo em 15/11 ainda é o mesmo", mesDoCicloEm(new Date(2026, 10, 15, 12), D), "2026-10");
igual("ciclo vira em 16/11", mesDoCicloEm(new Date(2026, 10, 16, 12), D), "2026-11");
igual("ciclo atual", cicloAtual(D, hoje).texto, "16/out a 15/nov · faltam 7 dias");
igual("ciclo anterior", cicloAnterior(D, hoje).rotulo, "16/set a 15/out");

const ids = lancamentosDoCiclo(despesas, "2026-10", D, { cartoes })
  .map((p: any) => `${p.despesa_id ?? p.despesa?.id}@${String(p.vencimento).slice(0, 10)}`)
  .sort();
igual("lançamentos do ciclo", ids, ["aluguel@2026-10-25", "c-nov@2026-12-05", "condominio@2026-11-10", "itau-nov@2026-11-10", "pern-nov@2026-11-15"]);
igual(
  "receitas do ciclo",
  receitasDoCiclo(receitas, "2026-10", D).map((r: any) => r.data_prevista_ciclo).sort(),
  ["2026-10-30", "2026-11-15"],
);

const n = calcularNumerosCiclo(dados, "2026-10", 0, D, hoje);
igual("receitas do ciclo (total)", n.previsto.receitas, 8000);
igual("despesas do ciclo", n.previsto.despesas, 6100);
igual("vai sobrar", n.previsto.sobra, 1900);
igual("recebidas até 08/11", n.real.receitas, 3000);
igual("vencidas até 08/11 (aluguel 25/out)", n.real.despesas, 2000);
igual("em conta agora", n.real.sobra, 1000);
igual("ainda vão entrar", n.previsto.aindaVaoEntrar, 5000);
igual("ainda vão vencer", n.previsto.aindaVaoVencer, 4100);
igual("rótulo em conta", textoDisponivel(n), "Em conta agora");
igual("rótulo destaque", textoVaiSobrar(n), "Vai sobrar em 15/11");
igual("dias restantes (08 a 15/nov)", n.diasRestantes, 8);
igual("por dia", n.porDia, 237.5);
igual("frase por dia", textoPorDia(n, brl), "Pode gastar R$ 237.50 por dia até 15/11");
igual("sem estimativa de fatura", n.previsto.faturaEstimada, 0);
igual("caixinhas 500", calcularNumerosCiclo(dados, "2026-10", 500, D, hoje).previsto.sobra, 1400);

// Na virada (16/11): economia = receitas - despesas do ciclo (fatura C de 05/dez conta como comprometida).
const fechado = calcularNumerosCiclo(dados, "2026-10", 0, D, new Date(2026, 10, 16, 12));
igual("16/11: ciclo encerrado", fechado.encerrado, true);
igual("economia do ciclo", economiaDoCiclo(fechado), 1900);
igual("economia com caixinhas 500", detalheEconomia(calcularNumerosCiclo(dados, "2026-10", 500, D, new Date(2026, 10, 16, 12))), { total: 1900, caixinhas: 500, livre: 1400 });
const ultimo = calcularNumerosCiclo(dados, "2026-10", 0, D, new Date(2026, 10, 15, 12));
igual("15/11: ainda o mesmo ciclo, salário de 15/nov recebido", [ultimo.encerrado, ultimo.real.receitas], [false, 8000]);

// Dias 29, 30 e 31: o próprio dia ou o último dia do mês menor.
igual("dia 30 em fevereiro", vencimentoDaCompetencia("2026-01-30", "2027-02"), "2027-02-28");
igual("dia 31 em novembro", vencimentoDaCompetencia("2026-01-31", "2026-11"), "2026-11-30");

// Ritmo: mesma lógica (gasto variável por data de compra nos dias do ciclo). Ciclo atual 16/out a 08/nov
// (24 dias): 1.200 + 1.800 + 600 = 3.600 → 150/dia. Ciclo anterior 16/set a 15/out (30 dias): 900 + 400 = 1.300.
{
  const r = ritmoDoCiclo(dados, "2026-10", n, D, hoje);
  igual("ritmo atual por dia", r.porDiaAtual, 150);
  igual("ritmo anterior por dia", r.porDiaAnterior, 43.33);
  igual("ritmo dias restantes", r.diasRestantes, 7);
  igual("ritmo adicional", r.adicional, 1050);
  igual("ritmo projeção", r.projecaoNoRitmo, 850);
  igual("frase ritmo", textoRitmo(r, n.fim, brl).linha2, "Nesse ritmo, sobram R$ 850.00 em 15/11.");
}

if (falhas) {
  console.error(`\n${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTodas as verificações passaram.");
