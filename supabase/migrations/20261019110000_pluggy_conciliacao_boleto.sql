-- Open Finance: pagamento de boleto da conta corrente marca a parcela da despesa correspondente como paga.
-- Guarda a ligação para não conciliar a mesma transação duas vezes. Aditivo.
alter table public.pluggy_transacoes
  add column if not exists parcela_conciliada_id uuid references public.parcelas(id) on delete set null;
