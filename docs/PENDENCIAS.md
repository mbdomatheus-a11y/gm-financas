# Control ALL — Pendências e próximos passos

> Última atualização: 2026-09-26 · Commit `d7235d4`
> Repositório: `mbdomatheus-a11y/gm-financas`
> Branch ativa: `main` (sincronizada com Lovable — não fazer force push)

---

## ✅ Itens 100% concluídos nesta conversa

| # | Item | Commit |
|---|---|---|
| 1 | Status inicial da fatura corrigido para `recebida` (constraint alinhado) | anterior |
| 2 | Invalidação imediata da lista após upload de fatura (`minhas-solicitacoes-layout`) | anterior |
| 3 | Alteração de senha exige senha atual + e-mail de alerta | anterior |
| 4 | Menu: Suporte visível para todos, Administração só para admin | `d7235d4` |
| 5 | Rota `/suporte` com formulário e listagem de chamados próprios | `d7235d4` |
| 6 | Dupla senha (re-autenticação) na aba Consulta do painel admin | `d7235d4` |
| 7 | Consulta de protocolo na landing page aceita CPF além do UUID | `d7235d4` |
| 8 | `grupoAdminSetRole` — admin de grupo altera papel de membros do mesmo grupo | `d7235d4` |
| 9 | `PermissoesUsuariosCard` exibido para todos os admins (não só site admin) | `d7235d4` |
| 10 | Logs de auditoria detalhados: `login_falhou` com hash/tentativas, JSON expansível, badge ⚠ | `d7235d4` |
| 11 | Saldo mensal líquido por grupo (Receita − Despesa) na aba Dados Gerais do admin | `d7235d4` |

---

## ⚠️ Pendências conhecidas

### A — Notificações em tempo real para o admin (fatura enviada)
**O que falta**: Quando um usuário sobe uma fatura para modelagem, **o admin não recebe notificação visual no painel** enquanto está logado (só recebe e-mail).

**Implementação sugerida**:
- Usar `supabase.channel()` (Realtime) para escutar inserções em `layout_solicitacoes` e mostrar toast/badge no admin.
- Ou criar um polling a cada 30s na query `admin-layouts` quando o admin estiver na aba "Central de Solicitações".

**Arquivo a modificar**: `src/routes/_authenticated/administracao.tsx`

---

### B — Saldo mensal no painel admin depende de campo `grupo_id` nas tabelas financeiras
**O que pode falhar**: O campo `grupo_id` em `receitas` e `despesas` pode não existir ou estar nulo para registros antigos.

**Implementação sugerida**:
- Verificar se a migration que cria `grupo_id` em `receitas`/`despesas` já existe.
- Se não existir, criar migration: `ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.grupos(id);`
- Garantir que novos lançamentos populem `grupo_id` via trigger ou lógica no insert.

**Arquivo relevante**: `src/lib/admin-avancado.functions.ts` (função `adminMetricas`)

---

### C — Logs com IP e cidade
**O que falta**: O campo `detalhes.ip` e `detalhes.cidade` nos logs de auditoria estão preparados na UI, mas **nenhuma server function envia esses dados ainda**.

**Implementação sugerida**:
- No `iniciarLoginSeguro` e outras server functions, ler o IP do header `x-forwarded-for` ou `x-real-ip` da request e registrar junto nos `detalhes` do log.
- Opcional: usar um serviço gratuito como `ip-api.com` para resolver cidade/país.
- O TanStack Start expõe `getWebRequest()` de `@tanstack/react-start/server` para acessar o objeto `Request` dentro das server functions.

**Exemplo de trecho a adicionar**:
```ts
import { getWebRequest } from "@tanstack/react-start/server";
const req = getWebRequest();
const ip = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
// inserir ip em detalhes: { ip, ...outros }
```

---

### D — `chamados_suporte` não tem policy de INSERT para autenticados
**Verificar**: A migration `20260925190000_admin_abas_privacidade_chamados.sql` criou `chamados_insert` policy, mas se a tabela não tiver `GRANT INSERT`, usuários podem ter erro silencioso.

```sql
-- Verificar se existe:
GRANT SELECT, INSERT ON public.chamados_suporte TO authenticated;
```

---

### E — Consulta por CPF na landing page apenas busca `solicitacoes_privacidade`
**O que falta**: A busca por CPF não verifica `chamados_suporte` (que não tem `cpf_hash`).

**Implementação sugerida**: Se quiser buscar chamados por CPF, adicionar coluna `cpf_hash` à tabela `chamados_suporte` e populá-la no insert.

---

### F — Feedback visual de "carregando" no upload de fatura pelo usuário
**O que falta**: Após o upload, a lista atualiza imediatamente mas o usuário pode não perceber que o envio foi bem-sucedido.

**Implementação sugerida**: Mostrar toast de sucesso com número do protocolo após invalidação do cache.

---

## 🔮 Melhorias recomendadas (não solicitadas, mas de alto valor)

### R1 — Relatório financeiro em PDF
- Gerar PDF do extrato mensal/anual via `jsPDF` ou `react-pdf`

### R2 — Filtro de data customizado no fluxo de caixa
- Adicionar campos de data início/fim no gráfico de evolução do dashboard
- Linha de saldo acumulado (Receita − Despesa cumulativa)

### R3 — Modal de confirmação antes de excluir fatura/despesa
- Atualmente a exclusão é imediata — adicionar dialog de confirmação

### R4 — Paginação nos logs de auditoria
- Com limit 200, logs antigos ficam inacessíveis
- Adicionar cursored pagination (botão "Carregar mais")

### R5 — Exportar logs de auditoria em CSV
- Botão de download na aba Logs do admin

### R6 — Histórico de alterações de senha
- Registrar em `admin_audit_logs` cada alteração de senha com timestamp e IP

---

## 🧭 Contexto técnico essencial para nova IA

### Autenticação e segurança
- **`site_admins`** → admin master, verificado por `assertAdmin()` em `admin.functions.ts` e `admin()` em `admin-avancado.functions.ts`
- **`user_roles`** → papéis de grupo (`admin`/`comum`)
- **`usePermissoes()`** hook retorna: `{ isAdmin, isSiteAdmin, can(modulo, acao) }`
- Todas as server functions protegidas usam `.middleware([requireSupabaseAuth])` de `src/integrations/supabase/auth-middleware.ts`

### Rotas autenticadas
- Ficam em `src/routes/_authenticated/`
- O layout global está em `src/routes/_authenticated/route.tsx`
- O tipo `NavTo` no `AppLayout.tsx` deve incluir toda rota nova

### Geração de rotas
- **OBRIGATÓRIO** após criar qualquer arquivo novo em `src/routes/`: rodar `npx @tanstack/router-cli generate` para atualizar `src/routeTree.gen.ts`

### E-mail
- Usar `await import("@/lib/email.server")` então `enviarEmail({ to, subject, html })`
- Endereço padrão do admin: `privacidade@controlall.com.br`

### Supabase Admin
- Para operações com service_role: `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`
- Para operações do usuário logado: `context.supabase` (disponível via middleware)

### Convenções de audit log
```ts
await db.from("admin_audit_logs").insert({
  ator_id: context.userId,   // null = sistema
  acao: "nome_da_acao",      // snake_case
  alvo_id: "uuid-do-alvo",   // null se não aplicável
  detalhes: { /* JSON livre */ },
});
```

---

## 📁 Arquivos principais modificados (sessão atual)

| Arquivo | Mudanças |
|---|---|
| [`src/routes/_authenticated/suporte.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/_authenticated/suporte.tsx) | ✨ NOVO — página de suporte para usuário |
| [`src/routes/_authenticated/administracao.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/_authenticated/administracao.tsx) | Gate de senha na aba Consulta, saldo mensal, logs expandíveis |
| [`src/routes/index.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/index.tsx) | Consulta por CPF + abas Por Protocolo/Por CPF |
| [`src/lib/central-solicitacoes.functions.ts`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/lib/central-solicitacoes.functions.ts) | `consultarProtocolo` aceita CPF; busca por `cpf_hash` |
| [`src/lib/admin.functions.ts`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/lib/admin.functions.ts) | `grupoAdminSetRole` — admin de grupo altera papéis |
| [`src/lib/admin-avancado.functions.ts`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/lib/admin-avancado.functions.ts) | `adminMetricas` com receitas/despesas por grupo; limite logs → 200 |
| [`src/lib/seguranca-conta.functions.ts`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/lib/seguranca-conta.functions.ts) | `login_falhou` registrado no audit log com detalhes |
| [`src/components/AppLayout.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/components/AppLayout.tsx) | `/suporte` no NavTo e GLOBAL; `Headphones` importado |
| [`src/components/PermissoesUsuariosCard.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/components/PermissoesUsuariosCard.tsx) | Usa `grupoAdminSetRole`; visível para todos os `isAdmin` |
| [`src/routes/_authenticated/inicio.tsx`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routes/_authenticated/inicio.tsx) | Suporte e Administração na seção Geral |
| [`src/routeTree.gen.ts`](file:///c:/Users/Usúario/Desktop/Finanças/AntiGravity/src/routeTree.gen.ts) | Regenerado com `/suporte` |
