-- 30/10/2026: receita recebida a partir deste dia do mês (até a virada) conta para o próximo ciclo. null = pela data.
alter table public.preferencias_usuario add column if not exists receitas_proximo_ciclo_dia smallint check (receitas_proximo_ciclo_dia between 1 and 31);
