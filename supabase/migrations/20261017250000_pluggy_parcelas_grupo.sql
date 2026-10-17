-- Grupo de compra parcelada importada: impede repetir o parcelamento quando as próximas parcelas aparecem no extrato.
alter table public.despesas add column if not exists pluggy_grupo text;
create index if not exists despesas_pluggy_grupo_idx on public.despesas (pluggy_grupo) where pluggy_grupo is not null;
