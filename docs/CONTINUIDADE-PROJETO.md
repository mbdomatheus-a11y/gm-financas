# Control ALL: guia de continuidade do desenvolvimento

Atualizado em 23/09/2026. Este documento permite que outra IA ou pessoa continue o projeto sem depender do histórico da conversa.

## Identidade e ambientes oficiais

- Produto: Control ALL.
- Site de produção: `https://www.controlall.com.br`.
- Hospedagem: Vercel, projeto `gm-financas-ohdi`.
- Repositório: `mbdomatheus-a11y/gm-financas`.
- Supabase oficial: projeto `wjapagkdgjlavonbmjdu`.
- E-mail de privacidade e contato: `privacidade@controlall.com.br` / `mbdo.matheus@gmail.com`.
- Idioma: português brasileiro.
- Não colocar chaves, senhas, CPF ou tokens no Git.

## Stack e validação

- React 19, TypeScript, TanStack Router/Start e React Query.
- Tailwind CSS e componentes Radix/shadcn.
- Supabase para autenticação, PostgreSQL, RLS e Storage.
- Vercel Analytics carregado no layout raiz.
- Testes com Vitest. Antes de publicar, executar `npx tsc --noEmit`, `npm run lint` e `npm run build`.
- Alterações de banco sempre devem ser adicionadas em `supabase/migrations`. Atualizar também `src/integrations/supabase/types.ts`.

## Regras centrais de segurança e dados

- Dados financeiros são isolados por `grupo_id`; administradores veem cadastro e métricas, não devem ganhar acesso silencioso aos dados privados.
- Módulos de exames são privados por usuário por padrão e só são compartilhados mediante escolha explícita.
- Exclusão de conta mantém cópia recuperável por 90 dias. Dados compartilhados permanecem para os outros integrantes. Se não houver outro integrante, os dados são apagados definitivamente após o prazo.
- Formulário e solicitações de privacidade LGPD estão disponíveis no modal de Termos/Privacidade e são encaminhados para a fila de atendimento na tela de Administração (`/administracao`).
- Administrador principal não pode excluir a própria conta. Exclusão administrativa exige as confirmações textuais definidas no produto.
- PDFs de modelagem de fatura são privados, auditados e descartados conforme a política documentada.
- A chave `service_role` só pode existir no servidor.

## Módulos existentes

- Finanças: receitas, despesas, cartões, bancos, investimentos, importação de faturas e painéis.
- Lista de compras com aprovações, links e observações.
- Notas fiscais e garantias.
- Calculadoras públicas e simulador acadêmico.
- Veículos, eventos, orçamentos e alertas.
- Pet, incluindo cadastro, vacinas, vermífugos e leitura de carteirinha.
- Onde Está?, para inventário doméstico e localização de itens.
- Exames, com importação, revisão individual ou em lote e histórico.
- Administração: usuários, grupos, módulos globais e individuais, comunicados, solicitações de privacidade, analytics e auditoria.

## Regras de cartões e faturas

- Toda identificação visual de cartão deve incluir apelido/bandeira, final e primeiro nome do titular.
- Despesas oferecem as visões Total, Fixas e Variáveis. A visão por cartão mostra o total do grupo e permite recolher ou expandir os itens.
- `fatura_mes.modo_calculo` possui três modos:
  - `inclui_parcelas`: o total informado já contém as parcelas previstas;
  - `somar_parcelas`: o valor informado é somado às parcelas previstas;
  - `somente_total`: para o cartão e mês selecionados, apenas o total manual entra na visão geral e os itens detalhados são ignorados.
- Ao importar uma fatura para cartão/mês que tenha `somente_total` aberto, o sistema pede confirmação. Confirmando, o total manual recebe origem `fatura_total_concluida`, permanece tachado no histórico e deixa de participar dos totais; os itens importados passam a valer.
- Excluir um total concluído exige confirmação.
- `import_faturas.cartao_id` identifica o cartão usado no histórico de limite. Registros antigos sem vínculo permanecem agrupados pelo banco.
- A tela Limites mostra consolidado total/usado/disponível e gráfico mensal usado x disponível em 6, 12, 24 meses ou todo o histórico.

## Versões e notificações

- O selo fixo de build não é mais exibido no centro do site.
- Cada build autenticado é registrado em `versoes_site` e aparece no sino até ser lido.
- Cada usuário mantém seu próprio estado de leitura e histórico.
- O administrador pode limpar todas as versões ativas para todos. O registro não é apagado fisicamente, recebe `ativo=false`, `limpo_em` e `limpo_por`.

## Migrações e melhorias recentes

- `supabase/migrations/20260922010000_configuracoes_acesso_modulos_grupos.sql`: módulos por grupo, limites de login e 2FA.
- `supabase/migrations/20260923010000_totais_fatura_limites_versoes.sql`: modo de cálculo em `fatura_mes`, `cartao_id` em `import_faturas`, tabela `versoes_site`.
- `supabase/migrations/20260923020000_fix_despesas_origem_check.sql`: constraint `despesas_origem_check` atualizada com origens manuais e de faturas concluídas.
- **Busca por Valor em Despesas e Receitas**: implementação de `correspondeBuscaComValor` em `src/lib/busca.ts` aceitando padrão brasileiro (`3.259,25`, `259,25`, `120,00`, `120`, `R$ 120,00`).
- **Importação de Faturas Parceladas e Status de Pagamento**:
  - `parseDate` generalizado para aceitar `DD/MM/YYYY` e `YYYY-MM-DD`, prevenindo datas `NaN` em parcelas futuras (ex: Outubro/2026).
  - Ajustada a flag `paga: numero <= parcela_numero` na importação de faturas.
  - Exibição de parcelas pagas corrigida (`X/Y pagas`) e adição de alternância rápida de pagamento ("✓ Paga" / "Em aberto") com clique na tela de Despesas.

## Fluxo de publicação

1. Verificar se a árvore Git contém apenas mudanças da tarefa.
2. Rodar tipagem, lint e build: `npx tsc --noEmit` e `npm run build`.
3. Aplicar a nova migração no projeto Supabase oficial e conferir o resultado.
4. Criar commit sem reescrever commits já publicados.
5. Fazer push para a branch conectada à Vercel.
6. Confirmar que o deployment ficou Ready e testar com usuário comum e administrador.

## Pontos que exigem cuidado futuro

- Ao configurar o envio de e-mails via Resend em produção, adicionar o domínio no painel do Resend e definir a variável de ambiente `RESEND_FROM_EMAIL`. O remetente padrão `onboarding@resend.dev` retorna erro 403 para e-mails terceiros.
- Manter a compatibilidade do booleano legado `inclui_parcelas`; a regra nova usa `modo_calculo`.
- Testar qualquer mudança de consolidação com dois cartões do mesmo banco e titulares diferentes.
- Não reescrever o histórico público do Git. O projeto ainda mantém integração registrada com Lovable, embora o usuário não queira depender dessa ferramenta.
