CREATE TABLE public.veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  marca text,
  modelo text,
  ano integer,
  placa text,
  chassi text,
  renavam text,
  data_compra date,
  motorista_principal text,
  km_atual integer,
  km_proxima_troca_oleo integer,
  data_proxima_troca_oleo date,
  data_vencimento_ipva date,
  data_vencimento_seguro date,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY veiculos_grupo ON public.veiculos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo_id = veiculos.grupo_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo_id = veiculos.grupo_id));

CREATE OR REPLACE FUNCTION public.definir_grupo_novo_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.grupo_id IS NULL THEN
    SELECT grupo_id INTO NEW.grupo_id FROM public.profiles WHERE id = auth.uid();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER veiculos_definir_grupo_trg BEFORE INSERT ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.definir_grupo_novo_veiculo();
CREATE TRIGGER update_veiculos_updated_at BEFORE UPDATE ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX veiculos_grupo_id_idx ON public.veiculos(grupo_id);

CREATE TABLE public.veiculo_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL,
  storage_path text NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_documentos TO authenticated;
GRANT ALL ON public.veiculo_documentos TO service_role;
ALTER TABLE public.veiculo_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY veiculo_documentos_grupo ON public.veiculo_documentos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.veiculos v JOIN public.profiles p ON p.grupo_id = v.grupo_id WHERE v.id = veiculo_documentos.veiculo_id AND p.id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.veiculos v JOIN public.profiles p ON p.grupo_id = v.grupo_id WHERE v.id = veiculo_documentos.veiculo_id AND p.id = auth.uid()));
CREATE INDEX veiculo_documentos_veiculo_id_idx ON public.veiculo_documentos(veiculo_id);

CREATE TABLE public.veiculo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('troca_oleo','revisao_preventiva','troca_pneus','freios','bateria','alinhamento_balanceamento','lavagem','multa','outro')),
  data date NOT NULL,
  km integer,
  custo numeric,
  descricao text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_eventos TO authenticated;
GRANT ALL ON public.veiculo_eventos TO service_role;
ALTER TABLE public.veiculo_eventos ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.definir_grupo_novo_evento_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.grupo_id IS NULL THEN
    SELECT grupo_id INTO NEW.grupo_id FROM public.veiculos WHERE id = NEW.veiculo_id;
  END IF;
  IF NEW.criado_por IS NULL THEN
    NEW.criado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER veiculo_eventos_definir_grupo_trg BEFORE INSERT ON public.veiculo_eventos
FOR EACH ROW EXECUTE FUNCTION public.definir_grupo_novo_evento_veiculo();
CREATE POLICY veiculo_eventos_grupo ON public.veiculo_eventos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo_id = veiculo_eventos.grupo_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo_id = veiculo_eventos.grupo_id));
CREATE INDEX veiculo_eventos_veiculo_id_idx ON public.veiculo_eventos(veiculo_id);
CREATE INDEX veiculo_eventos_data_idx ON public.veiculo_eventos(data DESC);