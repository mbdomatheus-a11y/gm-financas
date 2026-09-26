# Control All: finanças pessoais

Aplicação web de finanças, lista de compras, notas fiscais e ferramentas. O código é independente do Lovable. A hospedagem oficial é [Vercel](https://gm-financas-ohdi.vercel.app), com autenticação, banco e armazenamento no Supabase.

## Desenvolvimento

Requer Bun. Instale as dependências com `bun install`, configure as variáveis de ambiente no servidor e execute `bun run dev`. Para verificar uma entrega, use `bunx tsc --noEmit`, `bun run lint` e `bun run build`.

As chaves privadas nunca devem entrar no repositório. O acesso aos dados financeiros depende das políticas de segurança por grupo no Supabase. A chave publicável do Supabase pode estar no navegador, mas a chave `service_role` somente no servidor.

## Implantação e banco

- As mudanças de esquema versionadas estão em `supabase/migrations/`.
- A importação de faturas e o isolamento por grupo devem ser testados com duas contas distintas antes de cada publicação.
- O Google Drive é opcional e exige configuração própria no Google Cloud. Enquanto não estiver configurado, comprovantes podem ficar em um bucket privado do Supabase após a migração correspondente.
- A lista de funcionalidades confirmadas e pendentes está em `docs/checklist-pedidos.md`.
- Documentação completa de implementações e arquitetura: [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md).
- Pendências técnicas e guia para continuidade do trabalho: [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md).

O material antigo deste README continha CPFs e uma senha inicial de exemplo. Ele foi retirado da versão atual, mas permanece no histórico público do Git. Qualquer senha que tenha sido usada deve ser trocada no Supabase Auth. Não reescreva o histórico publicado sem planejar o impacto para os clones e integrações.
