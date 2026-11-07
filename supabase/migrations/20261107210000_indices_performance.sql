-- Índices de performance (auditoria 2026-11-07). Idempotente: pode rodar mais de uma vez.
-- Só colunas claramente usadas em filtro, junção ou ordenação e sem índice equivalente nas migrações.
-- Não usa CONCURRENTLY porque o SQL Editor roda em transação; as tabelas ainda são pequenas, o bloqueio é breve.

-- parcelas.despesa_id: FK com ON DELETE CASCADE e filtro .eq("despesa_id") em 7 pontos do app.
-- Sem índice, cada exclusão de despesa e cada embed parcelas(*) varre a tabela inteira.
create index if not exists parcelas_despesa_id_idx on public.parcelas (despesa_id);

-- parcelas por grupo e vencimento: RLS filtra por grupo_id e as telas/crons filtram e ordenam por vencimento.
-- idx_parcelas_venc (só vencimento) não ajuda o filtro por grupo.
create index if not exists parcelas_grupo_vencimento_idx on public.parcelas (grupo_id, vencimento);

-- despesas por grupo e data da compra: listagem principal (RLS por grupo_id + order by data_compra desc).
create index if not exists despesas_grupo_data_compra_idx on public.despesas (grupo_id, data_compra desc);

-- despesas.cartao_id: FK (ON DELETE SET NULL) usada em faturas e cartões; parcial para não indexar lançamentos sem cartão.
create index if not exists despesas_cartao_id_idx on public.despesas (cartao_id) where cartao_id is not null;

-- receitas por grupo e data de recebimento: listagem principal (order by data_recebimento desc).
-- receitas_grupo_cartao_idx (grupo_id, cartao_id) não cobre a ordenação por data.
create index if not exists receitas_grupo_data_recebimento_idx on public.receitas (grupo_id, data_recebimento desc);

-- Conferência (rode no SQL Editor, SOMENTE SELECT; troque o uuid por um grupo real):
-- explain (analyze, buffers) select * from public.despesas where grupo_id = '00000000-0000-0000-0000-000000000000' order by data_compra desc limit 200;
-- explain (analyze, buffers) select * from public.parcelas where despesa_id = '00000000-0000-0000-0000-000000000000';
-- explain (analyze, buffers) select * from public.parcelas where grupo_id = '00000000-0000-0000-0000-000000000000' and vencimento between current_date and current_date + 30;
-- explain (analyze, buffers) select * from public.receitas where grupo_id = '00000000-0000-0000-0000-000000000000' order by data_recebimento desc limit 200;
-- explain (analyze, buffers) select * from public.despesas where cartao_id = '00000000-0000-0000-0000-000000000000';
-- Depois de uns dias: select relname, indexrelname, idx_scan from pg_stat_user_indexes where indexrelname like '%grupo%' or indexrelname like '%despesa_id%' order by idx_scan;
