-- 15/11/2026. Não apaga dados.
-- 1) Armazenamento: cota padrão de 64 MB para todo grupo novo; os grupos atuais passam a 64 MB,
--    exceto o grupo da administração do site (fica como está). Nenhum grupo comum tinha arquivo enviado.
alter table public.grupos alter column oracle_storage_cota_bytes set default 67108864;
update public.grupos g
   set oracle_storage_cota_bytes = 67108864
 where g.oracle_storage_cota_bytes <> 67108864
   and not exists (
     select 1 from public.profiles p join public.site_admins s on s.user_id = p.id
      where p.grupo_id = g.id or p.grupo_secundario_id = g.id
   );

-- 2) Dia de virada do ciclo: de 1 a 31 (antes até 28). Em mês mais curto vale o último dia.
alter table public.regra_ciclo_grupo drop constraint if exists regra_ciclo_grupo_dia_virada_check;
alter table public.regra_ciclo_grupo add constraint regra_ciclo_grupo_dia_virada_check check (dia_virada between 1 and 31);
alter table public.preferencias_usuario drop constraint if exists preferencias_usuario_dia_virada_check;
alter table public.preferencias_usuario add constraint preferencias_usuario_dia_virada_check check (dia_virada is null or dia_virada between 1 and 31);
