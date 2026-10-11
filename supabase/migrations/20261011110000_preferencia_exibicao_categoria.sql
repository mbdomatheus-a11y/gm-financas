-- Como nomear categorias nos gráficos: só a categoria, só a subcategoria ou completo.
alter table public.preferencias_usuario add column if not exists exibicao_categoria text not null default 'categoria' check (exibicao_categoria in ('categoria','subcategoria','completo'));
notify pgrst, 'reload schema';
