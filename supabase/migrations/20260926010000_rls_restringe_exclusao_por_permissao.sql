-- Reforça no banco a regra de exclusão por módulo que já existia apenas no
-- front-end (usePermissoes().can(modulo, "excluir")): qualquer chamada direta
-- à API do Supabase (fora do app) hoje conseguia excluir dados mesmo que a
-- interface bloqueasse. Esta migração cria uma policy RESTRICTIVE de DELETE
-- (que se combina em AND com as policies permissivas já existentes por
-- grupo_id) para as tabelas financeiras principais, usando a mesma lógica de
-- `permissoes.pode_excluir` e do admin de grupo (`user_roles.role='admin'`).

create or replace function private.pode_excluir(_modulo text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    case
      when private.is_admin(auth.uid()) then true
      when exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role = 'admin'
      ) then true
      else coalesce(
        (
          select p.pode_excluir
          from public.permissoes p
          where p.user_id = auth.uid() and p.modulo = _modulo
        ),
        false
      )
    end;
$$;

revoke all on function private.pode_excluir(text) from public, anon;
grant execute on function private.pode_excluir(text) to authenticated;

drop policy if exists despesas_delete_permissao on public.despesas;
create policy despesas_delete_permissao on public.despesas
  as restrictive for delete to authenticated
  using (private.pode_excluir('despesas'));

drop policy if exists receitas_delete_permissao on public.receitas;
create policy receitas_delete_permissao on public.receitas
  as restrictive for delete to authenticated
  using (private.pode_excluir('receitas'));

drop policy if exists cartoes_delete_permissao on public.cartoes;
create policy cartoes_delete_permissao on public.cartoes
  as restrictive for delete to authenticated
  using (private.pode_excluir('cartoes'));

drop policy if exists bancos_delete_permissao on public.bancos;
create policy bancos_delete_permissao on public.bancos
  as restrictive for delete to authenticated
  using (private.pode_excluir('cartoes'));

drop policy if exists investimentos_delete_permissao on public.investimentos;
create policy investimentos_delete_permissao on public.investimentos
  as restrictive for delete to authenticated
  using (private.pode_excluir('investimentos'));

drop policy if exists veiculos_delete_permissao on public.veiculos;
create policy veiculos_delete_permissao on public.veiculos
  as restrictive for delete to authenticated
  using (private.pode_excluir('veiculos'));

notify pgrst, 'reload schema';
