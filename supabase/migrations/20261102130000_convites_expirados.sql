-- 02/11/2026: rotina de limpeza dos convites. Convites não usados e vencidos recebem `expirado_em`
-- (o cron diário /api/cron/descarte-layouts marca; as telas deixam de listá-los). Aceitos ficam como histórico.
alter table public.convites add column if not exists expirado_em timestamptz;

update public.convites
   set expirado_em = now()
 where usado = false
   and expirado_em is null
   and expira_em < now();

create index if not exists convites_expirado_em_idx on public.convites (expirado_em);
