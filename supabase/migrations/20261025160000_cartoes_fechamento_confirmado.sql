-- Fechamento da fatura confirmado pelo usuário (25/10/2026).
-- Sem confirmação, vale o padrão do banco (Nubank/C6: 7 dias antes do vencimento; demais: 8) e o app pergunta perto da virada.
alter table public.cartoes add column if not exists fechamento_confirmado boolean not null default false;
update public.cartoes set fechamento_confirmado = true where dia_fechamento is not null;
