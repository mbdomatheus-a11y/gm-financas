-- 07/11/2026: "Juntar com lançamento existente" (Open Finance x lançamento manual/recorrente).
-- Guarda o vínculo entre o texto do banco (ex.: "DEBITO AUT. CTA ENERGIA ELETRICA ENEL ENERGIA") e o
-- nome do lançamento do usuário (ex.: "Enel - Energia"), para sugerir a junção automaticamente nos
-- meses seguintes. A sincronização não recria o duplicado porque:
--  * "manter o meu": a transação do banco é rejeitada (pluggy_transacoes.rejeitada), como já existe;
--  * "manter o do Open Finance": a despesa importada continua com o pluggy_transaction_id.
-- Idempotente. Acesso por grupo (RLS com private.meu_grupo_id()).

create table if not exists public.vinculos_open_finance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  padrao_banco text not null,
  nome_meu text not null,
  nome_meu_norm text not null,
  escolha text not null default 'manter_meu' check (escolha in ('manter_meu', 'manter_open_finance')),
  transaction_id text,
  competencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vinculos_open_finance_unico
  on public.vinculos_open_finance (grupo_id, padrao_banco, nome_meu_norm);
create index if not exists vinculos_open_finance_grupo_idx on public.vinculos_open_finance (grupo_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_grupo_id_trigger' and tgrelid = 'public.vinculos_open_finance'::regclass) then
    create trigger set_grupo_id_trigger before insert on public.vinculos_open_finance
      for each row execute function private.set_grupo_id();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.vinculos_open_finance'::regclass) then
    create trigger set_updated_at before update on public.vinculos_open_finance
      for each row execute function public.update_updated_at_column();
  end if;
end $$;

alter table public.vinculos_open_finance enable row level security;

drop policy if exists vinculos_open_finance_do_grupo on public.vinculos_open_finance;
create policy vinculos_open_finance_do_grupo on public.vinculos_open_finance
  for all to authenticated
  using (grupo_id = private.meu_grupo_id())
  with check (grupo_id = private.meu_grupo_id());

grant select, insert, update, delete on public.vinculos_open_finance to authenticated;
grant all on public.vinculos_open_finance to service_role;

notify pgrst, 'reload schema';
