create table public.veiculo_eventos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  grupo_id uuid,
  tipo text not null check (tipo in ('troca_oleo','revisao_preventiva','troca_pneus','freios','bateria','alinhamento_balanceamento','lavagem','multa','outro')),
  data date not null,
  km integer,
  custo numeric,
  descricao text,
  criado_por uuid,
  created_at timestamptz not null default now()
);

alter table public.veiculo_eventos enable row level security;

create trigger veiculo_eventos_set_grupo before insert on public.veiculo_eventos
  for each row execute function private.set_grupo_id();

create policy veiculo_eventos_grupo on public.veiculo_eventos
  for all using (grupo_id = private.meu_grupo_id()) with check (grupo_id = private.meu_grupo_id());

create index veiculo_eventos_veiculo_id_idx on public.veiculo_eventos(veiculo_id);
create index veiculo_eventos_data_idx on public.veiculo_eventos(data desc);
