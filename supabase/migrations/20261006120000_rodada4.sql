-- Rodada 4 (2026-10-06): log de acessos, categorias/de-para padrao do admin, suporte "Duvida".

-- 1) Log de acessos ao site (IP e local). So service_role le/escreve.
create table if not exists public.acessos_site_log (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  caminho text not null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ip text,
  cidade text,
  regiao text,
  pais text,
  user_agent text,
  dispositivo text,
  sessao text,
  user_id uuid
);
create index if not exists acessos_site_log_criado_em_idx on public.acessos_site_log (criado_em desc);
alter table public.acessos_site_log enable row level security;
revoke all on public.acessos_site_log from anon, authenticated;

-- 2) Categorias padrao (sugeridas a todos) geridas pelo admin.
create table if not exists public.categorias_padrao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  subcategorias text[] not null default '{}',
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.categorias_padrao enable row level security;
create policy categorias_padrao_leitura on public.categorias_padrao for select to authenticated using (true);
create policy categorias_padrao_admin on public.categorias_padrao for all to authenticated
  using (exists (select 1 from public.site_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.site_admins a where a.user_id = auth.uid()));
grant select, insert, update, delete on public.categorias_padrao to authenticated;

insert into public.categorias_padrao (nome, subcategorias, ordem) values
('Alimentação', array['Restaurante','Fast-food','Delivery','Cafeteria','Bar','Lanchonete','Conveniência']::text[], 0),
('Mercado', array['Supermercado','Hortifruti','Atacado','Padaria']::text[], 1),
('Transporte', array['Transporte por aplicativo','Táxi','Transporte público','Pedágio','Estacionamento']::text[], 2),
('Veículo', array['Combustível','Manutenção','Acessórios','Seguro veicular','Vistoria']::text[], 3),
('Moradia / Casa', array['Aluguel','Condomínio','Energia','Água','Gás','Móveis','Reformas']::text[], 4),
('Compras / Varejo', array['Loja de departamento','E-commerce','Utilidades','Presentes','Compras diversas']::text[], 5),
('Vestuário / Calçados', array['Roupas','Calçados','Acessórios']::text[], 6),
('Saúde', array['Farmácia','Médico','Hospital','Ótica','Exames','Plano de saúde']::text[], 7),
('Pets', array['Pet shop','Veterinário','Medicamentos','Alimentação pet']::text[], 8),
('Assinaturas / Serviços digitais', array['Streaming','Música','Notícias','Nuvem']::text[], 9),
('Tecnologia / IA', array['Inteligência Artificial','Software','SaaS','Aplicativos','Ferramentas profissionais']::text[], 10),
('Telefonia / Internet', array['Celular','Internet','TV']::text[], 11),
('Seguros', array['Seguro residencial','Seguro de vida','Seguro veicular','Outros seguros']::text[], 12),
('Educação', array['Curso','Faculdade','Livros','Escola']::text[], 13),
('Beleza / Cuidados pessoais', array['Salão','Barbearia','Cosméticos','Estética']::text[], 14),
('Lazer / Entretenimento', array['Cinema','Eventos','Esportes','Passeios']::text[], 15),
('Games', array['Jogos','Assinatura de games','Itens virtuais']::text[], 16),
('Viagens', array['Passagens','Hospedagem','Locação de veículo','Turismo']::text[], 17),
('Serviços', array['Serviços gerais','Profissionais','Assinatura de serviços']::text[], 18),
('Taxas / Juros / Anuidade', array['Juros','IOF','Anuidade','Multa','Parcelamento','Tarifa']::text[], 19),
('Outros', array['Não identificada']::text[], 20),
('Categoria a confirmar', array['Não identificada']::text[], 21)
on conflict (nome) do nothing;

-- 3) De-para padrao (texto do estabelecimento -> categoria) geridos pelo admin.
create table if not exists public.depara_padrao (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  categoria text not null,
  subcategoria text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.depara_padrao enable row level security;
create policy depara_padrao_leitura on public.depara_padrao for select to authenticated using (true);
create policy depara_padrao_admin on public.depara_padrao for all to authenticated
  using (exists (select 1 from public.site_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.site_admins a where a.user_id = auth.uid()));
grant select, insert, update, delete on public.depara_padrao to authenticated;

-- 4) Suporte: nova opcao "Duvida".
alter table public.chamados_suporte drop constraint if exists chamados_suporte_prioridade_check;
alter table public.chamados_suporte add constraint chamados_suporte_prioridade_check
  check (prioridade = any (array['elogio','reclamacao','sugestao','duvida']));
