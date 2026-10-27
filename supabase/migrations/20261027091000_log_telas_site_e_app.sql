alter table public.acessos_site_log add column if not exists plataforma text;

-- Registro de tela aberta no app (27/10/2026): só o nome da tela, o usuário logado e a plataforma.
-- Sem IP, sem local e sem nenhum dado lançado.
create or replace function public.registrar_tela(p_caminho text, p_plataforma text default 'app')
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or coalesce(trim(p_caminho), '') = '' then return; end if;
  insert into public.acessos_site_log (caminho, user_id, plataforma, dispositivo)
  values (left(split_part(p_caminho, '?', 1), 300), auth.uid(), left(coalesce(p_plataforma, 'app'), 20),
          case when p_plataforma = 'app' then 'celular' else null end);
end; $$;
revoke all on function public.registrar_tela(text, text) from public, anon;
grant execute on function public.registrar_tela(text, text) to authenticated;
