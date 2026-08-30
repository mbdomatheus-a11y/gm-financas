# Ajustes em despesas, home e importação

## 1. Valor no lançamento de despesa

Hoje o formulário troca o rótulo do campo entre "Valor total" e "Valor da parcela" conforme uma escolha, o que confunde.

- O campo passa a ser sempre **"Valor"** e o que o usuário digita nunca é alterado.
- Quando houver mais de 1 parcela, aparece logo abaixo do campo um resumo calculado: `12x de R$ 300,00 — total R$ 3.600,00`.
- O valor digitado é tratado como **valor da parcela**: total gravado = valor x quantidade de parcelas.
- Em 1x, total = valor digitado (sem mudança de comportamento).
- Some o seletor "Valor total da compra / Valor da parcela".
- Na edição de uma despesa existente, o campo mostra o valor da parcela (total ÷ parcelas), mantendo a mesma lógica ao salvar.

## 2. Despesa fixa mensal recorrente

- Quando o tipo for **Fixa** e a quantidade de parcelas for 1, aparece um campo **"Repetir por (meses)"** com padrão **24**.
- Ao salvar, o sistema gera uma ocorrência mensal para cada mês do período escolhido, com o mesmo valor, a partir da data da 1ª parcela — assim a despesa aparece no histórico e na projeção de fluxo de caixa mês a mês.
- Ao editar, as ocorrências futuras são regeradas preservando as já marcadas como pagas.

## 3. Quadro de agrupamentos no dashboard

Novo painel no dashboard, com seletor de agrupamento: **Categoria**, **Cartão/Banco** e **Responsável**.

- Lista ordenada do maior para o menor gasto do mês selecionado, com valor, percentual do total e barra de participação.
- Clicar em um agrupamento expande a lista das despesas daquele grupo (descrição, data, parcela, valor).
- Clicar em uma despesa da lista abre um diálogo de edição ali mesmo, sem sair do dashboard: descrição, valor, categoria, responsável, data e forma de pagamento. Salvar atualiza os dados e o painel.

## 4. Importação de faturas: banco e cartão

Hoje a importação grava só o nome do banco em texto; a despesa não fica ligada ao cadastro de bancos/cartões, então não aparece nos filtros por cartão nem é identificada como crédito.

- Ao importar, cada lançamento passa a ser vinculado ao **cartão cadastrado** correspondente (casando pelo final do cartão e/ou pelo banco da fatura, incluindo os vínculos já cadastrados em "Cartões").
- Sem cartão correspondente, vincula ao **banco** cadastrado com o mesmo nome (ex.: Santander); se o banco não existir, o cabeçalho da fatura permite escolher o cartão/banco de destino antes de confirmar.
- A despesa importada é marcada como pagamento em **crédito** quando vem de fatura de cartão.
- Nome do banco continua sendo gravado como hoje, para não perder o histórico existente.

## Notas técnicas

- Sem mudanças de banco de dados: `despesas.cartao_id` / `banco_id` já existem e passam a ser preenchidos na importação.
- Recorrência da fixa é materializada em linhas de `parcelas` (uma por mês) da mesma despesa, com `total_parcelas` = meses escolhidos.
- Painel novo e diálogo de edição em `src/routes/_authenticated/dashboard.tsx`, reaproveitando o mesmo schema de validação de `despesas.tsx` extraído para um módulo compartilhado.
- Casamento de cartão na importação usa `cartoes.final`, `cartao_vinculos` e o banco detectado em `src/lib/faturas.ts`.
