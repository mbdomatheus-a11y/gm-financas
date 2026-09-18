CREATE TABLE public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT 'Grupo familiar',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.grupos TO authenticated;
GRANT ALL ON public.grupos TO service_role;

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  ADD COLUMN convidado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN email text,
  ADD COLUMN telefone text,
  ADD COLUMN data_nascimento date;

CREATE INDEX profiles_grupo_id_idx ON public.profiles(grupo_id);
CREATE INDEX profiles_convidado_por_idx ON public.profiles(convidado_por);

WITH grupo_inicial AS (
  INSERT INTO public.grupos (nome)
  SELECT 'Grupo principal'
  WHERE EXISTS (SELECT 1 FROM public.profiles)
  RETURNING id
)
UPDATE public.profiles
SET grupo_id = (SELECT id FROM grupo_inicial)
WHERE grupo_id IS NULL;

CREATE POLICY "grupos_select_proprio"
ON public.grupos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.grupo_id = grupos.id
  )
);

CREATE OR REPLACE FUNCTION public.definir_grupo_novo_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.grupo_id IS NULL THEN
    INSERT INTO public.grupos (nome)
    VALUES (COALESCE(NULLIF(BTRIM(NEW.nome), ''), 'Grupo familiar'))
    RETURNING id INTO NEW.grupo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_definir_grupo_trg
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.definir_grupo_novo_perfil();

CREATE TABLE public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usado boolean NOT NULL DEFAULT false,
  usado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

GRANT SELECT, INSERT, UPDATE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

CREATE INDEX convites_criado_por_idx ON public.convites(criado_por);
CREATE INDEX convites_token_idx ON public.convites(token);

CREATE POLICY "convites_select_proprios"
ON public.convites
FOR SELECT
TO authenticated
USING (criado_por = auth.uid());

CREATE POLICY "convites_insert_proprios"
ON public.convites
FOR INSERT
TO authenticated
WITH CHECK (
  criado_por = auth.uid()
  AND grupo_id = (SELECT profiles.grupo_id FROM public.profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "convites_update_proprios"
ON public.convites
FOR UPDATE
TO authenticated
USING (criado_por = auth.uid())
WITH CHECK (criado_por = auth.uid());