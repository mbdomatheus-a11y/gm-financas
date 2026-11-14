-- 14/11/2026: unidade de exibição dos valores em resumos e gráficos (completo, mil ou k).
alter table public.preferencias_usuario
  add column if not exists formato_valores text not null default 'completo';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'preferencias_usuario_formato_valores_check'
  ) then
    alter table public.preferencias_usuario
      add constraint preferencias_usuario_formato_valores_check
      check (formato_valores in ('completo', 'mil', 'k'));
  end if;
end $$;
