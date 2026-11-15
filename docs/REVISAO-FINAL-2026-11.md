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
| 5 | Gamificação leve e opcional (Minha jornada) | Código feito 15/11; falta rodar o SQL, publicar e validar na tela |
| 6 | Administração: botão Resetar conta de teste | Publicado 14/11 (SQL rodado); falta o Matheus testar um reset |
| 7 | Fechamento para as lojas: acessibilidade, iPad, Android, prints, textos da loja, build final | Pendente |

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
