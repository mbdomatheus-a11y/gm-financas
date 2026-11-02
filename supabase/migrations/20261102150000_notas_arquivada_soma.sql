-- 02/11/2026: ao arquivar, o usuário escolhe se a nota continua somando nos totais.
-- Aditivo: notas já existentes entram com false (param de somar ao arquivar).
alter table public.notas_fiscais
  add column if not exists arquivada_soma boolean not null default false;
