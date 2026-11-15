# Revisão final para lançamento (site, iPhone e Android)

Aberto em 14/11/2026. Pedido do Matheus: revisão completa, da home pública até as telas internas, para quem entrar dizer "que site e app lindo e fácil de usar", e enviar a versão final à Apple e ao Google.

## Decisões do Matheus (14/11/2026)
- Visual: redesign total liberado (paleta, tipografia, ícones e layout). Substitui a decisão anterior de manter o azul da marca.
- Gamificação: versão leve e opcional, com chave em Configurações.
- Reset de conta de teste: duas contas diferentes (a do e-mail artfoxbrasil e a do Marcus NT). Só essas duas.
- Aprovação: implementar direto e mostrar o resultado ao fim de cada bloco, sem publicar. Commit, push, SQL e eas update continuam com o Matheus.

## Diagnóstico de partida
- Base técnica boa: cores do app já espelham o site (styles.css e constants/theme.ts), raio e sombras padronizados, navegação em fonte única (src/lib/navegacao.ts, idêntico nos dois lados).
- Excesso de itens: 40 itens de menu e 14 só em Finanças. É o maior obstáculo a "fácil de usar".
- Personalização com 14 paletas e 4 fontes dilui a identidade. Produto de referência tem 1 identidade forte e no máximo claro e escuro.
- Dois sinos no app (Notificações e Avisos) e três telas de ajuste (Configurações, Personalização, Minha conta) fazem papel parecido.
- Entrada: home pública com 654 linhas e login com 932 linhas, vários caminhos (popup, /entrar, /comecar). Precisa de um funil único.
- Docs desatualizados: claude/site-telas.md é de 14/09.

## Referências de mercado (o que copiar de cada uma)
- Nubank e Wise: uma ideia por tela, número grande, verbo claro no botão.
- Organizze e Mobills: lançamento em 3 toques, "+" central.
- Duolingo: sequência de dias e progresso visível, sem atrapalhar o uso.
- Apple (HIG) e Material 3: transições nativas, alvos de 44 pt, hierarquia por tamanho e peso.

## Blocos
| # | Bloco | Estado |
|---|---|---|
| 1 | Estrutura do menu: Finanças dividido em Dia a dia, Planejar, Analisar, Organizar | Feito e publicado 14/11 |
| 2 | Identidade: tipografia, ícones, raio, sombra e movimento, nos tokens do site e do app. Personalização reduzida | Por último, a pedido do Matheus (15/11) |
| 3 | Entrada: home pública, login, cadastro, boas-vindas, abertura (splash) e transições, web e app | Pendente |
| 4 | Início e telas centrais: Início, Lançamentos, novo lançamento, Cartões, Mais. Unificar sinos e telas de ajuste | Pendente |
| 5 | Gamificação leve e opcional (Minha jornada) | Publicado 15/11 (SQL rodado, update 17.06); falta validar na tela |
| 6 | Administração: botão Resetar conta de teste | Publicado 14/11 (SQL rodado); falta o Matheus testar um reset |
| 7 | Fechamento para as lojas: acessibilidade, iPad, Android, prints, textos da loja, build final | Parte de código feita 15/11 (ver docs/LOJAS-CHECKLIST-2026-11.md); consoles e testes em aparelho com o Matheus |

Cada bloco sai nas três plataformas na mesma entrega (regra de espelhamento).

Ordem combinada em 15/11: o visual (blocos 2, 3 e a parte visual do 4) fica como última tarefa. Antes vêm as pendências que não mudam a aparência.

## Bloco 1 (feito)
- src/lib/navegacao.ts (site e app, idênticos): grupo Finanças virou quatro grupos menores.
  - Dia a dia: Lançamentos, Receitas, Despesas, Cartões/Conta, Importar faturas.
  - Planejar: Caixinhas e metas, Limites de gastos, Investimentos, Indicadores econômicos.
  - Analisar: Relatórios, Para onde vai.
  - Organizar (depois de Ferramentas): Categorias, Tags, De-para.
- Barra contextual do app continua tratando os quatro grupos como a área Finanças (GRUPOS_FINANCAS_NAV).
- Conferido: checar-navegacao ok; TypeScript sem erro no site e no app. Não conferido na tela ainda.

## Bloco 5: gamificação (desenho)
- O que entra: sequência de dias com lançamento ou conferência, nível por EXP, 8 a 10 conquistas ligadas a hábito bom (primeiro lançamento, fatura importada, ciclo fechado com sobra, caixinha concluída).
- O que não entra: ranking entre pessoas, missão diária obrigatória, punição por perder a sequência, EXP por gastar.
- Onde aparece: um bloco pequeno na Início e uma tela "Minha jornada". Chave "Mostrar minha jornada" em Configurações, desligável a qualquer momento. Desligada, nada aparece e nada é cobrado do usuário.
- Motivo: em finanças, gamificação funciona quando premia constância e some quando vira cobrança.

## Bloco 2: nota (14/11)
Olhei a home pública e o login no celular (produção). A identidade atual já é forte e combina com o logo azul: título pesado, botões em pílula, muito espaço. Trocar a paleta às cegas pioraria. Decisão proposta: manter a família azul do logo e concentrar o redesign em estrutura, hierarquia, ícones, boas-vindas e telas internas. As telas internas do site só podem ser vistas com login feito pelo Matheus no navegador do Claude.

## Bloco 6: reset de conta de teste (código feito em 14/11)
- Contas permitidas (conferidas no banco, cada uma sozinha no próprio grupo, nenhuma é admin do site): mwathews@gmail.com (Marcus NT) e artfoxbrasil@gmail.com (Marcus Nt).
- Onde fica: site, Administração > Usuários > cartão "Contas de teste". Módulo de admin, só no site.
- Arquivos do site: supabase/migrations/20261114150000_reset_conta_teste.sql (cópia em docs/sql), src/lib/conta-teste.functions.ts, src/components/ResetContaTesteCard.tsx, src/lib/reset-teste.ts, ajuste em boas-vindas/BoasVindas.tsx e em administracao.tsx.
- Arquivos do app: src/lib/reset-teste.ts, ajuste em components/primeiro-acesso/index.tsx e export em lib/cache-telas.ts.
- Segurança: a lista de contas é fixa no servidor e de novo dentro da função do banco (id e e-mail conferidos juntos). A função só roda pelo servidor (service role), recusa admin do site e recusa grupo com outra pessoa.
- O que faz: backup completo em reset_backups (tipo conta_teste), apaga tudo do grupo e o estado pessoal (avisos, tour, preferências), zera o perfil financeiro, registra em admin_audit_logs. Uma transação só: se falhar, nada é apagado.
- O que mantém: login, senha, nome, e-mail, papel, permissões, convites, chamados, aceite dos termos, conexões de banco, históricos de acesso e o registro de arquivos enviados (os arquivos no armazenamento não são apagados).
- Conta nova de novo: site e app consultam meu_ultimo_reset_teste; a conta resetada volta a ver boas-vindas, primeiros passos e tour, e o que o aparelho guardou é limpo uma vez.
- Botão "Baixar último backup" entrega o JSON ao admin.
- Não testado em execução: o SQL ainda não foi rodado. TypeScript sem erro no site e no app.

## Bloco 5: Minha jornada (código feito em 15/11)
- Nada é gravado a cada ação. Sequência, nível e conquistas são calculados na hora pela função do banco minha_jornada(), a partir do que a pessoa já registrou. A única coisa guardada é mostrar ou esconder (tabela jornada_usuario).
- Regra única nos dois lados: src/lib/jornada.ts, arquivo idêntico no site e no app (como o navegacao.ts).
- EXP: 10 por dia com algum registro, mais o valor de cada conquista. Níveis em 0, 100, 300, 600, 1000 EXP: Começando, Organizado, Atento, Planejador, Estrategista, Mestre do controle.
- 10 conquistas: Primeiro passo, Pegando o ritmo, Tudo anotado, Fatura na mão, Primeira caixinha, Guardando sempre, Com limite, Nota guardada, Semana cheia, Mês inteiro.
- Sequência conta até hoje ou até ontem, então o dia só "quebra" depois de um dia inteiro sem registro. Perder a sequência não tira EXP.
- Site: cartão no Início (JornadaInicioCard), tela /jornada, item em Configurações e no menu (grupo Geral), hook useJornada.
- App: cartão no Início (aba Resumo), tela Mais > Minha jornada, lib/jornada-dados.ts.
- Chave "Mostrar minha jornada no Início" na própria tela. Desligada, o cartão some do Início; a tela continua no menu para religar.
- SQL: supabase/migrations/20261115090000_minha_jornada.sql (cópia em docs/sql/2026-11-15-minha-jornada.sql). Sem o SQL, nada aparece e nada quebra.
- Conferido: cálculo testado com dados simulados, consulta do banco testada em leitura, TypeScript sem erro nos dois lados, navegação igual. Não conferido na tela.
- Conta de teste resetada: a jornada zera sozinha, porque é calculada dos dados.

## Jornada do usuário, parte pública do site (15/11)
Medido no celular (375 px) em produção: a home tinha 16.126 px de altura (cerca de 20 telas), 17 faixas, e 17 links ou botões com menos de 40 px de altura.
Feito no código:
- Home reordenada para o caminho de decisão: topo, Por dentro da Previsão, Como funciona, Recursos, Módulos, App, Parceria, Demonstração, Perdas invisíveis, Segurança, Preço, Educação financeira, Perguntas.
- Saíram as faixas de Notas e de Calendário (repetiam Recursos e Módulos) e o bloco do app no fim (repetia a faixa do app). Estimativa: 2.000 px a menos no celular.
- Espaço entre faixas no celular caiu de 96 para 64 px (computador igual).
- Alvos de toque no celular: Entrar e menu do topo com 44 px; links do rodapé com 44 px.
- Na tela de login, o botão Entrar do topo não aparece mais.
- Aviso de cookies com texto mais curto (cobria cerca de um terço da tela de login no celular). Os links de Privacidade, Cookies e a escolha de cookies continuam.
Não conferido na tela: só depois de publicado. Telas internas (Início, lançar, menus) não foram vistas: o navegador do Claude não está logado no site.

## Jornada do usuário, site por dentro no celular (15/11)
Visto em produção, logado, a 375 px: Início, menu, Despesas, Cartões/Conta, Minha jornada, Configurações e Notas. Nenhuma tela com rolagem lateral. Início com 5.124 px de altura (cerca de 6 telas), sendo 2.248 px só do bloco da Previsão.
Problemas encontrados e corrigidos no código:
- Título repetido em todas as telas (pequeno no topo e grande logo abaixo; no Início, a saudação duas vezes). Agora o título pequeno do topo só aparece depois de rolar, como no iPhone.
- Ações da página (ex.: Open Finance em Despesas, Novo cartão em Cartões) ficavam na barra do topo e empurravam a foto da conta para fora da tela. No celular passaram para o lado do título.
- Ações rápidas do Início com texto cortado ("Lançar g...", "Nova rec..."). Agora o nome aparece inteiro; a linha de detalhe fica só em telas maiores.
- Configurações aparecia duas vezes no menu do celular (na lista e no atalho do fim). Ficou só o atalho.
Observado e não alterado: 11 botões com menos de 36 px em Despesas e 9 em Cartões; ícones do topo com 36 px; cabeçalho do bloco "Cobranças para revisar" quebrando em duas colunas; subtítulo de Despesas longo; contador de avisos em 39.
Não conferido: o resultado depois das correções (só após publicar), o fluxo de lançar, o computador e o modo escuro.

## Jornada, segunda passada (15/11, depois da publicação)
Conferido em produção no celular: Início sem saudação repetida e com as ações rápidas inteiras; Cartões com "Novo cartão" ao lado do título e a foto da conta visível. Banco: os SQLs de 15/11 estão aplicados (código de recuperar senha liberado, zz_teste_fn removida, parceria sem acesso de visitante).
Corrigido no código nesta passada:
- Despesas: a fileira de botões ao lado do título (Open Finance, Fatura do mês, Nova despesa) passava da largura da tela e cortava o último. Agora quebra em duas linhas.
- Formulário de nova despesa no celular: Valor vem primeiro e maior; Moeda foi para "Mais opções" (o padrão é real).
- Botão de fechar das janelas: lia "Close" para leitor de tela e tinha 16 px. Agora "Fechar", com 36 px.
- Início no computador: ações rápidas cortavam o nome ("Importar fa...") em telas médias. O nome aparece inteiro.
- "Cobranças para revisar": o aviso ao lado do título passa para a linha de baixo no celular.
Visto e não alterado: escolha de lançamento abre no meio da tela (no celular o padrão é subir de baixo); botões de 28 a 32 px em filtros e ordenação de Despesas; subtítulo longo de Despesas; 41 avisos no sino.

## Jornada, terceira passada (15/11)
Feito no código:
- Escolha de lançamento (Despesa, Receita, IA): no celular sobe de baixo, perto do polegar. No computador segue no meio.
- Despesas: subtítulo curto (quantidade, total e ciclo); a regra completa do ciclo continua na Previsão do mês e em Configurações.
- Botões maiores no celular: setas do ciclo (40 px), ordenação Data, Valor e Nome (36 px), Limpar filtros (40 px).
Não foi possível conferir o modo escuro por dentro: a sessão do site caiu por inatividade no meio da conferência. A tela de login fica clara mesmo com o aparelho em modo escuro.
Ponto para decisão do Matheus: o site desloga por inatividade em poucos minutos (configurável na Administração). Para quem usa no celular isso pesa na experiência.
Sem alteração, por decisão: o número de avisos do sino (41) é real; esconder o número não resolve, o caminho é revisar quais alertas nascem ligados.

## Menos é mais: menus, administração e primeiro acesso (15/11, noite)
Pedido do Matheus: sem menus repetidos, administração fácil de achar, admin com a mesma experiência do usuário comum, menos telas repetidas ao entrar e menos texto no app.
Site:
- Menu da foto: ficou só com Minha conta, Configurações, Idioma, Suporte e Sair. Saíram Usuários e privilégios, Backup e Reset e Administração do site (já estão no menu lateral e em Configurações).
- Configurações: ganhou "Backup e reset" para quem administra o grupo.
- Administração: as caixas numeradas e a segunda fileira de abas deram lugar a um índice único, com todas as 21 seções à vista em 5 grupos e uma busca que acha também pelo conteúdo (ex.: "reset" leva a Usuários e convites, "inatividade" a Login e acesso). Abre em Usuários e convites. Nomes mais simples (Login e acesso, Solicitações, Registro de ações). Os endereços com ?aba= continuam valendo.
- Primeiro acesso: apresentação de quatro telas virou uma; o aviso de dados de exemplo deixou de ser um segundo "Bem-vindo"; na mesma visita não pede para revisar os cartões recém-cadastrados nem abre o tour em seguida (o tour fica para a próxima entrada).
App:
- Boas-vindas com uma tela de apresentação (igual ao site); "Explorar sozinho" não abre mais o tour em seguida.
- Tour com frases curtas.
- Início: o número principal (Vai sobrar) vem antes da pergunta do fechamento, do convite de notificações e da novidade.
- Mais: o grupo Administração saiu da lista; fica só em Configurações > Administração.
Não conferido na tela: nada disto foi publicado. TypeScript sem erro nos dois projetos.
Não feito: revisão visual do app (sem prints); "confirmar de novo" fora do primeiro acesso, se houver, precisa de um exemplo do Matheus.


## Bloco 15/11/2026 (tarde): 8 itens do Matheus
1. Busca na Administração: site (índice com busca, aceita ?busca=) e app (campo em Configurações > Administração; sem resultado, procura no site).
2. IA escreve em português normal (primeira maiúscula, sem CAIXA ALTA, siglas mantidas): lib/texto-natural.ts no site, no app e na Edge Function lancamento-ia; regra também no prompt.
3. Cota padrão 64 MB: código (convites, cadastro livre, cadastro-app, oracle-admin, texto da Administração) e SQL que ajusta todos os grupos sem admin.
4. Virada até dia 31: em mês curto a virada cai no último dia (31 vira 30/nov e 28/fev). Site e app; SQL troca a restrição para 1 a 31.
5. Primeiro acesso do app: boas-vindas com perguntas que engajam; obrigatório antes do opcional (nome, e-mail, celular opcional); e-mail já cadastrado mostra Entrar e Esqueci minha senha na hora; objetivo saiu do cadastro e foi para a pesquisa pós-login com frases novas (garantia, parcelas, dívidas); login social abre por controlall.com.br/api/entrar-app; bloqueio escalonado (4 livres, depois 5, 10, 15, 30, 60 min) e senha nova libera na hora.
6. Atalho do iPhone: token pessoal em Configurações > Lançar sem abrir o app; POST /api/atalho com o texto, a IA lança a despesa ou receita.
7. Ocultar valores: telas do app remontam ao alternar; formatarValor mascara tudo (sobra, gráficos, listas).
8. Início do app mais limpo: previsão e simulador na aba Gráficos, parcelas e dívida em Gastos, botão Escolher o que aparece aqui, receitas e despesas maiores (22) e sobra 32; rótulo do ciclo igual ao do topo (Ciclo de novembro).
Não resolvido em código: 5.5 (Google parou dentro da página do Google, sem retorno ao servidor); site não confere o e-mail antes do fim do cadastro; limites, cartões, lista de compras, calendário e faturas não remontam ao ocultar (atualizam ao reabrir).
Publicar: SQL cota-64mb-e-virada-31, bloqueio-login-escalonado, atalho-lancamento; funções cadastro-app, lancamento-ia, login-seguro, recuperar-senha; site antes do app (17.10).

## Correções 15/11/2026 (noite)
- Site não publicou (Vercel falhou): lancamento-ia.functions.ts passou a exportar funções comuns que puxavam rate-limit.server para o navegador. Funções movidas para src/lib/lancamento-ia-nucleo.server.ts. Build local ok. Por isso /api/entrar-app e /api/atalho davam 404.
- Android sem atualizações desde 07/11: scripts/publicar-update.mjs publicava o Android com versionCode 5 fixo, mas a build Android instalada é de versionCode mais novo. O script agora descobre o versionCode certo de cada plataforma sozinho e não publica se não bater.
- Android, login com Google caía em "Unmatched Route" (controlall://auth-callback): criado app/+native-intent.tsx, que conclui o login e manda para o Início (também trata controlall://pluggy). Sessão aberta uma vez só em lib/retorno-login.ts.
- Item 6 nativo: atalhos ao segurar o ícone (iPhone e Android): Falar com a IA, Nova despesa, Nova receita (expo-quick-actions). Exige build nova: autorizada pelo Matheus em 15/11.

## Proposta Meu Extrato, executada (15/11/2026)
Decisões do Matheus: Receitas e Despesas continuam no menu; saúde com 5 pilares; mapa em anéis.
1. Tour com destaque: site com anel azul e caixa "N DE 6" no Início (driver.js, TourGuiado.tsx + styles.css), tocar no item avança, Ajuda > "Ver o tour do Início de novo". App: mesmo visual no tour existente e toque no alvo avança.
2. Novo lançamento: IA no topo e Entrada, Gasto, Conta fixa, Guardar (site no botão Lançar; app na tela +). Frase de quando sai do saldo (vencimentoDaCompra em numeros-ciclo.ts, site e app).
3. Mapa em anéis: lib/aneis-gastos.ts idêntico; Para onde vai no site e no app; compara com o ciclo anterior; valores ocultos mostram só %.
4. Extrato por dia: aba "Por dia" na Agenda (site e app), com entrou, saiu e saldo do ciclo; avisa o dia em que fica negativo. serie de numeros-ciclo ganhou entrou e saiu.
5. Saúde financeira 0 a 100: lib/saude-financeira.ts idêntico, 5 pilares de 20; cartão no Início (site coluna direita, app aba Resumo) e detalhe (site janela, app Mais > saude). Conquistas Saúde boa (60) e Saúde ótima (80) pela melhor nota (não se perdem). SQL: docs/sql/2026-11-15-saude-financeira.sql.
6. Lançamentos: site ganhou /lancamentos (busca, filtros, seleção, Excluir selecionados, Desfazer 5 s, editar abre Despesas/Receitas com ?editar=). App: busca e filtros Todos, Cartão, Parcelados na aba Lançamentos.
7. Site logado com no máximo 1120 px e Início em duas colunas a partir de 1280 px.
Conferido: tsc sem erro nos dois, build do site ok, anti-travamento ok, cálculos testados (saúde, anéis, vencimento da fatura). Não conferido na tela.
Diferenças honestas: app não tem filtro "Contas fixas" na lista (o dado da lista não marca recorrência); "Três ciclos no verde" não entrou (precisaria guardar histórico).
