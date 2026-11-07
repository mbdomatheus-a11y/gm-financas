# Números do ciclo (sobra) - 07/11/2026

Uma só função calcula "sobra" no site e no app:
- Site: `src/lib/numeros-ciclo.ts` (`calcularNumerosCiclo`, `calcularNumerosDosCiclos`). Hook: `src/hooks/useNumerosCiclo.ts`. Bloco visual: `src/components/SobraCiclo.tsx`.
- App: `controlall/src/lib/numeros-ciclo.ts` (cópia; só muda a leitura do ciclo do usuário), `numeros-ciclo-dados.ts` (carrega dados), `components/inicio/sobra-ciclo.tsx`.

Nenhuma tela soma receitas menos despesas por conta própria. Período: sempre o ciclo do usuário (dia de virada), nunca o mês do calendário.

## Por que as telas divergiam
1. Receitas do dia N em diante (ex. 28): a preferência "a partir do dia N conta no próximo ciclo" era aplicada duas vezes na previsão (na competência da receita e de novo sobre a data). A fixa projetada do dia 28 sumia da previsão e aparecia no dashboard.
2. Períodos diferentes: dashboard, Despesas e Compartilhar usavam competência/mês; a previsão usava as datas do ciclo; algumas chamadas do app (assistente, perfil, fluxo) nem recebiam o dia de virada.
3. Fatura estimada (média das últimas faturas) só existia na previsão.
4. Caixinhas: só a previsão descontava. Em outras chamadas a meta era 0.
5. Ritmo de gasto: "se continuar assim" somava um chute de gasto variável ao número principal.
6. Perfil financeiro/lista de compras: "sobra livre" = renda informada menos comprometido.
7. Crédito/estorno e pagamento de fatura entravam em umas telas e não em outras.

## Regras
Todas as moedas convertidas pela cotação. Pagamento de fatura e investimentos seguem as regras de Personalização. Crédito (estorno) fica fora das despesas.

REAL ATÉ HOJE ("Sobra até agora")
- receitas = receitas lançadas (não projetadas) do ciclo com data de recebimento até hoje
- despesas = parcelas lançadas (não projetadas) com vencimento no ciclo até hoje
- real.sobra = receitas - despesas (sem caixinhas, sem estimativas)

PREVISTO NO FIM DO CICLO
- receitas = todas as receitas do ciclo (lançadas + fixas projetadas)
- despesas = todas as parcelas com vencimento no ciclo (lançadas + recorrentes projetadas) + estimativa de fatura aberta
- caixinhas = valor a guardar no ciclo (`metaDoMes`)
- previsto.sobra = receitas - despesas - caixinhas
- aindaVaoEntrar = previsto.receitas - real.receitas; aindaVaoVencer = previsto.despesas - real.despesas (inclui a fatura estimada)

Regra única para receitas do dia 28 em diante: vale a competência da receita (`receitasPorCompetencias`), que aplica a preferência "receitas a partir do dia N" UMA vez. Não se reaplica sobre a data. Fixa projetada nunca conta como recebida (só no previsto).

`sobraParaInvestir` (campo e função exportada) = real.sobra se positivo, senão 0. Para uso futuro.

Forecast por ritmo de gasto removido. O gráfico da previsão usa real até hoje e previsto depois, sem ritmo.

## Rótulos (iguais em todas as telas)
- Destaque: "Sobra até agora" (real)
- Menor, abaixo: "Previsto no fim do ciclo: R$ X"
- Linha: "Inclui R$ Y que ainda vão entrar, R$ Z de contas que ainda vão vencer e R$ W guardados nas caixinhas." (partes zeradas somem)
Textos vêm de `ROTULO_SOBRA_REAL`, `textoPrevisto`, `textoDiferenca`.

## Telas que usam
Site: Início (ResumoPrevisaoHome), Finanças (HeroMes do dashboard, gráfico de fluxo "Saldo"), VisaoGeralHome, GraficoHome, Despesas (card "Sobra até agora"), Relatórios (Resumo, Saldo, Previsão), Compartilhar (imagem, texto, resumo inteligente), ControlIA e resumo da IA (`useResumoFinanceiroMes`), Perfil financeiro e Lista de compras (via GamificacaoFinanceira).
App: Início (hero e Previsão do mês, histórico, fluxo, evolução), Lançamentos (explore), Despesas, Relatórios (Resumo, Saldo, Previsão), Compartilhar (`resumoDoMes`), Assistente, Perfil financeiro e Lista de compras.
Fora do escopo (não são sobra): Receitas (sem saldo), Calendário (resultado por dia), CardForecast.tsx (sem uso no site; ainda tem forecast por ritmo, não montar), saldo de contas bancárias.

## Conferência: o que cada tela mostrava antes e mostra depois
Ciclo atual do usuário. Não rodei SQL, então os valores em reais dependem dos dados; a tabela mostra a conta de cada tela. Depois da mudança, TODAS as linhas mostram o mesmo par (real, previsto).

| Tela | Antes | Depois |
|---|---|---|
| Início site/app (Previsão) | "Você pode gastar X por dia" + saldo livre (receitas do ciclo por data - despesas por vencimento - caixinhas) + "se continuar assim" (ritmo) | Sobra até agora + Previsto no fim do ciclo |
| Início app (hero "Saldo do mês") | receitas - despesas por competência, sem estimativa e sem caixinhas | Sobra até agora + Previsto |
| Finanças site (HeroMes) | receitas - despesas do mês (competência, com projetadas, sem fatura estimada, sem caixinhas) | Sobra até agora + Previsto |
| Despesas site/app ("Receitas - despesas" / "Saldo do mês") | receitas do filtro - total da lista | Sobra até agora (dica: Previsto) |
| Lançamentos app | receitas - despesas da lista | Sobra até agora + Previsto |
| Relatórios Resumo ("Receitas menos despesas") | soma do período sem estimativas/caixinhas | ciclo único: bloco Sobra/Previsto; vários ciclos: soma dos Previstos |
| Relatórios Saldo/Previsão ("Resultado") | receitas - despesas (+ média de variáveis) | Previsto de cada ciclo (simulação de variáveis só desconta a diferença) |
| VisaoGeral/GraficoHome/fluxo "Saldo" | receitas - despesas por mês | Previsto de cada ciclo |
| Compartilhar (imagem e texto) | receitas - despesas | Sobra até agora + Previsto |
| Perfil financeiro/Lista de compras ("Sobra livre") | renda informada - comprometido | Previsto no fim do ciclo (nunca negativo) |
| ControlIA / assistente | saldoLivre, fimDoMesPrevisto (ritmo), saldo | sobraAteAgora, previstoNoFimDoCiclo |

Para o ciclo atual: Sobra até agora = recebido - vencido até hoje. Previsto = Sobra até agora + (receitas ainda por entrar) - (contas ainda por vencer, incluindo fatura estimada) - caixinhas. Diferença entre "4 mil" e "2,5 mil" costuma ser: receita fixa do dia 28+ contada ou não, fatura estimada e caixinhas.
