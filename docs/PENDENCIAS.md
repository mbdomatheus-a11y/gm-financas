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
