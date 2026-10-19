-- Open Finance: evita duplicar lançamentos quando webhook e cron rodam a mesma conexão ao mesmo tempo.
-- 1) Trava por conexão (sincronizando_em): só um processo sincroniza cada item por vez.
-- 2) Índices únicos: a mesma transação da Pluggy não vira duas despesas/receitas, nem o mesmo grupo de parcelas.
-- Aditivo: não altera nem apaga dados existentes (verificado: nenhuma duplicata atual).
alter table public.pluggy_items add column if not exists sincronizando_em timestamptz;

create unique index if not exists despesas_pluggy_transaction_id_uidx
  on public.despesas (pluggy_transaction_id) where pluggy_transaction_id is not null;

create unique index if not exists receitas_pluggy_transaction_id_uidx
  on public.receitas (pluggy_transaction_id) where pluggy_transaction_id is not null;

create unique index if not exists despesas_pluggy_grupo_uidx
  on public.despesas (pluggy_grupo) where pluggy_grupo is not null;
