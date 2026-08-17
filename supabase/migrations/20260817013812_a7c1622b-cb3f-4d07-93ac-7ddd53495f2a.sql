CREATE TABLE public.import_lotes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  status text not null default 'rascunho',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_lotes TO authenticated;
GRANT ALL ON public.import_lotes TO service_role;
ALTER TABLE public.import_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_lotes_all ON public.import_lotes FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());

CREATE TABLE public.import_faturas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.import_lotes(id),
  banco text not null,
  arquivo_nome text not null,
  arquivo_hash text not null,
  storage_path text,
  arquivo_excluido_em timestamptz,
  arquivo_excluido_por uuid references auth.users(id),
  vencimento date,
  competencia text,
  total_declarado numeric,
  total_extraido numeric,
  paginas integer,
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE UNIQUE INDEX import_faturas_hash_uidx ON public.import_faturas (arquivo_hash);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_faturas TO authenticated;
GRANT ALL ON public.import_faturas TO service_role;
ALTER TABLE public.import_faturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_faturas_all ON public.import_faturas FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());

CREATE TABLE public.cartao_vinculos (
  id uuid primary key default gen_random_uuid(),
  banco text not null,
  final text not null,
  responsavel text not null,
  profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (banco, final)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartao_vinculos TO authenticated;
GRANT ALL ON public.cartao_vinculos TO service_role;
ALTER TABLE public.cartao_vinculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartao_vinculos_all ON public.cartao_vinculos FOR ALL TO authenticated
  USING (private.is_active_member()) WITH CHECK (private.is_active_member());

ALTER TABLE public.despesas
  ADD COLUMN fatura_id uuid REFERENCES public.import_faturas(id),
  ADD COLUMN banco_nome text,
  ADD COLUMN cartao_final text,
  ADD COLUMN descricao_normalizada text,
  ADD COLUMN direcao text NOT NULL DEFAULT 'debito',
  ADD COLUMN origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN grupo_parcelamento text,
  ADD COLUMN dedup_key text;
CREATE UNIQUE INDEX despesas_dedup_key_uidx ON public.despesas (dedup_key) WHERE dedup_key IS NOT NULL;

ALTER TABLE public.parcelas
  ADD COLUMN situacao_temporal text,
  ADD COLUMN origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN valor_estimado boolean NOT NULL DEFAULT false,
  ADD COLUMN confianca_data text,
  ADD COLUMN dedup_key text,
  ADD COLUMN fatura_id uuid REFERENCES public.import_faturas(id);
CREATE UNIQUE INDEX parcelas_dedup_key_uidx ON public.parcelas (dedup_key) WHERE dedup_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_import_lotes_updated_at BEFORE UPDATE ON public.import_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_import_faturas_updated_at BEFORE UPDATE ON public.import_faturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cartao_vinculos_updated_at BEFORE UPDATE ON public.cartao_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();