BEGIN;

ALTER TABLE public.veiculo_documentos
ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.veiculo_eventos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS veiculo_documentos_evento_idx ON public.veiculo_documentos(evento_id);

CREATE OR REPLACE FUNCTION private.validar_documento_evento_veiculo()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.evento_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.veiculo_eventos evento
    WHERE evento.id = NEW.evento_id AND evento.veiculo_id = NEW.veiculo_id
  ) THEN
    RAISE EXCEPTION 'O orçamento deve pertencer a um evento do mesmo veículo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_documento_evento_veiculo ON public.veiculo_documentos;
CREATE TRIGGER validar_documento_evento_veiculo
BEFORE INSERT OR UPDATE OF evento_id, veiculo_id ON public.veiculo_documentos
FOR EACH ROW EXECUTE FUNCTION private.validar_documento_evento_veiculo();

COMMIT;
