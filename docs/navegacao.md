# Navegação do Control ALL

Fonte única: `src/lib/navegacao.ts`, arquivo IDÊNTICO no site (gm-financas) e no app (controlall). Só dados, sem imports.
Depois de editar, copie para o outro lado e rode `node scripts/checar-navegacao.mjs` no app (também roda dentro de `checar-travamento`, como aviso se o site não estiver acessível).

## Grupos e ordem
Início, Agenda | Dia a dia: Lançamentos, Receitas, Despesas, Cartões/Conta, Importar faturas | Planejar: Caixinhas e metas, Limites de gastos, Investimentos, Indicadores econômicos | Analisar: Relatórios, Para onde vai | Casa e vida: Lista, Veículo, Pet, Exames, Onde está | Documentos: Notas fiscais, Links/Anotações | Ferramentas | Organizar: Categorias, Tags, De-para | Geral: Indicar o Control ALL, Minha jornada, Notificações, Ajuda, Novidades | Configurações | Administração (só admin).
Os grupos Dia a dia, Planejar, Analisar e Organizar formam a área Finanças da barra do app (`GRUPOS_FINANCAS_NAV`).
Itens que existem só num lado (Lançamentos, Indicadores econômicos e Avisos só no app; Link temporário e Administração só no site) ficam na lista com `site` ou `app` ausente. Módulos desligados e permissões seguem `global`, `perm`, `soAdmin`, `grupoAdmin`.

## Quem usa
- Site: menu lateral (`AppLayout.tsx`, `MENU_SITE`). O menu horizontal do topo (layout "superior") ainda usa as áreas antigas.
- App: menu Mais (`src/app/mais/index.tsx`), barra contextual (`app-tabs.tsx`, `BARRAS_NAV`) e deslizar (`deslizar-abas.tsx`, `sequenciaDeslizarNav`).

## Barra inferior do app (por área)
Início: Notas, Agenda, +, Lista, Mais | Finanças: Início, Limites, +, Relatórios, Mais | Notas: Início, Agenda, +, Lista, Mais | Agenda: Início, Notas, +, Lista, Mais | Lista: Início, Notas, +, Agenda, Mais | demais: Início, Notas, +, Lista, Mais.
O deslizar segue a ordem da barra da área (a própria tela da área entra na sua posição; Lançamentos não entra em Finanças).

## Comportamentos padrão
1. Título da tela = nome do menu (`titulo` do item).
2. Tocar no item ativo volta ao topo (app: `emitirAoTopo` + `useAoTopo(ref)` em `src/lib/ao-topo.ts`).
3. Voltar sempre no mesmo lugar: app usa `BotaoVoltar` (volta; sem histórico, vai ao Mais); site usa o Início do menu.
