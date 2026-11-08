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

## Regra do ciclo (08/11/2026, substitui as regras abaixo de 07/11)
Especificação aprovada: `docs/regra-ciclo-2026-11-08.md`. Frase: "O salário do dia D paga as contas que vencem até o próximo dia D. O que sobrar no dia D é economia."

- Dia D: regra do GRUPO (`regra_ciclo_grupo`, migration `20261108100000_regra_ciclo_grupo.sql`). Sem regra (ou migration pendente), vale a virada antiga das preferências e o assistente não abre. Com regra, a preferência "receitas a partir do dia N" deixa de valer (`definirViradaDoGrupo` em `format.ts`; `usePreferencias` devolve `dia_virada` do grupo).
- Ciclo "AAAA-MM" = começa no dia D desse mês. Rótulo "15/nov a 15/dez" (`janelasDoCiclo`).
- RECEITAS pela DATA PREVISTA de D até D-1 do mês seguinte (`receitasDoCiclo`, `dataPrevistaReceita`): fixa projetada pela data prevista; fixa lançada com atraso ou adiantada conta na data prevista (dia de `recorrencia_inicio`, até 16 dias de diferença); avulsa pela data em que entrou. A projeção sai quando a lançada ocupa a mesma data prevista.
- DESPESAS pelo VENCIMENTO de D+1 até D do mês seguinte (`lancamentosDoCiclo`). Cartão pelo vencimento da fatura (`vencimentoDaFatura`: compra depois do fechamento vai para a fatura seguinte). Fatura que vence no próprio dia D fica no ciclo que termina.
- DISPONÍVEL ATÉ HOJE (`real.sobra`) = receitas do ciclo já recebidas - contas do ciclo já vencidas (vencimento até hoje, lançadas ou recorrentes). Simetria: receita FIXA conta como recebida quando a data prevista chega, lançada ou não (como a conta fixa conta como vencida); receita avulsa só quando lançada e com data até hoje. Ainda não existe controle de "fixa não recebida/adiada" na receita; quando existir, a regra deve respeitá-lo (ponto marcado em `calcularComBase`).
- PREVISTO PARA SOBRAR (`previsto.sobra`) = Em conta agora + ainda vão entrar - ainda vão vencer (com fatura aberta estimada) - caixinhas do ciclo. Sem forecast por ritmo.
- Resultado / economia (`resultado`, `economiaDoCiclo`) X = receitas do ciclo - despesas do ciclo. Detalhe (`detalheEconomia`): A = caixinhas do ciclo, B = X - A ficaram livres (igual ao último "Previsto para sobrar" quando tudo se realizou). Gravado em `economia_ciclos` (upsert) na primeira abertura da Início depois da virada; "Economia acumulada" = soma de X (`economiaAcumulada`). Economia NÃO entra como receita do ciclo novo.
- Outras funções: `cicloAtual` (início, fim, rótulo, dias restantes, "15/nov a 15/dez · faltam N dias"), `cicloAnterior`, `mesDoCicloEm`.
- Telas Receitas e Despesas, num ciclo só, usam as mesmas janelas (`receitasDoCiclo`, `lancamentosDoCiclo`).
- Fixas nos dias 29, 30 e 31 (`vencimentoDaCompetencia` em `recorrencia.ts`, receitas e despesas recorrentes): usam o próprio dia ou o último dia do mês menor (30 em fevereiro vira 28 ou 29). Antes eram limitadas a 28.

Moedas convertidas pela cotação. Pagamento de fatura e investimentos seguem as regras de Personalização (resgate na janela de receitas, aporte na de despesas). Crédito (estorno) fica fora.

## Rótulos (iguais em todas as telas)
- Ciclo: "15/nov a 15/dez · faltam N dias" (`textoCiclo`)
- Destaque: "Vai sobrar em DD/MM" com o Previsto para sobrar (`textoVaiSobrar`), verde se positivo, vermelho se negativo.
- Abaixo: "Pode gastar R$ Y por dia até DD/MM" (`textoPorDia`). Y = `porDia` = Previsto para sobrar / `diasRestantes` (inclui hoje), nunca negativo. Se o previsto é negativo: "Faltam R$ X para fechar o ciclo" em vermelho (`faltaParaFechar`).
- Detalhe menor: "Em conta agora: R$ X (já recebido menos já pago). Ainda vão entrar R$ A e vencer R$ B." (`textoEmConta`). "Disponível" foi renomeado para "Em conta agora" em todas as telas.
- Forecast, por dia, simuladores e textos da IA usam só o Previsto para sobrar (`previsto.sobra`, `porDia`); o "Em conta agora" nunca vira base de conta de sobra.
- Linha: "Inclui R$ X que ainda vão entrar e R$ Y de contas que ainda vão vencer." (+ caixinhas; partes zeradas somem) (`textoDiferenca`)
- Virada (dia D+1 até fechar): "Você economizou R$ X no ciclo 15/out a 15/nov" (ou "O ciclo 15/out a 15/nov fechou R$ X no vermelho"), abaixo "R$ A foram para caixinhas e R$ B ficaram livres", e "Economia acumulada" (`components/ciclo/CicloInicio.tsx`).

## Assistente e cartões
- `components/ciclo/ConfigurarCiclo.tsx`: obrigatório quando o grupo não tem regra (montado em `_authenticated/route.tsx`). (a) "Qual é o seu principal dia de pagamento?" com sugestão do dia da maior receita fixa; (b) prévia com os números reais do ciclo atual; (c) cartões e em que ciclo cada fatura cai. Salvar grava `regra_ciclo_grupo` e marca os cartões (`regra_revisada_em`, `vencimento_revisado`).
- Cartão novo ou vencimento alterado (tela Cartões): confirmação de um toque "O Nubank vence dia 20, depois da sua virada (dia 15)..." com Confirmar ou Mudar a virada. Cartões sem revisão: lista para revisar uma vez por sessão.
- Configurações e Conta: seção "Ciclo do mês" (`CicloDoMesCard`) com a regra, quem configurou e quando, e Alterar (qualquer membro). Alteração gera aviso em `notificacoes_usuario` (trigger) e na Início ("Fulano mudou a virada para o dia N", "já vi" em `localStorage.avisos_vistos`).

## Conferência com o exemplo da regra (teste: `npx tsx scripts/teste-regra-ciclo.ts`)
Virada 15. Salário 15 = 5.000 (lançado atrasado em 17/nov), salário 30 = 3.000, Itaú fecha 3 vence 10, Nubank fecha 13 vence 20, aluguel 25 = 2.000, condomínio 10 = 500, luz 18 = 300. Compras: Itaú 01/nov 400 e 05/nov 600, Nubank 10/nov 800 e 14/nov 200. Hoje 08/12/2026, ciclo 15/nov a 15/dez.

| Item | Data no ciclo | Entra? | Já aconteceu em 08/12? |
|---|---|---|---|
| Salário 15 (prevista 15/nov, lançado 17/nov) | 15/nov | receita 5.000 | sim |
| Salário 30 (prevista 30/nov) | 30/nov | receita 3.000 | sim |
| Salário 15 de dezembro | 15/dez | não (próximo ciclo) | |
| Luz | 18/nov | 300 | vencida |
| Nubank (compra 10/nov, fecha 13/nov) | 20/nov | 800 | vencida |
| Aluguel | 25/nov | 2.000 | vencida |
| Condomínio | 10/dez | 500 | a vencer |
| Itaú (compra 05/nov, depois do fechamento de 03/nov) | 10/dez | 600 | a vencer |
| Itaú (compra 01/nov) | 10/nov | não (ciclo anterior) | |
| Nubank (compra 14/nov, depois do fechamento) | 20/dez | não (próximo ciclo) | |

| Número | Valor |
|---|---|
| Ciclo | 15/nov a 15/dez · faltam 7 dias |
| Receitas do ciclo / recebidas | 8.000 / 8.000 |
| Contas do ciclo / vencidas | 4.200 / 3.100 |
| Em conta agora (08/12) | 4.900 |
| Ainda vão entrar / vencer | 0 / 1.100 |
| Vai sobrar em 15/12 | 3.800 (3.300 com 500 de caixinhas) |
| Pode gastar por dia (8 dias restantes) | 475 (3.800 / 8) |
| Em 16/nov (salário 15 fixo ainda não lançado, conta pela data prevista) | Em conta agora 5.000, a entrar 3.000, Previsto 3.800 |
| Economia do ciclo 15/out a 15/nov | X = 8.000 - (luz 300 + aluguel 2.000 + condomínio 500 + Itaú 400) = 4.800 |
| Com 500 de caixinhas | A = 500, B = 4.300 = Previsto para sobrar em 15/11 |
| Avulsa de 1.000 lançada para 10/dez | não recebida em 08/12, entra em "ainda vão entrar" |

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
