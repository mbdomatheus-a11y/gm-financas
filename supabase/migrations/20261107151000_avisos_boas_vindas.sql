-- 07/11/2026: Boas-vindas pós-cadastro e card "Primeiros passos" guardam o "já vi / dispensei"
-- na conta (avisos_dispensados), igual aos avisos do beta e do convite. Só amplia a lista de
-- avisos aceitos. Idempotente: pode rodar mais de uma vez. Não altera dados.
do $$
begin
  if to_regclass('public.avisos_dispensados') is not null then
    alter table public.avisos_dispensados drop constraint if exists avisos_dispensados_aviso_check;
    alter table public.avisos_dispensados
      add constraint avisos_dispensados_aviso_check
      check (aviso in ('beta', 'convite', 'boas_vindas', 'primeiros_passos'));
  end if;
end $$;
