-- Corrige um bug real: o bloqueio "esta conta não pode excluir nada" era
-- verificado no front-end comparando profiles.cpf com um CPF fixo
-- ("41412522803") que nunca correspondia ao CPF real (vazio) da conta
-- protegida — ou seja, a proteção nunca esteve ativa de fato, e mesmo se
-- estivesse, não impedia chamadas diretas à API. Esta migração:
--   1. cria uma coluna explícita `profiles.bloqueio_exclusao_total`;
--   2. cria uma função auxiliar para checar isso a partir de policies;
--   3. adiciona policies RESTRICTIVE de DELETE nas tabelas do dia a dia
--      (lista de compras, notas fiscais, categorias) além das financeiras
--      já cobertas por `pode_excluir`, reforçando o bloqueio no banco;
--   4. ativa o bloqueio para a conta que hoje é usada de forma
--      compartilhada e que a documentação do produto diz nunca poder
--      excluir dados.

alter table public.profiles
  add column if not exists bloqueio_exclusao_total boolean not null default false;

create or replace function private.bloqueio_exclusao_total()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select p.bloqueio_exclusao_total from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function private.bloqueio_exclusao_total() from public, anon;
grant execute on function private.bloqueio_exclusao_total() to authenticated;

-- Tabelas financeiras: reforço redundante (além da checagem por módulo em
-- pode_excluir), garantindo que o bloqueio total nunca seja contornado.
drop policy if exists despesas_bloqueio_total on public.despesas;
create policy despesas_bloqueio_total on public.despesas
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists receitas_bloqueio_total on public.receitas;
create policy receitas_bloqueio_total on public.receitas
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists cartoes_bloqueio_total on public.cartoes;
create policy cartoes_bloqueio_total on public.cartoes
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists bancos_bloqueio_total on public.bancos;
create policy bancos_bloqueio_total on public.bancos
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists investimentos_bloqueio_total on public.investimentos;
create policy investimentos_bloqueio_total on public.investimentos
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists veiculos_bloqueio_total on public.veiculos;
create policy veiculos_bloqueio_total on public.veiculos
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

-- Demais módulos usados no dia a dia que também exibiam o bloqueio na
-- interface (lista de compras, notas fiscais, categorias) mas não tinham
-- nenhuma garantia no banco.
drop policy if exists lista_compras_bloqueio_total on public.lista_compras;
create policy lista_compras_bloqueio_total on public.lista_compras
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists notas_fiscais_bloqueio_total on public.notas_fiscais;
create policy notas_fiscais_bloqueio_total on public.notas_fiscais
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists nota_itens_bloqueio_total on public.nota_itens;
create policy nota_itens_bloqueio_total on public.nota_itens
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists nota_arquivos_bloqueio_total on public.nota_arquivos;
create policy nota_arquivos_bloqueio_total on public.nota_arquivos
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists nota_vinculos_bloqueio_total on public.nota_vinculos;
create policy nota_vinculos_bloqueio_total on public.nota_vinculos
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists categorias_bloqueio_total on public.categorias;
create policy categorias_bloqueio_total on public.categorias
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

drop policy if exists categoria_regras_bloqueio_total on public.categoria_regras;
create policy categoria_regras_bloqueio_total on public.categoria_regras
  as restrictive for delete to authenticated
  using (not private.bloqueio_exclusao_total());

-- Ativa o bloqueio para a conta compartilhada que, segundo a documentação do
-- produto, nunca deve conseguir excluir dados (antes verificado só por CPF
-- fixo no front-end, o que nunca funcionou de fato).
update public.profiles
set bloqueio_exclusao_total = true
where id = '4633c0fa-e6da-45bf-9d4a-eaefc7ecc373';

notify pgrst, 'reload schema';
