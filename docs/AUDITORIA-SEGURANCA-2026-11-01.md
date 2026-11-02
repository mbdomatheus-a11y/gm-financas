# Auditoria de segurança (manual), 01/11/2026

Escopo: site (gm-financas), app (controlall), banco Supabase de produção (wjapagkdgjlavonbmjdu).
Método: leitura de código, políticas RLS, funções SECURITY DEFINER, configuração das Edge Functions e advisor de segurança do Supabase. Nenhum teste dinâmico (sem ataques contra produção).
Não coberto: revisão completa de XSS no front, npm audit, configurações da Vercel, Auth (painel), binários iOS e Android.
Nota: a skill security-audit da Cloudflare não foi instalada, porque a instalação foi bloqueada pelo classificador de segurança. Esta auditoria foi feita manualmente.

## Pontos positivos verificados
- Funções SECURITY DEFINER conferem auth.uid() e o grupo (aceitar_convite_grupo_id, conciliar_fatura_pdf, ajustar_lancamento_conciliacao, resetar_grupo_completo).
- Edge Functions sensíveis com verify_jwt ligado: importar-fatura-pdf, consultar-nota, lancamento-ia, comunicados, links, suporte, convites-grupo, excluir-conta, senha-provisoria, assistente-ia, pluggy-leitura, pix.
- Sem service role no bundle do front (só em server functions e Edge Functions).
- .env e .env.local estão no .gitignore. Nenhum padrão de chave literal (sk_live, eyJ..., AKIA) encontrado no src, supabase, app.json, eas.json ou scripts.

## Atualização 01/11/2026 (mesma data, depois da auditoria)
- Item 1 (subcategorias): CORRIGIDO. Migração 20261101150000_subcategorias_somente_dono aplicada no banco. Todos leem; cada um cria, edita e apaga só as próprias. As 16 subcategorias existentes têm dono.
- Item 6 (login): CORRIGIDO no banco, código pronto, falta deploy. Migração 20261101160000_login_escalonado_e_ip aplicada. Por conta: 3 erros 1 min, 4 erros 5 min, 5 erros 15 min, 6 erros 1 h, 7 ou mais 24 h; zera após 24 h sem erro ou login bem-sucedido. Por IP: 20 falhas em 15 min bloqueiam o IP por 15 min, dobrando a cada novo bloqueio até 24 h; login bem-sucedido não zera o IP. Testado com dados falsos, apagados depois.
- Item 4 (segredo do calendário): código pronto (usa CALENDARIO_HMAC_SECRET), falta criar o segredo e fazer deploy. Os links de calendário já assinados deixam de valer e precisam ser refeitos.
- Item 2 (senha vazada) e item 3 (backups): aguardando decisão.
- Item 5 (token da Pluggy): adiado, só o dono usa o sistema. Registrado em PENDENCIAS.md.

## Achados (ordem de prioridade)

### Médio
1. subcategorias (migração 20261011100000): política subcategorias_all com FOR ALL TO authenticated USING (true). A tabela não tem grupo_id, então qualquer usuário logado de qualquer grupo pode editar ou apagar subcategorias de outros grupos. Correção sugerida: adicionar grupo_id e política por grupo. Decisão sua: é catálogo compartilhado de propósito?
2. Proteção de senha vazada desativada no Supabase Auth (advisor auth_leaked_password_protection). Correção: painel Supabase, Authentication, ativar verificação HaveIBeenPwned. Ação sua.
3. Token do webhook da Pluggy (PLUGGY_WEBHOOK_TOKEN) apareceu no chat em 17/10. Já está nas pendências. Trocar.
4. Backups com dados financeiros pessoais no schema public (tabelas _backup_*, backup_*, bkp_*, reset_backups). Estão sem políticas, então o cliente não lê, mas o advisor mostra 74 tabelas com RLS sem política. Riscos: minimização de dados (LGPD) e superfície desnecessária. Correção: mover para schema privado ou apagar após conferir. Apagar exige sua aprovação.
5. calendario-ics usa SUPABASE_SERVICE_ROLE_KEY como segredo do HMAC. Se essa chave for rotacionada, os links de calendário quebram, e a chave de administração fica espalhada por um uso público. Correção: segredo dedicado, por exemplo CALENDARIO_HMAC_SECRET.
6. login-seguro (verify_jwt desligado, por desenho, roda antes do login) e calendario-ics/pluggy-connect precisam de limite de tentativas. Só assistente-ia e lancamento-ia usam limite de taxa no código. Verificar se login-seguro usa login_tentativas e se o limite é efetivo.

### Baixo
7. zz_teste_fn: função de teste em produção (search_path mutável). Correção: DROP FUNCTION, com sua aprovação.
8. unaccent_safe: search_path mutável. Correção: definir SET search_path.
9. increment_parceria_cliques executável pelo papel anon: qualquer pessoa pode inflar o contador de cliques. Correção: revogar EXECUTE de anon.
10. Funções de trigger (congelar_*_pluggy, bloquear_manual_conta_pluggy) aparecem como executáveis por anon e authenticated. Não são chamáveis por RPC na prática, mas a permissão deve ser revogada.
11. CORS com origem "*" em quase todas as Edge Functions. Risco baixo, porque a autenticação é por Bearer e não por cookie. Restringir ao domínio do site quando possível.
12. configuracoes_acesso_site: leitura pública (anon). Conteúdo só de configuração, risco baixo.
13. importar-fatura-pdf: sem limite de taxa, aceita PDF de até 10 MB. Usuário logado pode consumir CPU. Risco baixo.

## Resumo
Nenhuma falha crítica de vazamento de dados foi encontrada por leitura. Os itens 1, 2, 4 e 5 são os mais importantes. Os itens 2 e 4 não exigem build (Auth é painel; remoção de backups é SQL, com aprovação).

## Próximos passos sugeridos
- Você decide: item 1 (catálogo compartilhado ou por grupo), item 4 (apagar backups ou mover), item 7 (apagar função de teste).
- Eu executo SQL depois da sua aprovação, em arquivo de migração. Mudança na Auth você faz no painel.
- Itens 5 e 6 exigem alteração de Edge Function, que vai para deploy por eas/supabase, sem build nativa.
