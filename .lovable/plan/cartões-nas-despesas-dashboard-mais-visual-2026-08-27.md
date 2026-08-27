# Cartões nas despesas + dashboard mais visual

## 1. Despesas: filtros e visual dos lançamentos de cartão

Hoje a tela de Despesas só filtra por mês, busca livre e aba fixa/variável.

- Nova barra de filtros com: **Cartão** (lista dos cartões cadastrados + "Sem cartão"), **Banco**, **Categoria** e **Responsável**, além do mês e da busca já existentes.
- Filtros ativos viram chips removíveis, com botão "Limpar filtros" e contagem do resultado.
- Resumo do topo (Total / Pago / Em aberto) passa a refletir os filtros e ganha um quarto card: **Próximo vencimento**.
- Novo modo de agrupamento da lista: "Por cartão/banco" — cabeçalho por cartão (apelido, bandeira, final, cor do cartão, logo/ícone) com total do grupo e barra de participação, itens dentro recolhíveis. O modo lista simples continua disponível.
- Cada lançamento fica mais legível: faixa de cor do cartão, badge do banco/final, badge de parcela (`3/12`) com mini barra de progresso das parcelas pagas, valor destacado e data.
- Filtro rápido por cartão também acessível a partir da tela de Cartões (clicar em um cartão leva às despesas já filtradas).

## 2. Dashboard mais visual

Mantém os gráficos atuais (fluxo de caixa, pizza por categoria, evolução do saldo, maiores despesas, parcelamentos) e acrescenta:

- **Faixa de KPIs** no topo com ícones, cor semântica e variação vs. mês anterior: receitas, despesas, saldo, comprometido em parcelas, taxa de poupança.
- **Painel por cartão do mês**: card por cartão com cor própria, total do mês, número de lançamentos, participação no total e utilização de limite (quando houver dado da fatura importada).
- **Gasto por responsável** em barras horizontais com foto/inicial e percentual.
- **Comparativo mês atual x média dos 3 meses anteriores** por categoria (barras agrupadas).
- **Próximos vencimentos** (lista compacta dos próximos 30 dias com dia, cartão e valor).
- Ajustes visuais gerais: gráficos com gradiente e cantos arredondados, tooltips formatados em BRL, alturas adaptativas, rolagem horizontal no mobile e estados vazios ilustrados.

## 3. Tela inicial (hub)

Os dois cartões (Finanças / Lista de compras) ganham prévia de dados: saldo do mês e despesas em aberto no card de Finanças, itens pendentes no card da Lista de compras.

## Notas técnicas

- Sem mudança de banco de dados; tudo a partir de `useDespesas`, `useParcelas`, `useCartoes`, `useBancos` e `useFaturasImportadas`.
- Filtros e agrupamento em estado local de `src/routes/_authenticated/despesas.tsx`, com o cartão selecionado lido de search param para permitir link vindo de Cartões.
- Novos painéis do dashboard em componentes dentro de `src/routes/_authenticated/dashboard.tsx`, usando Recharts e apenas tokens de cor do design system.
