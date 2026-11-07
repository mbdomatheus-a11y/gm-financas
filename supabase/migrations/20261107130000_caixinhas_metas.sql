-- 07/11/2026: Caixinhas viram metas completas (valor alvo, prazo, ícone e cor).
--
-- A tabela public.caixinhas já existe (criada pelo app, compartilhada com o
-- site; as linhas são do grupo via grupo_id). Esta migration só ACRESCENTA
-- colunas opcionais: nada muda nas linhas atuais, nem triggers ou políticas
-- de RLS (as colunas novas seguem as mesmas regras da linha).
--
--   valor_alvo  quanto se quer juntar no total (null = sem alvo, só o valor por mês)
--   data_alvo   até quando (null = sem prazo); a tela usa o mês desta data
--   imagem      emoji ou nome de ícone lucide (ex.: "plane", "home", "car")
--   cor         cor em hex (ex.: "#1670B8")
--
-- Idempotente e aditiva: pode rodar mais de uma vez. Não altera dados.

alter table if exists public.caixinhas add column if not exists valor_alvo numeric(14,2);
alter table if exists public.caixinhas add column if not exists data_alvo date;
alter table if exists public.caixinhas add column if not exists imagem text;
alter table if exists public.caixinhas add column if not exists cor text;

do $$
begin
  if to_regclass('public.caixinhas') is not null
     and not exists (select 1 from pg_constraint where conname = 'caixinhas_valor_alvo_positivo') then
    alter table public.caixinhas
      add constraint caixinhas_valor_alvo_positivo check (valor_alvo is null or valor_alvo > 0);
  end if;
  if to_regclass('public.caixinhas') is not null
     and not exists (select 1 from pg_constraint where conname = 'caixinhas_imagem_tamanho') then
    alter table public.caixinhas
      add constraint caixinhas_imagem_tamanho check (imagem is null or length(imagem) <= 40);
  end if;
  if to_regclass('public.caixinhas') is not null
     and not exists (select 1 from pg_constraint where conname = 'caixinhas_cor_tamanho') then
    alter table public.caixinhas
      add constraint caixinhas_cor_tamanho check (cor is null or length(cor) <= 20);
  end if;
end $$;

notify pgrst, 'reload schema';
