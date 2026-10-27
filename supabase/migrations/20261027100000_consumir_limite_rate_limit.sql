-- Limite de requisições atômico (27/10/2026): conta e registra numa chamada só e devolve em quantos
-- segundos a pessoa pode tentar de novo (cabeçalho Retry-After). A chave chega sempre em hash.
create or replace function public.consumir_limite(p_rota text, p_chave_hash text, p_max int, p_janela_seg int)
returns table(permitido boolean, retry_after int)
language plpgsql security definer set search_path to 'public' as $$
declare
  n int;
  mais_antigo timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_rota || ':' || p_chave_hash));
  select count(*), min(criado_em) into n, mais_antigo
  from public.rate_limit_eventos
  where rota = p_rota and chave_hash = p_chave_hash and criado_em > now() - make_interval(secs => p_janela_seg);
  if n >= p_max then
    return query select false, greatest(1, ceil(extract(epoch from (mais_antigo + make_interval(secs => p_janela_seg) - now())))::int);
    return;
  end if;
  insert into public.rate_limit_eventos (rota, chave_hash) values (p_rota, p_chave_hash);
  if random() < 0.01 then
    delete from public.rate_limit_eventos where criado_em < now() - interval '2 days';
  end if;
  return query select true, 0;
end; $$;
revoke all on function public.consumir_limite(text, text, int, int) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, text, int, int) to service_role;
