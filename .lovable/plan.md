# Despesas fixas como recorrência — entrega fatiada

Cada etapa abaixo é uma entrega separada. Só sigo para a próxima depois da sua aprovação.

## Etapa 1 — Base no banco (sem mudar telas)

Adicionar às despesas os campos de recorrência: data de início, duração (sem prazo / prazo em meses), e configuração de reajuste (percentual, periodicidade mensal/semestral/anual, nome do índice digitado, mês do primeiro reajuste).

Nada é apagado. As despesas fixas de hoje continuam funcionando exatamente como estão.

## Etapa 2 — Cálculo do valor de cada mês

Criar a regra que diz quanto uma despesa fixa vale em cada mês: valor inicial, reajuste composto aplicado sempre sobre o último valor reajustado, arredondamento em centavos, e fim da recorrência quando há prazo.

Entrega inclui testes automatizados dos casos: sem prazo, 16 meses, encerramento, reajuste mensal, semestral, anual e primeiro reajuste em mês específico.

## Etapa 3 — Formulário de nova despesa fixa

No modal:
- sai "Repetir por (meses)";
- entra "Data de início";
- duração "Sem prazo" ou "Prazo determinado" (campo de meses aparece só nesse caso);
- bloco de reajuste: sem reajuste ou reajuste composto com percentual, periodicidade, índice opcional e mês do primeiro reajuste.

Despesas variáveis ficam intocadas.

## Etapa 4 — Exibição por competência

Listagem de despesas, início e dashboard passam a mostrar a despesa fixa uma vez por mês, pelo valor daquele mês. Nunca a soma dos meses futuros no total de um único mês. Filtros por mês/ano, totais de pago e em aberto seguem a mesma regra.

## Etapa 5 — Pagamento independente por mês

Marcar setembro como pago não afeta outubro nem nenhum mês futuro. Inclui a marcação de pago nas telas onde ela existe hoje.

## Etapa 6 — Migração dos dados atuais

Converter as despesas fixas existentes (inclusive as gravadas como 24x) para "fixa sem prazo", preservando histórico e pagamentos já registrados. Antes de rodar, mostro quantos registros serão afetados e peço sua autorização explícita.

## Etapa 7 — Fechamento

Revisão geral: regressão das despesas variáveis, importação de faturas, edição rápida no início, verificação de tipos e build. Relatório final com arquivos alterados, regras implementadas, testes e riscos.

## Notas técnicas

- Recorrência guardada como regra em `despesas` (início, duração, reajuste), não como milhares de linhas futuras.
- Competências pagas continuam materializadas em `parcelas`, criadas sob demanda no mês em que são pagas — evita duplicação ao editar a recorrência.
- Cálculo monetário em centavos inteiros; reajuste composto aplicado por período completo decorrido desde o primeiro reajuste.
- Camada de projeção compartilhada por `despesas.tsx`, `dashboard.tsx`, `VisaoGeralHome.tsx` e `EditarDespesaRapido.tsx`.
