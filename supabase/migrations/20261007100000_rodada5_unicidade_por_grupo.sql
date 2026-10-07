-- Unicidade passa a valer dentro de cada grupo (antes era global e um usuario bloqueava o nome do outro).
alter table public.categorias drop constraint if exists categorias_nome_tipo_key;
alter table public.categorias add constraint categorias_grupo_nome_tipo_key unique (grupo_id, nome, tipo);
alter table public.cartao_vinculos drop constraint if exists cartao_vinculos_banco_final_key;
alter table public.cartao_vinculos add constraint cartao_vinculos_grupo_banco_final_key unique (grupo_id, banco, final);
alter table public.notas_fiscais drop constraint if exists notas_fiscais_chave_acesso_key;
alter table public.notas_fiscais add constraint notas_fiscais_grupo_chave_acesso_key unique (grupo_id, chave_acesso);
