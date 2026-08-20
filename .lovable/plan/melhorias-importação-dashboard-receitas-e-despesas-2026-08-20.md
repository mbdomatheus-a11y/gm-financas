# Melhorias: importação, dashboard, receitas e despesas

## 1. Identificação nas despesas importadas

Hoje o lançamento importado guarda banco e final do cartão em campos separados, mas a lista mostra só a descrição.

- Exibir um prefixo padronizado em todas as listas e no detalhe: `Guilherme · Itaú ·` antes da descrição, seguido de parcela (`3/12`), valor e data da compra.
- Onde o responsável não estiver definido, mostrar apenas `Itaú ·`.
- O prefixo é montado na exibição (responsável + banco/apelido do cartão + final), sem duplicar texto dentro da descrição gravada.

## 2. Limites do cartão vindos da fatura

- Capturar na leitura do PDF: limite total, limite utilizado e limite disponível (padrões de texto por banco).
- Guardar esses valores na fatura importada e mostrá-los na prévia antes de confirmar.
- Nova visão "Limites" (dentro de Cartões): por cartão, limite total, usado, disponível, barra de utilização, comparação entre o limite informado na fatura e o comprometido calculado pelas parcelas do app, e histórico de limite por competência.

## 3. Dashboard mais analítico

- Barras empilhadas por categoria/tipo de gasto com cores próprias, com legenda clicável para ligar/desligar séries.
- Clique na barra de um mês abre o detalhamento daquele mês (lista de lançamentos), e clique numa fatia da pizza filtra a categoria.
- Rótulos de valor já existentes mantidos; tooltips e eixos ajustados para telas pequenas.
- Novos painéis:
  - Fixas x variáveis mês a mês.
  - Comparativo por responsável (quem gastou quanto no mês).
  - Taxa de poupança (saldo ÷ receitas) e média móvel de 3 meses.
  - Compromissos futuros: quanto das parcelas já está travado nos próximos 12 meses.
  - Top 5 maiores despesas do mês.
- Todos os gráficos com altura adaptativa e rolagem horizontal no mobile.

## 4. Fixa ↔ variável

- Ação "Mover para variável / Mover para fixa" no menu de cada despesa e no formulário de edição, preservando parcelas e status de pagamento.

## 5. Receitas por mês

- Trocar a lista corrida por agrupamento mensal: cabeçalho do mês com total recebido e contagem, itens recolhíveis dentro de cada mês, mês atual aberto por padrão.
- Mantidos os filtros atuais; adicionar total do período filtrado.

## Sugestões extras (implemento se aprovar)

- Orçamento por categoria com alerta ao ultrapassar.
- Detecção de gastos recorrentes (assinaturas) a partir das faturas importadas.
- Projeção de saldo dos próximos 12 meses considerando receitas recorrentes.
- Exportar CSV de despesas/receitas.
- Regras de categorização automática por descrição na importação (aprende com o que já foi classificado).

## Notas técnicas

- Migração: colunas `limite_total`, `limite_utilizado`, `limite_disponivel` em `import_faturas`; sem mudança nas políticas de acesso existentes.
- Parsers de limite em `src/lib/faturas.ts`, por banco, com fallback silencioso quando não encontrado.
- Prefixo de identificação como helper compartilhado em `src/lib/format.ts`, usado em despesas, dashboard e compartilhamento.
- Gráficos continuam em Recharts, usando os tokens de cor do design system.
