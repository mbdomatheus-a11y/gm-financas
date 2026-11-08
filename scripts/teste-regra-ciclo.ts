/**
 * Teste da regra do ciclo (08/11/2026): exemplo de docs/regra-ciclo-2026-11-08.md e docs/numeros-ciclo.md.
 * Rodar: npx tsx scripts/teste-regra-ciclo.ts
 * Salário 15 = 5.000 (lançado atrasado em 17/nov), salário 30 = 3.000, Itaú fecha 3 vence 10, Nubank fecha 13
 * vence 20, aluguel 25 = 2.000, condomínio 10 = 500, luz 18 = 300. Virada no dia 15. Hoje 08/12/2026.
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
  dataPrevistaReceita,
  janelasDoCiclo,
  textoDiferenca,
  textoDisponivel,
  textoPrevisto,
} from "../src/lib/numeros-ciclo";

const D = 15;
definirViradaDoGrupo(D);

let falhas = 0;
function igual(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome}: ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const itau = { id: "itau", apelido: "Itaú", tipo: "credito", dia_fechamento: 3, dia_vencimento: 10 };
const nubank = { id: "nu", apelido: "Nubank", tipo: "credito", dia_fechamento: 13, dia_vencimento: 20 };
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
  recorrencia_inicio: `2026-01-${String(dia).padStart(2, "0")}`,
  recorrencia_sem_prazo: true,
  parcelas: [],
});

const despesas = [
  compra("itau-01nov", itau, "2026-11-01", 400), // fecha 03/nov, vence 10/nov: ciclo anterior
  compra("itau-05nov", itau, "2026-11-05", 600), // depois do fechamento: fatura de 10/dez
  compra("nu-10nov", nubank, "2026-11-10", 800), // fatura de 20/nov
  compra("nu-14nov", nubank, "2026-11-14", 200), // depois do fechamento: fatura de 20/dez (próximo ciclo)
  fixa("aluguel", 25, 2000),
  fixa("condominio", 10, 500),
  fixa("luz", 18, 300),
];
const receitas = [
  { id: "s15", descricao: "Salário dia 15", responsavel: "Ana", recorrente: true, recorrencia_inicio: "2026-01-15", data_recebimento: "2026-11-17", valor: 5000, moeda: "BRL" },
  { id: "s30", descricao: "Salário dia 30", responsavel: "Ana", recorrente: true, recorrencia_inicio: "2026-01-30", data_recebimento: "2026-11-30", valor: 3000, moeda: "BRL" },
];
const dados = { despesas, receitas, faturas: [], cotacao: 5, cartoes: [itau, nubank] };
const brl = (v: number) => `R$ ${v.toFixed(2)}`;

const hoje = new Date(2026, 11, 8, 12);
const j = janelasDoCiclo("2026-11", D);
igual("vencimento Itaú compra 05/nov", despesas[1]!.parcelas[0]!.vencimento, "2026-12-10");
igual("vencimento Nubank compra 14/nov", despesas[3]!.parcelas[0]!.vencimento, "2026-12-20");
igual("janela receitas", j.receitas, { inicio: "2026-11-15", fim: "2026-12-14" });
igual("janela despesas", j.despesas, { inicio: "2026-11-16", fim: "2026-12-15" });

const atual = cicloAtual(D, hoje);
igual("ciclo atual", atual.texto, "15/nov a 15/dez · faltam 7 dias");
igual("ciclo anterior", cicloAnterior(D, hoje).rotulo, "15/out a 15/nov");

const n = calcularNumerosCiclo(dados, "2026-11", 0, D, hoje);
igual("receitas do ciclo", n.previsto.receitas, 8000);
igual("recebidas", n.real.receitas, 8000);
igual("contas do ciclo", n.previsto.despesas, 4200);
igual("vencidas até 08/12", n.real.despesas, 3100);
igual("Disponível", n.real.sobra, 4900);
igual("ainda vão entrar", n.previsto.aindaVaoEntrar, 0);
igual("ainda vão vencer", n.previsto.aindaVaoVencer, 1100);
igual("Previsto para sobrar", n.previsto.sobra, 3800);
igual("rótulo destaque", textoDisponivel(n), "Disponível até 08/12");
igual("rótulo previsto", textoPrevisto(n, brl), "Previsto para sobrar em 15/12: R$ 3800.00");
igual("linha", textoDiferenca(n, brl), "Inclui R$ 1100.00 de contas que ainda vão vencer.");
igual("ciclo na tela", n.textoCiclo, "15/nov a 15/dez · faltam 7 dias");

// Com caixinhas de 500 no ciclo.
igual("Previsto com caixinhas 500", calcularNumerosCiclo(dados, "2026-11", 500, D, hoje).previsto.sobra, 3300);

// Dia 16/nov: salário do dia 15 (fixo) só é lançado em 17/nov, mas já conta como recebido pela data prevista,
// igual à conta fixa que conta como vencida. O salário do dia 30 ainda vai entrar.
const n16 = calcularNumerosCiclo(dados, "2026-11", 0, D, new Date(2026, 10, 16, 12));
igual("16/nov recebidas", n16.real.receitas, 5000);
igual("16/nov Disponível", n16.real.sobra, 5000);
igual("16/nov ainda vão entrar", n16.previsto.aindaVaoEntrar, 3000);
igual("16/nov Previsto", n16.previsto.sobra, 3800);

// Receita avulsa só conta quando lançada e com data até hoje.
const comAvulsa = { ...dados, receitas: [...receitas, { id: "bonus", descricao: "Bônus", recorrente: false, data_recebimento: "2026-12-10", valor: 1000, moeda: "BRL" }] };
const nAv = calcularNumerosCiclo(comAvulsa, "2026-11", 0, D, hoje);
igual("avulsa futura não recebida", nAv.real.receitas, 8000);
igual("avulsa futura a entrar", nAv.previsto.aindaVaoEntrar, 1000);

// Dias 29, 30 e 31: o próprio dia ou o último dia do mês menor.
igual("salário 30 previsto em 30/nov", dataPrevistaReceita({ ...receitas[1], projetada: false }), "2026-11-30");
igual("dia 30 em fevereiro", vencimentoDaCompetencia("2026-01-30", "2027-02"), "2027-02-28");
igual("dia 31 em novembro", vencimentoDaCompetencia("2026-01-31", "2026-11"), "2026-11-30");
igual("dia 29 em fevereiro bissexto", vencimentoDaCompetencia("2026-01-29", "2028-02"), "2028-02-29");

// Ciclo fechado 15/out a 15/nov: 8.000 de salários (fixos) menos aluguel 25/out, luz 18/out, condomínio 10/nov, Itaú 10/nov.
const ant = calcularNumerosCiclo(dados, "2026-10", 0, D, hoje);
igual("ciclo 15/out encerrado", ant.encerrado, true);
igual("economia 15/out a 15/nov", economiaDoCiclo(ant), 4800);
igual("ciclo 15/out: tudo recebido no fim", ant.real.receitas, 8000);

// Economia coerente com o previsto: X = receitas - despesas; A = caixinhas; B = X - A = último Previsto para sobrar.
const antCx = calcularNumerosCiclo(dados, "2026-10", 500, D, hoje);
const det = detalheEconomia(antCx);
const ultimoDia = calcularNumerosCiclo(dados, "2026-10", 500, D, new Date(2026, 10, 15, 12));
igual("economia X", det.total, 4800);
igual("caixinhas A", det.caixinhas, 500);
igual("livre B", det.livre, 4300);
igual("B = Previsto para sobrar no último dia", det.livre, ultimoDia.previsto.sobra);
igual("no último dia não falta nada", [ultimoDia.previsto.aindaVaoEntrar, ultimoDia.previsto.aindaVaoVencer], [0, 0]);

if (falhas) {
  console.error(`\n${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTodas as verificações passaram.");
