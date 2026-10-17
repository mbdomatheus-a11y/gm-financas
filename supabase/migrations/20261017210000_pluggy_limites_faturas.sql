-- Limite, fatura e saldo de cada conta/cartão conectado (vindos da Pluggy, atualizados a cada sincronização).
alter table public.pluggy_contas add column if not exists limite numeric(14,2);
alter table public.pluggy_contas add column if not exists limite_disponivel numeric(14,2);
alter table public.pluggy_contas add column if not exists fatura_valor numeric(14,2);
alter table public.pluggy_contas add column if not exists fatura_vencimento date;
alter table public.pluggy_contas add column if not exists saldo numeric(14,2);
