ALTER TABLE public.lista_compras
  ADD COLUMN IF NOT EXISTS alerta_em date,
  ADD COLUMN IF NOT EXISTS lista text NOT NULL DEFAULT 'compras';

CREATE INDEX IF NOT EXISTS lista_compras_lista_idx ON public.lista_compras (lista);
CREATE INDEX IF NOT EXISTS lista_compras_alerta_idx ON public.lista_compras (alerta_em);

CREATE OR REPLACE FUNCTION public.lista_compras_limite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.lista_compras) >= 2000 THEN
    RAISE EXCEPTION 'Limite de 2000 itens atingido na lista';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lista_compras_limite_trg ON public.lista_compras;
CREATE TRIGGER lista_compras_limite_trg
BEFORE INSERT ON public.lista_compras
FOR EACH ROW EXECUTE FUNCTION public.lista_compras_limite();