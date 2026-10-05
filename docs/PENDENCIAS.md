# Control ALL — Documentação de Entregas e Pendências

> **Última atualização:** Outubro/2026 · Commit `c8ca3f8`  
> **Repositório:** `mbdomatheus-a11y/gm-financas`  
> **Branch ativa:** `main` (Sincronizada com o Lovable — histórico preservado sem force push)  
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
