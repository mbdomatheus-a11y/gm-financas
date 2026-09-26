# Control ALL — Histórico completo de implementações

> Última atualização: 2026-09-26 · Commit `d7235d4` na branch `main`
> Repositório: `mbdomatheus-a11y/gm-financas`

---

## Stack

- **Frontend/Backend**: TanStack Start (React + SSR), TypeScript, Tailwind CSS, shadcn/ui
- **Banco de dados**: Supabase (PostgreSQL + RLS + Storage)
- **E-mail**: Resend via `src/lib/email.server.ts`
- **Roteamento**: TanStack Router (arquivo `src/routeTree.gen.ts` gerado automaticamente)
- **Estado**: TanStack Query (`useQuery` / `useMutation`)
- **Auth**: Supabase Auth + middleware `requireSupabaseAuth`

---

## Arquitetura de papéis

| Papel | Onde fica | Descrição |
|---|---|---|
| `site_admin` | tabela `site_admins` | Admin master do site (Matheus). Protegido — não pode ser alterado por outras rotas. |
| `admin` | tabela `user_roles` | Admin de grupo familiar. Pode gerenciar membros do próprio grupo. |
| `comum` | tabela `user_roles` | Usuário padrão. |

---

## Módulos implementados (ordem cronológica)

### 1. Painel de Administração (`/administracao`)

**9 abas** todas protegidas por `isSiteAdmin`:

| Aba | Conteúdo |
|---|---|
| **Dados Gerais** | Usuários cadastrados, contas ativas, tempo médio de sessão, convites (status geral), composição dos grupos, **saldo mensal líquido por grupo (receita − despesa do mês atual)** |
| **Consulta** | 🔒 Protegida por **segunda senha** — admin confirma senha antes de ver a tabela de atividade/armazenamento por usuário. Botão "Bloquear novamente". |
| **Acesso e Auth** | Modo de login (CPF / e-mail / ambos), 2FA por e-mail, sessão máxima em minutos |
| **Módulos** | Ativar/desativar módulos globais com exceção por usuário |
| **Personalização** | Upload e substituição da logo do site |
| **Avisos** | Criar banner global com aceite obrigatório + histórico |
| **Privacidade LGPD** | Workflow de solicitações com histórico de tratativas, resposta por e-mail |
| **Central de Solicitações** | Faturas para modelagem + Chamados de suporte, com badges de pendência |
| **Logs de Auditoria** | Expandíveis com JSON de detalhes, IP/cidade, badge ⚠ em falhas de login |

---

### 2. Central de Suporte — Rota `/suporte` (usuário logado)

**Arquivo**: `src/routes/_authenticated/suporte.tsx`

- Formulário: assunto (5–120 chars), descrição (10–3000 chars), prioridade (baixa/normal/alta/urgente)
- Exibe protocolo gerado após envio
- Lista chamados próprios com status completo e resposta do admin
- Visível no menu lateral (todos os usuários) e na página Início

**Server functions** em `src/lib/central-solicitacoes.functions.ts`:
- `enviarChamadoSuporte` — cria chamado + notifica admin por e-mail
- `adminListarChamados` — lista todos os chamados (admin)
- `adminAtualizarChamado` — atualiza status + envia resposta por e-mail ao usuário

---

### 3. Consulta de Protocolo na Landing Page (`/`)

**Arquivo**: `src/routes/index.tsx`

- **Antes**: apenas busca por UUID de protocolo
- **Agora**: duas abas — **Por Protocolo** (UUID) e **Por CPF** (11 dígitos)
- Busca por CPF usa hash SHA-256 do CPF para consultar `cpf_hash` em `solicitacoes_privacidade`
- Exibe múltiplos resultados (quando há mais de um protocolo por CPF)

**Server function** `consultarProtocolo` em `src/lib/central-solicitacoes.functions.ts`:
- Aceita `{ protocolo?: string, cpf?: string }` — pelo menos um obrigatório (Zod refine)
- Busca em `solicitacoes_privacidade` e `chamados_suporte`

---

### 4. Dupla Senha na Aba Consulta do Admin

**Arquivo**: `src/routes/_authenticated/administracao.tsx`

- Antes de exibir a tabela de atividade dos usuários, exige que o admin re-autentique com `supabase.auth.signInWithPassword`
- Estado local `consultaDesbloqueada` controla o gate
- Botão "🔒 Bloquear novamente" disponível após autenticação

---

### 5. Roles de Grupo Familiar

**Arquivo**: `src/lib/admin.functions.ts` — nova função `grupoAdminSetRole`

- Admin de grupo pode alterar o papel (admin/comum) de membros do **mesmo `grupo_id`**
- Proteções: não altera `site_admins`, não se altera a si mesmo, valida que o alvo pertence ao mesmo grupo
- Registra em `admin_audit_logs` com ação `grupo_admin_alterou_papel`

**Arquivo**: `src/components/PermissoesUsuariosCard.tsx`

- Antes: visível só para `isSiteAdmin`
- Agora: visível para qualquer `isAdmin` (admin de grupo ou site admin)
- Usa `grupoAdminSetRole` quando não for site admin

---

### 6. Logs de Auditoria Detalhados

**Arquivo**: `src/lib/admin-avancado.functions.ts`

- `adminListarLogs`: limite ampliado de 100 → 200 entradas

**Arquivo**: `src/lib/seguranca-conta.functions.ts`

- `iniciarLoginSeguro`: em caso de falha de autenticação, insere registro em `admin_audit_logs` com:
  - `acao: "login_falhou"`
  - `detalhes.identificador_hash` (primeiros 16 chars do hash)
  - `detalhes.tentativas` (contador da tabela)
  - `detalhes.bloqueado` (boolean)

**UI em** `src/routes/_authenticated/administracao.tsx`:

- Cada log é um `<details>` expansível
- Mostra IP e cidade quando `detalhes.ip` está presente
- Badge ⚠ vermelho em eventos com "falha", "bloqueado" ou "login_falhou"
- JSON estruturado dos detalhes exibido em fonte mono

---

### 7. Saldo Mensal no Painel Admin

**Arquivo**: `src/lib/admin-avancado.functions.ts` — função `adminMetricas`

- Consulta `receitas` e `despesas` do mês atual filtradas por `grupo_id`
- Campos `receitas` e `despesas` adicionados a cada item do array `grupos`
- Card "Saldo mensal por grupo" exibido na aba Dados Gerais (quando há dados)
- Exibe: Receita (verde), Despesa (vermelho), Saldo líquido (verde/vermelho conforme positivo/negativo)

---

### 8. Alteração de Senha Exige Senha Atual

**Arquivo**: `src/lib/seguranca-conta.functions.ts` — `alterarMinhaSenha`

- Valida `senhaAtual` via `signInWithPassword` antes de aplicar nova senha
- Envia e-mail de alerta com link para bloqueio emergencial da conta e link para suporte

**Arquivo**: `src/routes/_authenticated/conta.tsx`

- Campo `senhaAtual` adicionado ao formulário
- Mínimo de 8 caracteres (alinhado com backend)

---

### 9. Invalidação Imediata Após Upload de Fatura

**Arquivo**: `src/routes/_authenticated/importar.tsx`

- Após upload assinado bem-sucedido: `qc.invalidateQueries({ queryKey: ["minhas-solicitacoes-layout"] })`
- A lista do usuário atualiza imediatamente sem precisar recarregar a página

---

### 10. Menu de Navegação

**Arquivo**: `src/components/AppLayout.tsx`

- `/suporte` adicionado ao tipo `NavTo` e ao array `GLOBAL` (visível para todos)
- `/administracao` permanece `adminOnly: true`
- Ícones: `Headphones` para Suporte, `ShieldCheck` para Administração

**Arquivo**: `src/routes/_authenticated/inicio.tsx`

- Seção "Geral" agora inclui: Compartilhar, Usuários\*, Backup\*, **Administração\***, Personalização, **Suporte**, Conta
- `*` = visível apenas para admins

---

### 11. Funcionalidades anteriores (sessões anteriores)

- **Reorganização `/administracao`** em 9 abas (Central de Solicitações, LGPD, Avisos, etc.)
- **Rótulo "Recorrente fora do cartão"** em `VisaoGeralHome.tsx` e `despesas.tsx`
- **Esclarecimento sobre duplicidade** no modal de importação
- **Compartilhar Resumo com Clipboard** — botão "Copiar imagem" em `/compartilhar`
- **Edição de dados cadastrais** em `/conta` (nome, e-mail, telefone, nascimento; CPF bloqueado)
- **Bloqueio de conta inativo** — migration `20260920021000_bloqueio_conta_inativa.sql`
- **2FA por e-mail** — desafio em `login_2fa_desafios`, verificação por código de 6 dígitos
- **Convites** — máximo 3 por usuário comum, ilimitado para admins
- **Logs de auditoria** — tabela `admin_audit_logs` usada em toda a aplicação
- **Personalização de tema** — `/personalizacao` para todos os usuários (paleta/layout/modo)
- **Status de fatura**: constraint correto `DEFAULT 'recebida'` + `CHECK (status IN ('recebida','em_modelagem','corrigida','descartada'))`

---

## Estrutura de arquivos relevantes

```
src/
├── routes/
│   ├── index.tsx                          — Landing page + consulta protocolo/CPF
│   ├── _authenticated/
│   │   ├── inicio.tsx                     — Hub de módulos
│   │   ├── administracao.tsx              — Painel admin (9 abas)
│   │   ├── suporte.tsx                    — Central de suporte (usuário)  ← NOVO
│   │   ├── conta.tsx                      — Dados cadastrais + alterar senha
│   │   ├── importar.tsx                   — Upload e importação de faturas
│   │   ├── usuarios.tsx                   — Gestão de usuários (site admin)
│   │   ├── personalizacao.tsx             — Tema/paleta/layout (todos)
│   │   └── dashboard.tsx                  — Dashboard financeiro
├── lib/
│   ├── central-solicitacoes.functions.ts  — Privacidade LGPD + Suporte + consultarProtocolo
│   ├── admin.functions.ts                 — CRUD de usuários + adminSetRole + grupoAdminSetRole ← ATUALIZADO
│   ├── admin-avancado.functions.ts        — Métricas, logs, layouts, comunicados
│   ├── seguranca-conta.functions.ts       — Login, 2FA, alterarMinhaSenha, bloquearConta
│   └── layout-fatura.functions.ts         — Upload/listagem de faturas para modelagem
├── components/
│   ├── AppLayout.tsx                      — Layout global + navegação
│   └── PermissoesUsuariosCard.tsx         — Gestão de papéis/permissões (admin de grupo)
└── routeTree.gen.ts                       — Gerado automaticamente (não editar manualmente)
```

---

## Migrations Supabase relevantes

| Arquivo | O que cria/altera |
|---|---|
| `20260919100000_administracao_privacidade_modulos.sql` | `layout_solicitacoes`, `solicitacoes_privacidade`, `notificacoes_usuario`, `configuracoes_acesso_site`, `modulos_globais` |
| `20260920021000_bloqueio_conta_inativa.sql` | `bloqueio_conta_tokens`, policy RLS `layouts_conta_ativa` |
| `20260925190000_admin_abas_privacidade_chamados.sql` | `chamados_suporte`, `convites`, coluna `email` em `layout_solicitacoes`, `admin_audit_logs` |

---

## Commits finais

| Commit | Descrição |
|---|---|
| `7296535` | Reorganização admin, consulta protocolo, editor dados, clipboard compartilhar |
| `d7235d4` | Suporte, consulta CPF, dupla-senha admin, saldo mensal, roles grupo, audit detalhado |
