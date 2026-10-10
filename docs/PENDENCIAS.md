# Control ALL — Documentação de Entregas e Pendências

> **Última atualização:** Outubro/2026 · Commit `c8ca3f8`  
> **Repositório:** `mbdomatheus-a11y/gm-financas`  
> **Branch ativa:** `main` (hospedagem oficial: Vercel; o Lovable NÃO é mais usado e deve permanecer desconectado do repositório)  
> **Testes:** 307 passando (0 falhas) · `bun test`

---

## 🏆 Resumo das Funcionalidades Concluídas (Outubro/2026)

### 1. Onboarding Multi-Etapas & Sem Exigência de CPF
- **Remoção de Burocracia**: CPF removido do cadastro inicial. O usuário agora cria a conta apenas com Nome, E-mail, Senha e opcionalmente Telefone brasileiro (`+55`).
- **Etapa de Objetivos Principais**: Cards visuais selecionáveis com balão de fala assistente:
  - 💳 *Sair das dívidas* (Preciso de ajuda para economizar)
  - 📋 *Assumir o controle* (Não tenho visibilidade dos meus gastos)
  - 🍯 *Quero dicas para economizar* (Encontrar coisas mais em conta no dia a dia)
  - 📈 *Começar a investir* (Estou me organizando e quero ajuda para investir)
- **Checklist Visual de Senha em Tempo Real**: Feedback interativo para 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial e mínimo 8 caracteres.
- **Confirmação Dinâmica de Senha**: Validação em tempo real com alerta em vermelho caso haja divergência e confirmação em verde.
- **Liberação de Cadastro Livre**:
  - Migration `20261004200000_cadastro_livre_habilitado_default.sql` criada garantindo `cadastro_livre_habilitado = true` por padrão.
  - Correção na server function `convites-livres.functions.ts` apontando para a tabela correta `configuracoes_acesso_site`.
  - Remoção de qualquer bloqueio: o usuário sem código avança livremente para o app com grupo próprio isolado.

### 2. Login Social OAuth (Google & Microsoft)
- **Componente Oficial**: `src/components/SocialAuthButtons.tsx` integrado na página de login e cadastro.
- **Google & Microsoft**: Fluxo OAuth via `supabase.auth.signInWithOAuth` com tratamento amigável caso o provedor ainda não tenha sido ativado no painel.
- **Remoção do Apple OAuth**: Como o Sign in with Apple para web exige conta de desenvolvedor paga de US$ 99/ano na Apple, o botão foi desativado temporariamente para focar nas soluções 100% gratuitas.
- **Provisão Automática OAuth**: Server function `garantirPerfilUsuarioOAuth` detecta primeiro login social e gera automaticamente grupo, perfil e papéis de permissão.

### 3. Nova Funcionalidade "Convide seus amigos"
- **Banner Premium**: `src/components/ConviteAmigosBanner.tsx` com gradiente ciano/turquesa e chamada amigável (*"Convide seus amigos: E ajude sua galera a controlar a vida financeira também :)"*).
- **Modal Completo de Compartilhamento**:
  - Cópia do link de convite em 1 clique (`/entrar?convite=XXXX`).
  - Botão de envio rápido para o **WhatsApp** com texto convidativo pré-formatado.
  - Contador de cotas disponíveis e lista de amigos que já criaram conta.
- Integrado no topo da página **Minha Conta** (`src/routes/_authenticated/conta.tsx`).

### 4. Home Page Focada no Lançamento Comercial
- **Proposta de Valor Clara**: Foco exclusivo nos dois produtos principais:
  1. **Finanças Pessoais Completas**: receitas, despesas fixas/variáveis, faturas de cartão, fluxo de caixa e alívio futuro de parcelamentos.
  2. **Notas Fiscais Inteligentes com IA & SEFAZ**: leitura de cupons fiscais via QR Code do SEFAZ, extração detalhada de itens com preços e guarda no Google Drive.
  3. **Calculadoras & Ferramentas Extras**: CLT x PJ, juros compostos e links temporários posicionados como bônus gratuitos de apoio.
- **Hero & Demonstração**: Visual com prévia de resumo financeiro do mês, alerta de cupom lido com IA e economia conquistada.

### 5. Gamificação Financeira na Lista de Compras
- **Hora Líquida Real**: Cálculo de valor hora baseado na receita líquida real dividida pela jornada de trabalho mensal cadastrada no perfil (`horas_trabalho_mes`).
- **Métricas por Item**: Cada produto da lista exibe quanto tempo de trabalho exige (em horas e minutos) e qual percentual consome da sobra livre do mês.
- **Filtro de Horizonte**: Abas para alternar entre itens de consumo imediato e objetivos de longo prazo.

### 6. Dashboard com Alívio de Parcelamentos e Sincronização
- **Caixa de Dívida Total em Aberto**: Sincronizada automaticamente com a data final do gráfico de evolução (`mesFimGrafico`), com opção de ajuste manual.
- **Card de Parcelas que Terminam**: Exibe quantas parcelas encerram no período e o valor de alívio mensal liberado, excluindo faturas manuais e considerando parcelas `N/N`.
- **Histórico de IA Limpável**: Histórico de resumos e lançamentos gerados por inteligência artificial com opção de limpeza pelo usuário.

### 7. Leitor Inteligente de Notas Fiscais SEFAZ
- Parser otimizado com dupla estratégia de leitura (`<tr>` e classes oficiais SEFAZ `txtTit`/`fixo-prod-desc-tot`), capturando com precisão os itens e valores do DANFE/NFC-e.

---

## 📌 Pendências e Próximos Passos Mapeados

### 1. Configuração de Credenciais OAuth no Supabase (Ação do Usuário)
* **Google Cloud Console**: O ID do cliente e Segredo do cliente foram explicados e aguardam serem colados no painel do Supabase (**Authentication → Providers → Google**).
* **Microsoft Azure / Entra ID**: O registro do aplicativo no locatário gratuito do Azure aguarda inserção no Supabase (**Authentication → Providers → Azure**).
* **Apple OAuth**: Mantido em espera até futura assinatura do Apple Developer Program ($99/ano).

### 2. Notificações em Tempo Real no Painel Admin
* **Situação**: Quando um usuário envia uma fatura para modelagem, o admin recebe e-mail, mas não recebe toast ou badge em tempo real enquanto estiver na tela.
* **Solução**: Implementar `supabase.channel()` ou polling leve na rota `administracao.tsx`.

### 3. Registro de IP e Localização nos Logs de Auditoria
* **Situação**: A interface de logs possui colunas preparadas para IP e Cidade, mas as server functions ainda não capturam `x-forwarded-for`.
* **Solução**: Utilizar `getWebRequest()` do `@tanstack/react-start/server` para preencher o IP no objeto de detalhes do log.

### 4. Roadmap de Importação Inteligente (Etapas 5 a 9)
* **Etapa 5**: Revisão compacta em etapas antes da gravação definitiva.
* **Etapa 6**: Gestão avançada de cartões, categorias e rascunhos.
* **Etapa 7**: Gravação atômica com validação estrita contra duplicidades de lançamentos.
* **Etapa 8**: Aprendizado supervisionado de categorias por histórico de usuário.
* **Etapa 9**: Validação de regressão completa.

### 5. Dependências Externas Pré-existentes de Tipagem
* `driver.js`: Pacote tipado para o Tour Guiado pós-boas-vindas (`src/components/TourGuiado.tsx`).
* `@aws-sdk/client-s3`: Tipos auxiliares para armazenamento em Oracle Storage (`src/server/oracle-storage.server.ts`).

---

## 📁 Principais Arquivos Modificados / Criados

| Arquivo | Descrição das Modificações |
|---|---|
| [`src/routes/entrar.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/entrar.tsx) | Onboarding interativo, metas/objetivos, checklist visual de senha, cadastro livre sem bloqueio |
| [`src/routes/index.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/index.tsx) | Redesenho da Home Page focada no lançamento de Finanças + Notas com IA e Calculadoras extras |
| [`src/components/ConviteAmigosBanner.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/components/ConviteAmigosBanner.tsx) | ✨ NOVO: Banner ciano/turquesa e modal de convite com link em 1 clique e WhatsApp |
| [`src/components/SocialAuthButtons.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/components/SocialAuthButtons.tsx) | Botões Google e Microsoft, remoção da Apple e tratamento amigável de status |
| [`src/lib/convites-livres.functions.ts`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/lib/convites-livres.functions.ts) | Correção da tabela de acesso e cadastro sem convite sem exigência de CPF |
| [`src/lib/configuracoes-site.functions.ts`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/lib/configuracoes-site.functions.ts) | Default `cadastro_livre_habilitado = true` para evitar bloqueios acidentais |
| [`src/routes/_authenticated/conta.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/_authenticated/conta.tsx) | Inclusão do Banner Convide seus amigos e edição de CPF e horas de trabalho |
| [`src/routes/_authenticated/lista-compras.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/_authenticated/lista-compras.tsx) | Gamificação financeira completa (cálculo de hora líquida e impacto da compra) |
| [`src/routes/_authenticated/dashboard.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/_authenticated/dashboard.tsx) | 6 cards superiores, sincronização de dívida e alívio de parcelas terminando |
| [`supabase/migrations/20261004200000_cadastro_livre_habilitado_default.sql`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/supabase/migrations/20261004200000_cadastro_livre_habilitado_default.sql) | ✨ Migration garantindo coluna e valor default `true` no banco |

---

## Sessão 2026-10-04: plano de isolamento, onboarding e gamificação (documentado ANTES de executar)

### Diagnóstico (Claude Cowork, leitura de repo, banco ao vivo e Obsidian)
- O commit 61464c6 citado no resumo do Antigravity NÃO existe. HEAD real: 61ec4d1 (03/10), já no origin/main.
- Trabalho NÃO commitado: login social (SocialAuthButtons.tsx), CPF opcional (convites.functions.ts, entrar.tsx, EntrarForm.tsx, seguranca-conta.functions.ts), banner Convide amigos (conta.tsx), gamificação na lista (lista-compras.tsx), migration 20261003180000_cpf_opcional_profiles.sql. A migration 20261004200000 citada no resumo não existe no disco.
- Mais de 100 arquivos aparecem modificados apenas por fim de linha CRLF/LF. Não commitar esse ruído.
- RLS ao vivo: tabelas financeiras já usam grupo_id = private.meu_grupo_id(). Nenhuma policy ativa usa is_active_member(), então recriar essas policies não é necessário.
- Furos reais de isolamento: comprovantes e parcela_auditoria só exigem meu_grupo_id() IS NOT NULL (qualquer usuário logado lê todos os grupos).
- Provável causa de "vi as coisas do admin": a conta de teste 4633c0fa (guilhermeferres@gmail.com) é antiga (14/09) e está no grupo do admin master (00000000-0000-0000-0000-000000000001).
- Pedidos abertos: aterrissagem indo para Administração (suspeita: control-all-return-url no sessionStorage), cota inicial deve ser 0 de 512 MB (aparecia 7 de 1024), tour não aparece para novo usuário (incluir lançar receita e despesa), gamificação no início alimentada por perguntas, alerta da calculadora ligável pelo admin, alertas do admin vazando para outros usuários (auditar).

### Ordem de execução
1. Segurança (policies, alertas/avisos do admin, conta 4633c0fa), 2. cota + aterrissagem + tour, 3. gamificação + toggle do alerta da calculadora, 4. verificação, commit limpo e documentação final.
Regra do projeto: tudo que for feito é registrado aqui e em docs/PENDENCIAS.md.

### Execução 2026-10-04 (resultado)
Banco de produção (Supabase wjapagkdgjlavonbmjdu):
- Criadas policies por grupo comprovantes_grupo e parcela_auditoria_grupo (migration 20261004210000). PENDENTE: o MCP não executa DROP POLICY sem confirmação do usuário (timeout). As policies antigas comprovantes_membro_ativo e parcela_auditoria_membro_ativo continuam existindo e mantêm o furo até serem removidas manualmente no SQL Editor: DROP POLICY comprovantes_membro_ativo ON public.comprovantes; DROP POLICY parcela_auditoria_membro_ativo ON public.parcela_auditoria;
- Conta de teste 4633c0fa (guilhermeferres@gmail.com) estava dentro do grupo master 00000000-...-0001 e por isso via dados, cota 1 GB e uso do admin. Movida para grupo próprio f8f367ed-e939-43f7-843f-56ce8bd763f4 (512 MB, 0 usado).
- Cota padrão de grupo novo agora 512 MB (default da coluna, migration 20261004220000, e insert explícito em convites.functions.ts e seguranca-conta.functions.ts). oracle-admin.functions.ts usa 512 MB por membro ao habilitar.
- A migration 20261003180000 (CPF opcional, horas_trabalho_mes, valor_estimado, horizonte) NUNCA tinha sido aplicada em produção; as colunas e o DROP NOT NULL do cpf foram aplicados agora (consolidado em 20261004230000). Não foi removida a constraint profiles_cpf_key (DROP gated); como NULL é permitido em UNIQUE, não impede cadastro sem CPF.
Código:
- Aterrissagem: novo src/lib/return-url.ts (rotas restritas nunca são lembradas; chave limpa no logout, inatividade e após uso; usuário novo sempre vai para a tela de abertura do admin). Causa: AppLayout gravava qualquer rota (inclusive /administracao) em sessionStorage e nunca apagava.
- Alertas: aviso "Nova versão publicada" e botão "Limpar versões para todos" agora só para site admin (antes qualquer admin de grupo, inclusive todo usuário novo, via papel admin do grupo). limparVersoesSite exige site_admins.
- Tour: passo inicial de boas-vindas; só marca como concluído quando a pessoa fecha ou conclui (antes onDestroyed marcava concluído até quando o tour quebrava, e o usuário novo nunca via). Para reexibir a quem já "concluiu", usar Administração > Avisos > reenviar tour.
- Gamificação: card "Quanto vale o seu tempo" no Início, alimentado por 3 perguntas (renda líquida, horas/mês, contas fixas) gravadas por salvarPerfilFinanceiro em profiles; Lista de compras mostra total pendente em horas de trabalho e % da sobra. Novas colunas: renda_liquida_informada, compromissos_fixos_informados, perfil_financeiro_respondido_em.
- Corrigido conta.tsx (declarações duplicadas de estado que quebravam o tsc); tsc limpo.
Pendente de decisão: qual é o "alerta da calculadora" a ser ligado/desligado pelo admin (único candidato no código: aviso de uso acadêmico do Simulador de dose/diluição).
Pendente de teste manual: login com usuário realmente novo no domínio de produção.

### Incidente 2026-10-05: bot do Lovable sobrescreveu a main
- Em 05/10 02:11 UTC o app gpt-engineer-app[bot] (Lovable, ainda conectado ao GitHub) publicou 7 commits; o último (be1c2f8, "Fixed build and updated deps") apagou 143 arquivos (AlertsBell, EntrarForm, SocialAuthButtons, docs, vercel.json, migrations 20260926 a 20261002...) e adicionou um .env (apenas URL e chave pública do Supabase) removendo linhas do .gitignore.
- Decisão: não integrar os commits do bot. O trabalho desta sessão foi refeito em cima de 61464c6 (último commit real do Matheus) e a main será atualizada com force-with-lease, com o OK explícito do Matheus. Backup do trabalho antigo: branch local backup-local-5573e7f.
- Ação do Matheus: desconectar o app do Lovable do repositório (GitHub > Settings > Integrations) para não repetir.

### Correção 2026-10-05: "duplicate key value violates unique constraint profiles_pkey" no cadastro sem convite
- Causa: o gatilho on_auth_user_created (handle_new_user) já cria a linha em profiles quando o usuário de autenticação é criado; src/lib/convites-livres.functions.ts (usado por entrar.tsx) fazia insert puro em profiles. Além disso, os passos 7 e 8 usavam colunas inexistentes (user_roles.grupo_id e aceites_documentos.versao_termos/versao_privacidade) e falhavam em silêncio, deixando o usuário sem papel de admin e sem aceite dos termos.
- Correção: upsert em profiles (ativo true, senha_temporaria false, cpf nulo se vazio), papel admin via upsert em user_roles, aceites com as colunas documento/versao, limpeza do grupo e do usuário de autenticação se algo falhar, cota explícita de 512 MB no grupo.
- Resíduo: grupo órfão "Marcus's Group" (0 membros, criado na tentativa que falhou) em produção; pode ser apagado.

---

## Sessão 2026-10-05: lote de 19 melhorias (plano documentado ANTES de executar)
Pedidos do Matheus (resumo final deve sair como checklist para conferência 1 a 1):
1. Tela de login: botões Google/Microsoft duplicados (aparecem em "Entrar com" e "Continuar com").
2. Parcelamentos que terminam (e Despesas): seleção de itens com soma automática.
3. De-Para de categorias: modelo Excel/TXT para baixar e subir.
4. Categorias: baixar sugestão completa do site em Excel/TXT, editar e subir.
5. Log de tentativas de login: registrar toda falha (mesmo 1), com IP, local, dados digitados (sem senha) e motivo (usuário não cadastrado, senha incorreta).
6. Telas de log: limite visual, agrupar o resto, exportar Excel e TXT.
7. Botão Lançar com IA só no módulo Finanças.
8. Áudio para pedir resumo do mês e fazer contas.
9. Backup e Reset: botão excluir conta no admin, padronizando com a conta do usuário (admin vê tudo do usuário e mais).
10. Gráficos: lembrar última opção, padrão mês anterior + 5 próximos, destaque do mês atual, valores abreviados nos pontos (21,8K) e valor detalhado no hover.
11. Educação financeira no site, para todas as idades.
12. Lista de compras: abrir em tela cheia pedindo as 3 respostas; se pular, salvar e manter como hoje.
13. Preferência "Destaque do módulo Veículo" só aparece se o módulo estiver ativo; admin vê tudo que o usuário vê.
14. Após 3 dias de uso: pop-up de convite na abertura e atalho de convidar ao lado do sino.
15. Botão Sair disponível em todas as telas.
16. Compartilhar: botão convidar amigos enquanto houver convites; ocultar quando acabarem.
17. Banner de aviso ao entrar na calculadora, com liga/desliga no admin.
18. Calculadora simples flutuante em todas as telas, com copiar valor.
19. Nova nota: vincular cartão de crédito ou conta usada na compra.
Resolvido: o "alerta da calculadora" pendente é o banner do item 17.
Ordem: login/sair/segurança (1, 5, 6, 15), finanças (7, 10, 2, 3, 4, 19), onboarding/engajamento (12, 14, 16, 11), admin (9, 13, 17), extras (8, 18).

### Resultado da execução dos 19 itens (2026-10-05)

Tudo abaixo passou no `tsc` sem erros. Colunas e tabela novas já aplicadas em produção (SQL aditivo) e registradas em `supabase/migrations/20261005240000_lote_19_itens.sql`.

1. Login: removido o segundo bloco de botões Google/Microsoft (`EntrarForm.tsx`).
2. Soma de parcelamentos: caixas de seleção no card "Parcelamentos que terminam" (Dashboard) e botão "Somar itens" em Despesas, soma na hora, nada é salvo.
3. De-Para: modelos Excel, TXT e CSV para baixar; envio aceita .xlsx, .csv e .txt (`depara.ts`, `de-para.tsx`).
4. Categorias: baixar lista sugerida completa e as minhas (Excel e TXT) e enviar o arquivo editado; só cria as que não existem (`categorias-planilha.ts`, `categorias.tsx`).
5. Log de falhas de login: tabela `login_falhas_log` com identificador digitado (sem senha), IP, cidade, região, país, motivo (usuário não cadastrado, senha incorreta, bloqueio etc.); card no admin.
6. Logs com limite visual: `LogPainel` (15 visíveis, resto agrupado por dia, exportar Excel e TXT) em login, log administrativo e histórico de avisos.
7. "Lançar com IA" só aparece nas telas do módulo Finanças (`AppLayout.tsx`).
8. Áudio: botão "Gravar pergunta" na aba de resumo/cálculos do Lançar com IA.
9. Excluir conta: novo componente `ExcluirContaCard` em Conta e em Backup e Reset (admin do site continua bloqueado de se excluir).
10. Gráficos: padrão "mês anterior + próximos 5", última escolha salva (localStorage), mês atual destacado, rótulos abreviados (21,8K) e valor completo no mouse.
11. Educação financeira para todas as idades: card no Início (`EducacaoFinanceira.tsx`).
12. Lista de compras: tela cheia pedindo as 3 perguntas; "Não responder" grava `profiles.perfil_financeiro_pulado_em` e a tela não volta.
13. Destaque do Veículo na Conta só aparece com o módulo Veículo ativo.
14. Convite após 3 dias de uso (popup na abertura, adiável por 7 dias) e botão de convite ao lado do sino.
15. Botão Sair no cabeçalho de todas as telas (inclusive nova-senha).
16. Compartilhar: botão "Convidar amigos" enquanto houver convites.
17. Aviso da calculadora com liga/desliga na Administração (`configuracoes_acesso_site.exibir_aviso_calculadora`).
18. Calculadora rápida no cabeçalho, sem `eval`, com copiar valor.
19. Nova nota: campo "Cartão ou conta usada na compra" (`notas_fiscais.pagamento_tipo/pagamento_id`).

Pendências do usuário: dar push dos commits, rodar os dois DROP POLICY no SQL Editor (comprovantes_membro_ativo e parcela_auditoria_membro_ativo), desconectar o Lovable do GitHub, testar com usuário novo.

### Ajustes pós-teste e Calendário (2026-10-06)

Retorno do usuário sobre os 19 itens e o que foi feito:
- Item 2: caixa de seleção também no cabeçalho de cada mês (seleciona tudo do mês) em "Parcelamentos que terminam"; Despesas e Receitas agora têm caixas sempre visíveis, "selecionar todos" por grupo e barra fixa com a soma (`BarraSoma.tsx`).
- Item 3: botões de modelo (Excel, TXT, CSV) movidos para logo abaixo da área de envio do De-Para; campo e colunas renomeados para "Estabelecimento".
- Item 5: "senha incorreta" era gravada como "usuário não cadastrado" quando o perfil não tinha e-mail; agora consulta também o CPF e o Auth (função `usuario_auth_por_email`, só service role).
- Item 11: educação financeira saiu da Início logada e foi para a home pública (seção antes de Preços).
- Item 16: Compartilhar volta a usar o banner verde/ciano de convite, que some quando os convites acabam.
- Item 19 (novo pedido): página Calendário (`/calendario`, menu e Início) com faturas por cartão no dia de vencimento com total, notas lançadas, fim de garantia e itens aprovados da lista; navegação por mês, filtros por tipo, edição de datas e valor da nota, data prevista da lista e marcar como comprado.
- Referência de layout (contasonline.com.br): registrada, ainda não aplicada; aguardando definição de qual tela.

### Visual renovado (2026-10-06)
Atualização de estilo global sem mudar funcionalidades: fundo "aurora" suave, raios maiores, cartões com sombra em camadas, botões com gradiente da cor da marca e foco visível, cabeçalho e barra inferior em vidro, item ativo do menu com marcador lateral, tipografia com números alinhados, hero da home com luzes de fundo e cartão inclinado, efeito de elevação nos cartões de módulos. Refeito a partir de tokens em `styles.css` e dos componentes `card` e `button`, então vale para todas as telas e respeita as paletas da Personalização.

### Rodada 3: home honesta, menu sem duplicidade, calendário anual, assistente de IA, admin agrupada (2026-10-06)
- Home: textos revisados para o que o site realmente faz (sem "QR Code do SEFAZ com IA", sem Google Drive, sem "Bônus Gratuito", sem "IA que poupa horas"). Cabeçalho com todos os links funcionando (Recursos, Módulos, Calculadoras, Link temporário, Demonstração, Preços, Termos, Privacidade) e menu móvel. Ilustrações em SVG (família com criança, notas e garantia, calendário). Vídeo de demonstração mantido (slot `site_videos`). Patrocinado virou popup separado. Preços: cartão estático "Gratuito" (o editor de preços da administração não é mais usado pela home).
- Navegação logada sem duplicidade: uma sidebar (Início, Calendário, Módulos com o atual expandido, Geral, Administração só para admin) no desktop; no celular, barra inferior com Início, Agenda, módulo atual e Menu (abre a mesma sidebar). Removidos o botão hambúrguer, as pílulas de módulos no topo e o Sair duplicado da sidebar. Calendário e Calculadora ficam como botões no cabeçalho.
- Calendário: visão "Ano (12 meses)" com pontinhos coloridos nos dias com evento, contador por mês; clicar no mês abre o mês, clicar no dia abre o dia.
- Compartilhar > Resumo inteligente: "Assistente pessoal (IA)" com revisão do mês, perguntas rápidas e campo livre. Contexto novo enviado à IA: média por categoria dos 3 meses anteriores e lançamentos em aberto. Respeita modo de IA e cota diária, dados só do próprio usuário. A IA pode errar.
- Administração: 10 abas agrupadas em 5 grupos (Visão geral, Pessoas e pedidos, Site e módulos, Armazenamento, Segurança). Conteúdo das abas inalterado.

### Ajustes pós-rodada 3 (2026-10-06)
- Patrocinado: voltou como bloco visível logo abaixo do topo da home (além do popup, que abre uma vez por visita).
- Aviso da calculadora: a leitura agora é POST e sem cache e sempre revalida ao abrir a tela. No banco o aviso já estava desligado; se ainda aparecer, o deploy em produção está sem a versão nova (falta push).
- Resumo inteligente: o pedido de revisão completa passava de 500 caracteres; encurtado (cerca de 330).
- Sidebar: tagline "Você no controle de tudo" abaixo do nome; botão Sair só na sidebar (e no Menu do celular), removido do cabeçalho.
- Ocultar valores: agora mascara todo texto com R$, US$ ou € em qualquer página (hook `useMascaraValores`, no AppLayout), persiste no navegador, e o botão fica destacado ("Mostrar valores") enquanto oculto. Campos de digitação não são mascarados. O olho individual por cartão só vale com o global desligado.
- Criar conta: removido "QR Code do SEFAZ com IA"; texto agora fala em QR Code ou chave de acesso. Mensagem de convite sem "com IA".
- Home: módulos não habilitados no site (lidos de `modulos_globais`, função pública `listarModulosPublicos`) aparecem esmaecidos com selo "Em breve" e "Lançamento em breve".
- Home: cartão 'Exemplo ilustrativo' agora fixo (sem inclinação/movimento), com aviso de garantia e lista 'Seus módulos' (Em breve nos não habilitados).

### Rodada 4 (2026-10-06)
Pedido do usuário (11 itens) e o que foi feito:
1. Patrocinado: popup removido (aparecia em tela cheia); fica só o bloco discreto na home.
2. Log de acessos: tabela `acessos_site_log` (IP, cidade/UF/país pelos cabeçalhos da Vercel, origem UTM/referrer, aparelho, sessão), gravada por `RastreadorAcessos` no root; admin > Visão geral > "Acessos ao site" com períodos 7/30/90 dias, ranking de origens, locais, páginas e aparelhos, gráfico por dia e registro detalhado exportável. Aviso de Privacidade atualizado. Dica: divulgue com `?utm_source=...&utm_medium=...&utm_campaign=...`.
3. Login só e-mail: não reproduzido (config no banco é "ambos" e o formulário mostra "E-mail ou CPF" nesse caso). Pendente de print/ajuste fino.
4. Ocultar valores em gráficos: máscara agora cobre eixos, rótulos, legendas e tooltips do recharts.
5. Admin > Site e módulos > "Categorias e De-para": tabelas `categorias_padrao` e `depara_padrao` (admin adiciona/remove). Categorias padrão alimentam a lista sugerida, subcategorias da importação e o guia de primeira categoria; de-para padrão entra na importação com prioridade baixa (regras do usuário vencem).
6. Primeiro lançamento: aviso "Criar categoria" na própria tela (IA, nova despesa, nova receita, importação) quando o usuário não tem categoria; cria a partir das sugestões ou digitando.
7. Início do usuário mostra módulos não liberados bloqueados com "Em breve" (admin sempre vê tudo liberado).
8. Módulo Calculadora virou "Utilidades" (calculadoras + link temporário).
9. Suporte: nova opção "Dúvida" (constraint do banco atualizada).
10. Importar fatura: na primeira visita, pergunta "Importar sua primeira fatura?" (uma vez por usuário).
11. Open Finance: apenas comparativo de alternativas (nada implementado).
Migração: supabase/migrations/20261006120000_rodada4.sql (aplicada em produção).

### Rodada 5 (2026-10-07)
1. Login: removida a escrita "ou CPF" (rótulo "E-mail", placeholder, "Lembrar e-mail"). O CPF continua funcionando por trás.
2. Backup e Reset aparece em Geral para todos os usuários.
3. Erro `categorias_nome_tipo_key`: a unicidade era GLOBAL (um usuário bloqueava o nome do outro). Agora é por grupo (categorias, cartao_vinculos, notas_fiscais). `fatura_layouts_assinatura_key` segue global (conferir). Guia de categoria filtra nomes já existentes e avisa que dá para adicionar, editar e remover depois.
4. De-para: aviso na primeira visita explicando que as regras categorizam a importação da fatura; exemplo do campo Estabelecimento reduzido.
5. Categorias: modelo Excel/TXT também para receitas.
6. Dados de exemplo para contas NOVAS (criadas a partir de 2026-10-06, grupo totalmente vazio): 9 categorias amplas de despesa, 3 de receita, receitas "Vale dia 15", "Salário dia 30" e "Renda extra", Cartão Exemplo (final 0000), Investimento de teste. Marcados como exemplo; botão "Remover exemplos agora" na mensagem de boas-vindas. Tabela `dados_exemplo_semeados`, função `semearDadosExemplo`, componente `BoasVindasExemplos`. Migração 20261007110000.
7. Meu grupo compartilhado: aviso de que o convidado vê TODOS os dados da conta principal (só pessoas de confiança). Dono do grupo ou admin do site podem revogar o acesso (cria um grupo novo para a pessoa).
8. Botão grande "+ Lançar": pergunta Despesa ou Receita, mantém "Lançar com IA".
9. Aviso da calculadora removido por completo (tela e toggle do admin). Arquivos aviso-calculadora.functions.ts e AvisoCalculadoraAdminCard.tsx ficaram sem uso.
10. Notificações: histórico de 7 dias; ao abrir o sino as novas viram lidas e somem, só reaparecem se chegar nova.
11. Botões: hover mais azul-claro e halo amarelo discreto animado (respeita "reduzir movimento").
12. Mobile: cabeçalho enxuto (Calendário e Convite saem do topo no celular, a Agenda está na barra inferior), botão Lançar acima da barra inferior, campos com 16px (sem zoom no iPhone).
13. Análise de módulos: apenas relatório enviado, aguardando validação do usuário.
Pendências manuais: git push origin main; DROP POLICY comprovantes_membro_ativo e parcela_auditoria_membro_ativo; desconectar Lovable do GitHub; testar com usuário novo.

14. Bloco "Em breve: um novo app para você" (App Store e Google Play, sem links) na home pública, acima do rodapé, e no rodapé de toda a área logada (inclui Início). Componente AppEmBreve.

### Correção urgente: cadastro por Google/Microsoft (2026-10-07)
- Causa 1 (Google): o gatilho handle_new_user criava só um perfil "casca" (nome "Usuário", sem grupo, sem papel, senha_temporaria=true). A função garantirPerfilUsuarioOAuth saía cedo porque o perfil já existia, então o grupo nunca era criado. Resultado: conta sem acesso a nada (RLS por grupo). Afetou 2 contas Google de hoje (reparadas no banco).
- Correção: gatilho agora completa contas sociais (grupo, perfil, papel admin, aceite dos termos); garantirPerfilUsuarioOAuth passa a reparar perfil sem grupo; texto de concordância nos botões sociais. Migração 20261007150000.
- Causa 2 (Microsoft): erro "Unable to exchange external code: 1.AS..." vem do Azure/Supabase (configuração do provedor), não do código. Verificar no Supabase Auth > Providers > Azure: Client ID, Client Secret (usar o VALOR do segredo, não o ID, e checar validade), URL do tenant ("common" para contas pessoais e corporativas) e Redirect URI https://wjapagkdgjlavonbmjdu.supabase.co/auth/v1/callback no app registrado no Azure.
- artfoxbrasil@gmail.com: conta por e-mail sem grupo e sem login (provável teste criado pelo admin); não alterada.

- Navegador embutido (Instagram/Facebook/TikTok): o Google bloqueia login social nesses navegadores; aviso adicionado nos botões sociais para abrir no Chrome/Safari.

### E-mail de redefinição de senha não chega (2026-10-07)
- Diagnóstico: o token é criado no banco (ex.: terezinha.fbc, 07/10 17:07), então o fluxo roda até o envio; o e-mail não sai pelo Resend. Provável causa: RESEND_FROM_EMAIL ausente na Vercel (cai em onboarding@resend.dev, que só entrega para o dono da conta Resend) ou domínio não verificado no Resend, ou RESEND_API_KEY ausente.
- Código: a falha de envio antes era ignorada; agora é registrada em admin_audit_logs (acao email_recuperacao_senha_falhou, com o erro) e no log do servidor. Busca do usuário passou a usar profiles (listUsers só olhava 50 usuários).
- Ação manual: verificar domínio controlall.com.br em Resend > Domains (registros DNS SPF/DKIM) e definir na Vercel RESEND_FROM_EMAIL="Control ALL <avisos@controlall.com.br>", RESEND_API_KEY e SITE_URL; redeploy.

### Convite para o grupo compartilhado (2026-10-07)
- Causa do "o destinatário precisa ter uma conta ativa": 3 perfis antigos estavam com e-mail vazio (mwathews@hotmail.com, guilhermeferres@gmail.com, artfoxbrasil@gmail.com) e a busca do convite olhava só profiles.email. Backfill feito (migração 20261007160000) e a busca agora também confere na autenticação, escapa curingas e bloqueia convidar a si mesmo.
- Se o e-mail do convite não puder ser enviado (Resend), o convite fica criado e o link é copiado para o dono enviar por outro meio (7 dias de validade). Antes dava erro e o link se perdia.
- Aceite: o RPC aceitar_convite_grupo exige que o e-mail logado seja o do convite e que o grupo atual de quem aceita não tenha outros integrantes; os dados de quem aceita migram para o grupo de quem convidou.

## Convite de grupo com aceite e workspace secundário (2026-10-07)
- Aceite agora é NÃO destrutivo: nada é movido nem apagado. `profiles.grupo_secundario_id` guarda o workspace original (backup intacto) enquanto `grupo_id` aponta ao grupo de quem convidou.
- Funções SQL: `aceitar_convite_grupo_id`, `aceitar_convite_grupo(token)`, `recusar_convite_grupo`, `sair_do_grupo`, `revogar_membro_grupo` (service_role). Trigger `proteger_identidade_perfil` agora libera mudança de grupo só via flag `app.mudanca_grupo` e protege `grupo_secundario_id`.
- Corrigido: o trigger antigo bloqueava a troca de grupo dentro da função de aceite.
- Notificação in-app: aviso no topo do app com Aceitar/Recusar (`ConvitesRecebidosAviso`), além do e-mail.
- Sair do grupo ou revogação pelo dono restauram o workspace original (ou criam um novo se não houver backup).
- Histórico de convites (pendente, aceito, recusado, revogado, expirado) em Minha conta, com exclusão definitiva do registro (não altera acesso nem dados). Status `revogado` adicionado.
- Decisão do backup: ele permanece até o usuário sair do grupo; não há opção de descartar o backup (a validar).
- Testar de ponta a ponta: convidar conta existente, aceitar, conferir dados, sair do grupo.

## Prazo do link de redefinição de senha (2026-10-08)
- Prazo reduzido de 30 para 10 minutos; a expiração já era validada no servidor ao usar o link. Novo pedido invalida links anteriores não usados.

## Favicon para o Google (2026-10-08)
- O Google não executa o JS do `DynamicFavicon`; ele lê o `<link rel="icon">` estático. O `favicon.ico` antigo era a logo velha.
- Gerados `public/favicon-48.png` e `public/favicon.ico` (16/32/48) a partir da logo atual (identidade_visual_site.logo_path) e declarados no head do `__root.tsx`.
- Se a logo for trocada de novo pelo admin, os arquivos estáticos precisam ser regerados (o Google só vê o estático). Atualização no Google leva dias a semanas.

## Links do admin + módulo "Links" (2026-10-08)
- Nova tabela `links_admin` (título até 120, conteúdo até 100.000, tipo temporário/permanente, expira_em, arquivado). RLS ligada e sem policies: acesso só por funções de servidor (`src/lib/links-admin.functions.ts`).
- Aba "Links" em Administração (grupo "Site e módulos"): criar (título + conteúdo com formatação básica), tipo permanente ou temporário com data e hora escolhidas, editar, arquivar/desarquivar e excluir. Ao salvar, o link `/links/<id>` é gerado e copiado.
- Formatação básica sem HTML (`TextoFormatado`): **negrito**, *itálico*, [texto](https://link), "# título", "- lista".
- Quem abre o link: qualquer usuário LOGADO (se não estiver, o login volta para o link via `next`). Arquivado só o admin vê; temporário expirado mostra "Este link expirou".
- Módulo `links` em `modulos_globais`, nasce DESLIGADO. Usuários comuns só veem a lista (`/links`) quando o módulo for ligado; só o admin cria/edita/arquiva/exclui. Admin sempre vê o módulo.
- A ferramenta pública "Link temporário" (`/links-temporarios`) foi mantida como está (decisão do dono).
- `routeTree.gen.ts` regenerado com o gerador do TanStack (mantido o bloco `Register` no final).
- Não testado com login real: testar criar, abrir logado e deslogado, expirar, arquivar, excluir, e ligar o módulo para ver a lista como usuário comum.

## Links como "anotações": tela própria, histórico e unificar (2026-10-08)
- Correção de termo: o que o módulo Links guarda são ANOTAÇÕES com link, não notas. O módulo de notas fiscais não foi alterado.
- A criação/edição/arquivamento/exclusão saiu da Administração e foi para a tela `/links` (só o admin do site vê o painel). Usuários comuns veem só a lista de leitura quando o módulo estiver ligado.
- Administração, aba "Links": agora só tem o interruptor "Habilitar para os outros usuários" (`LinksAdminHabilitar`, usa `adminSalvarModulo`).
- `/links` (admin): abas "Anotações ativas" e "Histórico" (todas, com data, arquivadas e expiradas), botão "Incluir anotação" e "Unificar selecionadas".
- Unificar (`adminUnificarLinks`): junta 2 a 30 anotações em uma nova permanente, em ordem de criação, cada uma com seu título como "# título", separadas por "---". Limite de 100.000 caracteres. As originais são arquivadas (não apagadas).
- Card "Links" na Início (admin): atalhos "Incluir" e "Ver histórico". Usuários comuns veem o card normal (quando o módulo estiver ligado).
- Pendente: testar com login real; avaliar renomear o módulo de "Links" para "Anotações" se preferir.

## PWA instalável + ponto de restauração (2026-10-09)

- Criados `public/manifest.webmanifest` (nome Control ALL, abre em /inicio, modo standalone, cores da marca) e ícones em `public/icons/` (192, 512 e apple-touch-icon 180) gerados da logo atual com margem de segurança para ícone adaptável do Android.
- `src/routes/__root.tsx`: link do manifest, apple-touch-icon e metas (theme-color, apple-mobile-web-app-*).
- Sem service worker de propósito: o app é autenticado e tem dados privados, então não há cache offline. A instalação funciona sem ele (Android Chrome instala como app; iPhone via Safari > Compartilhar > Adicionar à Tela de Início).
- Pendente de teste no celular real: instalar no Android e no iPhone, conferir login Google/Microsoft dentro do app instalado, e olhar Chrome DevTools > Application > Manifest.
- Se a logo mudar, regerar os 3 PNGs de `public/icons/`.

### Backup / restauração (mesmo projeto Vercel gm-financas-ohdi)

- Código: tag e branch `backup/pre-pwa-2026-10-09` apontam para o commit 918075d (antes do PWA). Restaurar: `git checkout main && git reset --hard backup/pre-pwa-2026-10-09` seguido de `git push --force-with-lease origin main` (só se necessário), ou criar branch a partir da tag.
- Vercel: cada deploy anterior fica guardado; em Deployments, escolher um deploy bom e usar "Promote to Production" (rollback imediato, sem rebuild).
- Prazo: manter a tag/branch por cerca de 60 dias (até 2026-12-08) e depois apagar (`git push origin :refs/tags/backup/pre-pwa-2026-10-09`). Criar um novo ponto `backup/pre-<mudança>-<data>` antes de cada mudança grande.
- Banco (Supabase): esta etapa não alterou o banco. Antes de mudanças de esquema, conferir em Supabase > Database > Backups o que o plano atual oferece (não confirmado) e, se não houver backup diário, exportar os dados antes da migration.

## Exclusão de conta com 90 dias, cores do admin e navegação em áreas (2026-10-09)

- Exclusão agendada: tabela `exclusoes_agendadas` (migration `20261009100000`, aplicada em partes porque o `apply_migration` deu timeout; sem FK para auth.users porque criar a FK travou). Admin principal agenda em Usuários e Privilégios (`adminAgendarExclusaoUsuario`), pode cancelar, e a lista mostra "Exclusão em N dias". O usuário continua entrando; a cada acesso vê um aviso bloqueante com os dias restantes: "Sim" cancela (restaura), "Não" encerra a sessão (`ExclusaoAgendadaModal`).
- Conclusão: o cron diário (`/api/cron/descarte-layouts`) chama `concluirExclusoesVencidas`: apaga o usuário (cascata dos dados pessoais) e, se era o último do grupo, os dados do grupo. Não testado de ponta a ponta; testar com uma conta fictícia ajustando `prevista_em` no banco.
- Limitação: arquivos já enviados ao armazenamento externo (Oracle/Storage) não são removidos pelo job. Pendente.
- Sobras no banco: função `public.zz_teste_fn()` de teste (o DROP travou; remover depois). A função SQL `apagar_grupo_orfao` não foi criada (criação de função travou), a limpeza do grupo foi feita em TypeScript.
- Cores no admin: itens ainda não liberados aos demais usuários ficam em roxo claro com etiqueta "Só admin" (módulos desligados, Google Drive de notas, grupos sem Oracle, menu e Início). Detalhe: `liberadoGeral` em `listarModulosDisponiveis`.
- Navegação: Início agora mostra 4 áreas (Dinheiro, Casa e vida, Documentos, Ferramentas) com atalhos de um clique, atalhos gerais, bloco Administração (admin) e "Resumo do mês e metas" recolhível (fechado no celular). Novas telas `/casa` e `/documentos`; menu lateral e barra inferior agrupados por área (`src/lib/areas.ts`).
- Ferramentas do print: shadcn/Tailwind já em uso; Magic MCP, shadcn MCP e Chrome DevTools MCP rodam no Claude Code do PC (não instalados aqui); regras da Vercel (Web Interface Guidelines) usadas como checklist. Pendente: revisar telas antigas contra elas e testar o visual no celular após o deploy.

## Anotações: visualizar e concluir (2026-10-09)

- Em Links (admin), cada anotação ganhou o botão Visualizar (abre a anotação) e Concluir, que marca como analisada sem apagar (coluna `links_admin.concluida_em`, aplicada no banco e no arquivo de migration). Concluídas saem de "Anotações ativas" e aparecem na aba "Analisadas" com a data; Reabrir desfaz. Histórico continua mostrando tudo. Só o admin conclui; as demais pessoas não veem o estado.

## Início em widgets, voltar, menu superior (2026-10-09)

- Início em widgets (`HomeWidgets.tsx`, `lib/home-widgets.ts`): Personalizar permite remover, readicionar, mover (setas) e escolher tamanho Pequeno/Médio/Grande, com tamanho mínimo por widget; "Organizar automático" volta ao padrão. Salvo na conta em `preferencias_usuario.home_widgets` (coluna jsonb criada). Sem arrastar com o mouse por enquanto (usa setas, funciona no celular e no teclado).
- Cartões "Economia conquistada" e "Comunidade" no Resumo ficaram compactos (sem subtexto e emoji).
- Botão Voltar no cabeçalho de todas as telas (menos Início): volta ao histórico do navegador; se não houver histórico (app aberto direto), vai ao Início.
- Menu lateral: clicar de novo na área aberta recolhe as opções (seta indica aberto/fechado).
- Layout do menu: a opção "Menu superior" não funcionava (o código procurava o valor "bottom"). Agora o menu superior existe no desktop (áreas com lista, conta, admin e Sair). No celular continua a barra inferior.

### Rodada 6 (2026-10-09)
1. Visualizar nota (`/links/$id`): botão "Copiar nota toda" (título no topo do texto + conteúdo) e, para admin, "Concluir nota" / "Reabrir nota" dentro da própria tela.
2. Fluxo de caixa mês a mês: novo padrão "3 meses (anterior, atual e próximo)"; o seletor de período continua com 6, 12, 24 meses e período personalizado. Preferência salva em nova chave, então todos voltam ao padrão de 3 meses uma vez.
3. Exclusão de contas: só o admin principal agenda/exclui (já valia no servidor). Os demais administradores só podem revogar/desvincular do grupo (`revogarAcessoMembro`), sem excluir.
4. Alerta da calculadora: era o aviso de uso acadêmico do Simulador de dose/diluição. Tinha sido removido na Rodada 5 (item 9). Religado com interruptor em Administração ("Aviso do simulador da calculadora"); desligado esconde o aviso para os usuários logados. Na página pública o aviso fica sempre ligado.
5. "Widgets": a Home já tem widgets editáveis; aguardando o usuário dizer quais widgets novos quer (ex.: Fluxo de caixa).
6. Início: dois widgets novos "Gráfico 1" e "Gráfico 2" (componente `GraficoHome`). O usuário escolhe o gráfico no próprio widget (Receitas x despesas em 3 meses, Saldo por mês em 3 meses, Despesas por categoria do mês atual), e o local/tamanho pelo modo Personalizar. Por padrão não aparecem (a Início continua como estava); entram pelo botão "Adicionar widgets" em Personalizar. A escolha fica em `preferencias_usuario.home_widgets` (campo `opcao`).

### Rodada 7 (2026-10-10)
1. Gráficos: "Linha do tempo, 12 meses" tinha os valores cortados no topo. Margem superior maior e eixo com folga de 20%/15% em todos os gráficos de barras e linhas (Início, Dashboard, widgets de gráfico); barras com largura máxima e sem animação (mais leve e mais limpo).
2. PWA testado pelo usuário e funcionando.
3. Pluggy (Open Finance), TESTE só para o admin do site. Adicional, não altera nada existente.
   - Tela `/pluggy` ("Bancos (teste)", item roxo "Só admin" no menu). Botão "Conectar um banco" abre o widget oficial da Pluggy (pacote `react-pluggy-connect`, `includeSandbox` ligado para testar com o banco fictício: usuário `user-ok`, senha `password-ok`, token `123456`). O site nunca vê a senha do banco.
   - Servidor (`src/lib/pluggy.functions.ts`): `/auth` para gerar a API key, `/connect_token`, `/accounts` e `/v2/transactions` (últimos 30 dias, paginação por cursor). Todas as funções exigem admin do site. A API key e o segredo ficam só no servidor.
   - Banco: tabela `pluggy_items` (user_id, item_id, conector, status), RLS ligada sem políticas e sem permissão para anon/authenticated (só service role). Migração `20261010100000_pluggy_items.sql` (já aplicada no Supabase).
   - Nesta fase os movimentos são só exibidos. NÃO são gravados em despesas/receitas. Próximo passo: mapear transações para despesas/receitas com pré-visualização, de-para de categorias, deduplicação por id da transação e webhook para sincronização automática.
   - Para funcionar: no Vercel (Environment Variables) criar PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET (painel da Pluggy, aba API Keys) e fazer redeploy. O package-lock.json foi atualizado; o bun.lock não (rodar `bun install` se o Vercel usar bun).
   - Antes de abrir para outros usuários: contrato/plano da Pluggy, aviso LGPD de consentimento Open Finance, revogação da conexão pelo usuário e política de retenção.
4. Pluggy com dados reais: conta de teste só aceita o conector sandbox (Pluggy Bank). Caminho gratuito para a conta pessoal: Meu Pluggy (meu.pluggy.ai); conecta o banco lá, copia o Item ID em Dashboard > aplicação > "Ir para Demo" > menu de três pontos, e cola na tela Bancos (teste), campo "Usar dados reais pelo Meu Pluggy". Observação da documentação de terceiros: a conexão no Meu Pluggy só pode ser criada com o trial da Pluggy ativo; confirmar o prazo e as regras no painel da Pluggy.
5. `public/llms.txt` (https://www.controlall.com.br/llms.txt): índice em Markdown para assistentes de IA, no formato do llmstxt.org, só com páginas públicas e textos que já existem nas metas do site. Manter em sincronia com `public/sitemap.xml` quando criar página pública nova. Não inclui nada da área logada.

### Rodada 8 (2026-10-10): importação de faturas
Estudadas 5 faturas reais (Itaú 2026 e 2022 com adicional, Santander com 3 cartões, XP com 2 cartões, Riachuelo/Midway). Os PDFs não foram salvos no repositório (dados pessoais); os testes usam dados fictícios.
1. Novo leitor `src/lib/fatura-fluxo.ts` (usado primeiro; o leitor posicional antigo fica de reserva, ex.: Nubank com datas "12 MAI"):
   - Lê na ordem do próprio PDF; os lançamentos aparecem na prévia nessa mesma ordem.
   - Seção decidida pelo título mais próximo ACIMA na mesma coluna. "Compras parceladas - próximas faturas", "Lançamentos futuros", "Total a vencer", "Obrigações futuras" nunca entram no mês atual (mesmo com o bloco escrito fora de ordem no PDF, como no Itaú 2022).
   - Parcela separada do nome: "PRE 01/07", "DIFERENCI01/12" (colada), "- Parcela 4/6", coluna própria (Santander) e coluna "Nº parc." (Midway).
   - Valor certo: Midway usa o "Lançamento do mês" (não o valor original da compra); XP/Santander usam a coluna R$ (não a US$); nota de rodapé "1 29/06" e código de loja "009" removidos.
   - Portador e final do cartão por lançamento: "NOME - 4258 XXXX XXXX 6975", "@ NOME - ...", "NOME (final 8094)", nome solto acima da tabela (Itaú). Linha de categoria/cidade abaixo do lançamento (Itaú) não entra na descrição.
   - IOF de compra internacional ("Repasse de IOF") vira um lançamento.
   - Ano da compra: mês depois do vencimento = ano anterior (parcelas antigas).
   - Cabeçalho: vencimento, titular, final do cartão, limite total/disponível/utilizado e total impresso.
   - Conferência nas 5 faturas: soma dos lançamentos bate com o total impresso e com o subtotal de cada cartão/portador.
2. Bancos novos na lista: XP e Riachuelo / Midway.
3. Prévia: chips com cada portador e final, total impresso, quantas parcelas de próximas faturas ficaram de fora. Responsável preenchido com o usuário do grupo de mesmo primeiro e último nome; sem correspondência, aparece o nome da fatura como opção.
4. Duplicidade e despesa fixa: o texto não fica mais dentro da coluna (que deformava a tabela). Agora é um botão compacto que abre um painel fixo com a explicação e as opções em botões grandes: usar o valor só neste mês, ajustar a fixa a partir desta competência (novo), vincular sem mudar o valor, manter os dois, ignorar.
5. "Ajustar a partir desta competência": encerra a recorrência antiga no mês anterior e cria a continuação com o novo valor, levando as ocorrências deste mês em diante (pagas continuam pagas). Meses anteriores não mudam. Se for o mês de início, só troca o valor.
Testes: `src/lib/fatura-fluxo.test.ts` (10 testes, `bun test`).
Pendente: testar no site com as próprias faturas; ensinar padrão (perfil memorizado) continua usando o leitor antigo.


## Vídeo de demonstração (2026-10-10)
Concluído: Desktop\Finanças\video\Control_ALL_video_demo.mp4 (3min20s). Sem mudança de código.
Bugs achados na gravação (pendentes):
- Resumo com IA: inclui compra à vista como parcela e mostra ** de markdown na resposta.
- Fatura importada sem cartão vinculado: avisos mostram \"venceu há 2d\" e Calendário fica vazio.
- Tela de horas de trabalho: campo de horas vem com 160 como valor (não placeholder); digitar gera 160160.
- Lista de compras: item digitado se perde quando abre a tela das 3 perguntas.

### Rodada 9 (2026-10-10): Backup e Reset
1. Botão "Resetar todos" no bloco "Reset por módulo". Só libera depois de baixar o backup com todos os módulos marcados nesta sessão (mesma regra do reset por módulo). Pede "RESETAR" para confirmar. Apaga os módulos em ordem e repete os que falharem por dependência entre tabelas enquanto houver progresso; se algum não puder ser apagado, avisa qual.

### Rodada 10 (2026-10-10): exclusão de conta criada pelo Google
1. Erro "null value in column cpf of relation contas_excluidas": contas do Google não têm CPF. Coluna `cpf` agora aceita vazio (aplicado no banco; migração `20261010120000_contas_excluidas_cpf_opcional.sql`).
2. Conta de teste Marcus Nt (artfoxbrasil@gmail.com) apagada direto no banco pelo SQL Editor, com os 4 grupos criados por ela (nenhum tinha outro membro).
3. Exclusão definitiva (fim dos 90 dias) corrigida: o perfil sem grupo fazia o site criar um grupo novo, e o grupo criado pela pessoa (`grupos.criado_por`) impedia apagar o login. Agora apaga o perfil direto, apaga os dados de todos os grupos criados pela pessoa que ficaram sem ninguém e passa a autoria para outro membro quando o grupo ainda tem gente. Tabelas `chamados_suporte`, `exames_registros` e `layout_solicitacoes` entraram na limpeza do grupo.
Pendente: recuperar conta excluída pede CPF; quem entrou pelo Google não consegue recuperar (precisa de opção só por e-mail).
4. Remover dados de exemplo: a função apagava receitas só quando `observacoes` era exatamente "Exemplo fictício" e ignorava qualquer erro em silêncio, então as receitas podiam ficar na conta. Agora apaga por marca E por "(exemplo)" no nome, remove também o investimento de teste, o cartão final 0000 e as categorias de exemplo que nenhum lançamento usa, e qualquer erro aparece para o usuário. Novo botão "Remover dados de exemplo" em Backup e Reset (aparece só quando ainda existe algum, e não exige backup, pois são dados fictícios).
5. "User is banned" ao entrar com Google depois de excluir a própria conta: o fluxo antigo de "Excluir minha conta" bania o usuário e trocava o e-mail por um temporário. O login do Google continua caindo nesse mesmo usuário (a identidade social permanece), então a pessoa não conseguia nem entrar nem criar conta nova com o mesmo e-mail. Agora "Excluir minha conta" usa a mesma carência de 90 dias da exclusão feita pelo admin: grava em `exclusoes_agendadas`, encerra as sessões e mantém o acesso; ao entrar de novo, o aviso pergunta se quer cancelar. Passados os 90 dias o cron apaga de vez. Texto do card atualizado e, na tela de entrar, erro "banned" agora explica em português (vale para contas banidas pelo fluxo antigo).
6. Conta de teste artfoxbrasil@gmail.com (criada de novo em 10/10) estava banida por esse fluxo antigo: desbanida no banco, e-mail e perfil restaurados a partir do `perfil_snapshot` e a linha de `contas_excluidas` marcada como restaurada.
Pendente: `arquivarEExcluirConta` (ban + e-mail temporário) ainda é usado por `adminExcluirUsuario`, que hoje não é chamado pela interface. Decidir se remove ou se passa a desvincular as identidades sociais antes de banir.

### Rodada 11 (2026-10-10): duplicidade na importação
1. `src/lib/duplicidade-importacao.ts`: acha TODOS os lançamentos já salvos parecidos com a linha da fatura (valor igual ou até 2%, mais estabelecimento igual, data próxima ou mesmo final de cartão), compara também com o valor total do parcelamento e ordena do mais parecido para o menos. `rotuloOrigem` traduz a origem: digitado à mão, importado de fatura, despesa fixa, lançado com a IA, total da fatura.
2. Popup `src/components/DuplicidadeDialog.tsx`: mostra a linha da fatura, a lista de parecidos com origem, data, valor, categoria, cartão e responsável de cada um, por que cada um apareceu, e as opções: substituir pelo da fatura, manter o que já existe ou criar um novo (gastos iguais de verdade). Na tabela, a badge virou botão que abre esse popup e mostra a escolha feita.
3. Botão "Substituir todos pela importação" no topo de cada fatura, com a contagem de quantas linhas têm parecido e quantas ainda não foram decididas.
4. Ao salvar: "substituir" atualiza o lançamento existente (descrição, valor, data, categoria, cartão, origem `importacao_substituicao`) e refaz as parcelas não pagas; "manter o que já existe" ignora a linha; "criar um novo" recebe chave de deduplicação própria para não colidir. A deduplicação automática por `dedup_key` continua, mas deixa de ignorar a linha quando o usuário decidiu algo no popup.
5. Categoria herdada: ao importar, se o mesmo estabelecimento já foi classificado antes (ex.: "Plano Nu Cel" 25,00 marcado como despesa fixa), a linha volta com a mesma categoria e o mesmo tipo. O de-para do usuário continua tendo prioridade quando a confiança é alta, e o usuário pode trocar na tabela ou escolher "criar um novo".
Testes: `src/lib/duplicidade-importacao.test.ts` (9 testes, `bun test`).

### Rodada 12 (2026-10-10): "Para onde vai meu dinheiro"
Tela nova `/para-onde-vai`, no menu Finanças e como atalho no card Dinheiro da Início.
1. `src/lib/para-onde-vai.ts` (puro, 12 testes em `para-onde-vai.test.ts`): resumo por categoria no período (total, média, mês atual, variação sobre a média anterior, participação), quadros mês a mês (total e categoria que mais pesou), detecção de cobranças que se repetem e perguntas em texto.
2. Cobrança recorrente = mesmo estabelecimento em 3+ meses com valores próximos (até 25% de diferença); parcelamento fica de fora. Quando uma recorrente para de aparecer por 2 meses ou mais, vira economia automática: valor por mês x meses sem cobrar. Se voltar, sai da lista sozinha.
3. Tela: perguntas no topo ("X leva N% de tudo", "subiu N% neste mês", "N cobranças somam R$ Y por mês, em um ano dá Z"), treemap de categorias (clicável), quadros mês a mês com destaque do mês atual, lista de assinaturas ativas com botão "Quero cancelar" (abre /despesas já filtrado) e o card de economia detectada.
4. `/despesas` aceita `?busca=` para o botão "Quero cancelar" cair direto no lançamento.
Pendente: a economia detectada aqui é calculada na hora e não grava nada; avaliar se deve somar ao card "Economia conquistada" da Início (hoje só conta o que é marcado à mão na despesa).

### Rodada 13 (2026-10-10): idiomas
Idiomas disponíveis: português do Brasil, inglês, espanhol, hindi, francês, alemão, italiano, chinês e árabe (o árabe já troca a direção da página para a direita-esquerda).
1. `src/lib/i18n/idiomas.ts` (lista, direção do texto e palpite pelo navegador, que segue o país do aparelho), `src/lib/i18n/traducoes.ts` (dicionário por chave), `src/hooks/useIdioma.tsx` (contexto: conta > navegador > país > português) e `src/components/SeletorIdioma.tsx` (troca pelo globo).
2. O seletor está no cabeçalho de dentro do site e no cabeçalho das páginas públicas (entrar, início pública). A escolha salva em `preferencias_usuario.idioma` (migração `20261010140000`) e também no navegador, para já valer antes de a conta carregar.
3. Traduzidos nesta rodada: menu lateral, menu superior, barra inferior, nomes das áreas e módulos, ações comuns, textos de entrada e os títulos da tela "Para onde vai meu dinheiro". O que não tem tradução cai no português, então nenhuma tela quebra.
PENDENTE IMPORTANTE: o usuário pediu o site inteiro traduzido. São 31 telas e 58 componentes com texto em português dentro do código; esta rodada entregou a base e o que aparece em todas as telas. As telas seguem sendo convertidas por rodada, nesta ordem sugerida: Início e widgets, Despesas, Receitas, Dashboard, Cartões, Importar, Notas fiscais, Lista de compras, Configurações, Conta, e por fim as telas de administração. Moeda e datas seguem no formato do Brasil, porque os dados são em reais.
