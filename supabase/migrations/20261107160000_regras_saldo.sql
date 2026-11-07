-- Regras de saldo por usuário (07/11/2026), tela Personalização > "Saldos e valores".
-- Aditivo e idempotente: pode rodar mais de uma vez. Não altera dados existentes.
-- Rodar com backup. As políticas de RLS de preferencias_usuario continuam valendo.
alter table public.preferencias_usuario
  add column if not exists somar_transferencias boolean not null default false;
alter table public.preferencias_usuario
  add column if not exists somar_pagamento_fatura boolean not null default false;
alter table public.preferencias_usuario
  add column if not exists mostrar_fatura_aberta boolean not null default true;
alter table public.preferencias_usuario
  add column if not exists somar_investimentos boolean not null default false;

comment on column public.preferencias_usuario.somar_transferencias is 'Transferências entre contas entram nos totais de saldo.';
comment on column public.preferencias_usuario.somar_pagamento_fatura is 'Pagamento de fatura conta como saída (além das compras do cartão).';
comment on column public.preferencias_usuario.mostrar_fatura_aberta is 'Previsões incluem a fatura aberta estimada.';
comment on column public.preferencias_usuario.somar_investimentos is 'Aportes e resgates de investimentos entram no saldo.';

notify pgrst, 'reload schema';
