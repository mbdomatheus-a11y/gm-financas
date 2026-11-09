# Números do ciclo (sobra) - 07/11/2026, regra do ciclo de 08/11/2026

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

## Regra do ciclo (versão final do usuário, 09/11/2026; substitui a de 08/11 e as regras abaixo de 07/11)
Especificação: `docs/regra-ciclo-2026-11-08.md`. Exemplo do usuário: a Pernambucanas fecha 07/out e vence 15/out; essa fatura é do ciclo ANTERIOR e foi paga com a receita de 15/out. O ciclo de novembro vai de 16/out a 15/nov.

- Dia D: regra do GRUPO (`regra_ciclo_grupo`, migration `20261108100000_regra_ciclo_grupo.sql`). Sem regra (ou migration pendente), vale a virada antiga das preferências e o assistente não abre. Com regra, a preferência "receitas a partir do dia N" deixa de valer (`definirViradaDoGrupo` em `format.ts`; `usePreferencias` devolve `dia_virada` do grupo).
- Ciclo "AAAA-MM" (mês M) = de D+1 do mês M até D do mês M+1 (chave "2026-10" = 16/out a 15/nov, o "ciclo de novembro"). Aparece até o dia D e vira no dia D+1 (`mesDoCicloEm`, `competenciaVigente`). Rótulo "16/out a 15/nov" (`janelasDoCiclo`).
- RECEITAS pela DATA PREVISTA de D+1/M até D/M+1 (`receitasDoCiclo`, `dataPrevistaReceita`): salário de 30/out e de 15/nov. A receita do dia D pertence ao ciclo que TERMINA no dia D. Fixa lançada com atraso ou adiantada conta na data prevista; avulsa pela data em que entrou.
- FATURAS de cartão de crédito pelo FECHAMENTO em qualquer dia do mês M+1 (`despesaNoCiclo`, `fechamentoDaParcela`, `janelas.faturas`): ciclo de novembro = faturas que fecham em novembro (compras do fechamento de outubro até o fechamento de novembro). Fatura que fechou em outubro é do ciclo anterior, mesmo vencendo depois de 15/out.
- CONTAS fora do cartão pelo VENCIMENTO de D+1/M até D/M+1 (`janelas.despesas`).
- Linha de origem abaixo do ciclo (`janelas.descricao`): "Receitas de 16/out a 15/nov · faturas que fecham em novembro · contas que vencem de 16/out a 15/nov".
- EM CONTA AGORA (`real.sobra`) = receitas do ciclo já recebidas - despesas do ciclo já vencidas até hoje. Receita FIXA conta como recebida quando a data prevista chega; avulsa só quando lançada e com data até hoje.
- VAI SOBRAR (`previsto.sobra`) = receitas do ciclo - despesas do ciclo (todas, com fatura aberta estimada) - caixinhas planejadas. POR DIA = vai sobrar / dias restantes até o dia D do mês M+1, incluindo hoje.
- Economia na virada (`resultado`, `economiaDoCiclo`) X = receitas - despesas do ciclo; a fatura que fecha no mês M+1 e vence depois da virada conta como comprometida. Detalhe (`detalheEconomia`): A = caixinhas, B = X - A. Gravado em `economia_ciclos`; NÃO entra como receita do ciclo novo.
- Ritmo: mesma lógica (gasto variável por data de compra nos dias do ciclo, D+1 a D).
- Telas Receitas e Despesas num ciclo, cards "Parcelas do mês" / "Dívida em aberto do mês" (`lancamentos-card.ts`) usam as mesmas janelas (`receitasDoCiclo`, `lancamentosDoCiclo`, `despesaNoCiclo`).
- Fixas nos dias 29, 30 e 31 (`vencimentoDaCompetencia` em `recorrencia.ts`): usam o próprio dia ou o último dia do mês menor.

Moedas convertidas pela cotação. Pagamento de fatura e investimentos seguem as regras de Personalização (resgate na janela de receitas, aporte na de contas). Crédito (estorno) fica fora.

## Rótulos (iguais em todas as telas)
- Ciclo: "16/out a 15/nov · faltam N dias" (`textoCiclo`), e abaixo a linha de origem (`janelas.descricao`).
- Destaque: "Vai sobrar em DD/MM" com o Previsto para sobrar (`textoVaiSobrar`), verde se positivo, vermelho se negativo.
- Abaixo: "Pode gastar R$ Y por dia até DD/MM" (`textoPorDia`). Y = `porDia` = Previsto para sobrar / `diasRestantes` (inclui hoje), nunca negativo. Se o previsto é negativo: "Faltam R$ X para fechar o ciclo" em vermelho (`faltaParaFechar`).
- Detalhe menor: "Em conta agora: R$ X (já recebido menos já pago). Ainda vão entrar R$ A e vencer R$ B." (`textoEmConta`). "Disponível" foi renomeado para "Em conta agora" em todas as telas.
- Forecast, por dia, simuladores e textos da IA usam só o Previsto para sobrar (`previsto.sobra`, `porDia`); o "Em conta agora" nunca vira base de conta de sobra.
- Linha: "Inclui R$ X que ainda vão entrar e R$ Y de contas que ainda vão vencer." (+ caixinhas; partes zeradas somem) (`textoDiferenca`)
- Virada (dia D+1 até fechar): "Você economizou R$ X no ciclo 16/set a 15/out" (ou "O ciclo 16/set a 15/out fechou R$ X no vermelho"), abaixo "R$ A foram para caixinhas e R$ B ficaram livres", e "Economia acumulada" (`components/ciclo/CicloInicio.tsx`).

## Assistente e cartões
- `components/ciclo/ConfigurarCiclo.tsx`: obrigatório quando o grupo não tem regra (montado em `_authenticated/route.tsx`). (a) "Qual é o seu principal dia de pagamento?" com sugestão do dia da maior receita fixa; (b) prévia com os números reais do ciclo atual; (c) cartões e em que ciclo cada fatura cai. Salvar grava `regra_ciclo_grupo` e marca os cartões (`regra_revisada_em`, `vencimento_revisado`).
- Cartão novo ou vencimento alterado (tela Cartões): confirmação de um toque "O Nubank fecha dia 13 e vence dia 20. A fatura entra no ciclo pelo mês do fechamento..." com Confirmar ou Mudar a virada. Cartões sem revisão: lista para revisar uma vez por sessão.
- Configurações e Conta: seção "Ciclo do mês" (`CicloDoMesCard`) com a regra, quem configurou e quando, e Alterar (qualquer membro). Alteração gera aviso em `notificacoes_usuario` (trigger) e na Início ("Fulano mudou a virada para o dia N", "já vi" em `localStorage.avisos_vistos`).

## Conferência com o exemplo da regra (teste: `npx tsx scripts/teste-regra-ciclo.ts`)
Virada 15. Hoje 08/11/2026, ciclo de novembro 16/out a 15/nov (chave "2026-10").

| Item | Data que decide | Entra? |
|---|---|---|
| Salário 15/out | 15/out | NÃO (ciclo que terminou em 15/out) |
| Salário 30/out | 30/out | 3.000 (recebido) |
| Salário 15/nov | 15/nov | 5.000 (a entrar) |
| Pernambucanas fecha 07/out vence 15/out | fechamento 07/out | NÃO (ciclo anterior) 900 |
| Pernambucanas fecha 07/nov vence 15/nov | fechamento 07/nov | 1.200 |
| Itaú fecha 03/nov vence 10/nov | fechamento 03/nov | 1.800 |
| Cartão C fecha 28/out vence 05/nov | fechamento 28/out | NÃO (ciclo anterior) 400 |
| Cartão C fecha 28/nov vence 05/dez | fechamento 28/nov | 600 |
| Aluguel 25/out | vencimento 25/out | 2.000 (vencido) |
| Aluguel 25/nov | vencimento 25/nov | NÃO (próximo ciclo) |
| Condomínio 10/nov | vencimento 10/nov | 500 |

| Número | Valor |
|---|---|
| Ciclo | 16/out a 15/nov · faltam 7 dias |
| Receitas do ciclo / recebidas | 8.000 / 3.000 |
| Despesas do ciclo / vencidas | 6.100 / 2.000 |
| Em conta agora (08/11) | 1.000 |
| Vai sobrar em 15/11 | 1.900 (1.400 com 500 de caixinhas) |
| Pode gastar por dia (8 dias, 08 a 15/nov) | 237,50 |
| Economia na virada (16/11) | 1.900 (fatura C de 05/dez comprometida) |

## Regras de 07/11/2026 (histórico)
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

### Rótulos de 07/11 (substituídos)
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

## Ritmo (14/11/2026)

Frase abaixo do gráfico da Previsão do mês. Código: `ritmoDoCiclo` e `textoRitmo` em `src/lib/numeros-ciclo.ts` (o app copia as duas). O destaque "Vai sobrar em DD/MM" continua sendo o previsto.

- Gasto variável = despesa `tipo === "variavel"`, não projetada, não crédito/estorno, só parcela 1 (parcelas 2+ são compromisso, já estão no previsto). Data do gasto = `data_compra` (senão vencimento).
- `porDiaAtual` = variáveis de `inicio` até hoje / dias decorridos (mínimo 1). `porDiaAnterior` = variáveis do ciclo anterior inteiro / dias dele (janela inclusiva, como `datasEntre`).
- `variacaoPct` = (atual − anterior) / anterior, arredondado; `null` se o anterior não tem gasto variável (omitir a comparação).
- `diasRestantes` = dias do ciclo depois de hoje. `adicional` = max(0, porDiaAtual × diasRestantes − variáveis já agendadas depois de hoje). `projecaoNoRitmo` = `previsto.sobra − adicional`.
- `cedo` (3 dias ou menos, ou ciclo futuro): "Ainda é cedo para medir o ritmo deste ciclo."
- Texto: "Em média, neste ciclo você está gastando R$ X por dia, N% menor|maior que no ciclo anterior." Depois, se `projecaoNoRitmo < 0` (vermelho discreto): "Nesse ritmo, o ciclo fecha negativo em R$ Y, a não ser que comece a poupar agora."; senão (verde): "Nesse ritmo, sobram R$ Y em DD/MM."
- Gráfico: linha pontilhada "No ritmo atual" de hoje até o fim: `saldo previsto − adicional × (dia − hoje) / (dias − hoje)`. Só aparece com `adicional > 0`, ciclo em andamento e fora do "cedo".
- Teste: bloco "Ritmo" em `scripts/teste-regra-ciclo.ts`.
