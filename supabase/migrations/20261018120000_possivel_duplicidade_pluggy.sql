-- Importação Open Finance: lançamento importado com mesmo valor (centavos) de um manual, em outra data,
-- entra marcado para o usuário conferir se é duplicidade. Aditivo: não altera dados existentes.
alter table public.despesas add column if not exists possivel_duplicidade boolean not null default false;
alter table public.receitas add column if not exists possivel_duplicidade boolean not null default false;
