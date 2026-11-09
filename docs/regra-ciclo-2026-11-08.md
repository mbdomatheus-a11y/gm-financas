# Regra do ciclo (versão final do usuário, corrigida em 09/11/2026)

Substitui a versão de 08/11/2026 ("salário do dia D paga as contas que vencem até o próximo dia D").

Exemplo do usuário: a Pernambucanas fecha 07/out e vence 15/out. Essa fatura é do ciclo ANTERIOR e foi paga com a receita de 15/out. O ciclo de novembro vai de 16/out a 15/nov.

Com virada no dia D (ex.: 15), o ciclo vai de D+1 do mês M até D do mês M+1 (16/out a 15/nov). Aparece até o dia 15 e vira no dia 16.

1. Receitas do ciclo: data PREVISTA de D+1 do mês M até D do mês M+1 (salário de 30/out + salário de 15/nov). A receita do dia D pertence ao ciclo que TERMINA no dia D. Receita atrasada conta pela data prevista; avulsa sem data prevista conta pela data em que entrou.
2. Faturas de cartão: entram no ciclo em que o FECHAMENTO cai no mês M+1 (ciclo de novembro: faturas que fecham em qualquer dia de novembro, ex. 07/nov, 08/nov, 11/nov, 28/nov; compras do fechamento de outubro até o fechamento de novembro). Fatura que fechou em outubro é do ciclo anterior, mesmo vencendo depois de 15/out.
3. Contas fora do cartão: pelo vencimento de D+1 do mês M até D do mês M+1 (16/out a 15/nov).
4. Tela: rótulo "16/out a 15/nov · faltam N dias" e, abaixo, a linha de origem "Receitas de 16/out a 15/nov · faturas que fecham em novembro · contas que vencem de 16/out a 15/nov".
5. Em conta agora = receitas já recebidas do ciclo - despesas do ciclo já vencidas até hoje.
6. Vai sobrar = receitas do ciclo - despesas do ciclo (todas) - caixinhas planejadas. Por dia = vai sobrar / dias restantes até o dia D do mês M+1, incluindo hoje.
7. Economia na virada = receitas - despesas do ciclo (a fatura que fecha em M+1 e vence depois da virada conta como comprometida). Soma em "Economia acumulada" e NÃO vira receita do ciclo novo.
8. Ritmo: mesma lógica, nos dias do ciclo (D+1 a D).
9. Telas Receitas e Despesas filtradas pelo ciclo, cards "Parcelas do mês" e "Dívida em aberto do mês" usam exatamente essas janelas.
10. Configuração do GRUPO, assistente obrigatório e confirmação de cartão novo seguem como em 08/11 (quem configurar primeiro define; qualquer membro altera; aviso "Fulano mudou a virada para o dia N"). A confirmação do cartão explica que a fatura entra pelo mês do fechamento.

## Exemplo (teste: `npx tsx scripts/teste-regra-ciclo.ts`)
D = 15, hoje 08/11/2026, ciclo de novembro 16/out a 15/nov.

| Item | Entra? |
|---|---|
| Receita 15/out 5.000 | NÃO |
| Receita 30/out 3.000 | entra |
| Receita 15/nov 5.000 | entra |
| Pernambucanas (fecha 07, vence 15): fecha 07/out, vence 15/out, 900 | NÃO |
| Pernambucanas: fecha 07/nov, vence 15/nov, 1.200 | entra |
| Itaú (fecha 03, vence 10): fecha 03/nov, vence 10/nov, 1.800 | entra |
| Cartão C (fecha 28, vence 05): fecha 28/out, vence 05/nov, 400 | NÃO |
| Cartão C: fecha 28/nov, vence 05/dez, 600 | entra |
| Aluguel (vence 25): 25/out 2.000 | entra |
| Aluguel: 25/nov 2.000 | NÃO |
| Condomínio (vence 10): 10/nov 500 | entra |

Receitas 8.000. Despesas 1.200 + 1.800 + 600 + 2.000 + 500 = 6.100. Vai sobrar 1.900. Em 08/11: recebido 3.000, vencido 2.000 (aluguel 25/out), em conta agora 1.000; por dia 1.900 / 8 = 237,50.
