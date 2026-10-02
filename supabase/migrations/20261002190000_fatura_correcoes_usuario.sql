-- Etapa F (plano-importacao-v2.md): "ensinar" o parser dentro do site.
-- Registra correções manuais que o usuário faz na prévia de uma fatura
-- (data/descrição/valor) como sinal de treino por layout (`assinatura`,
-- o mesmo identificador de `fatura_layouts`), em vez de só a posição das
-- colunas. Na próxima fatura do mesmo layout, se um lançamento for
-- extraído com o valor bruto já visto aqui, a correção é aplicada antes
-- de mostrar a prévia ao usuário.
--
-- Nota: o nome/assinatura da policy de `fatura_layouts` na migration
-- antiga do repositório (20260908221935_...) está desatualizado em
-- relação ao schema real em produção (usa `grupo_id = private.meu_grupo_id()`,
-- com trigger `private.set_grupo_id()` — não a policy `is_active_member()`
-- escrita naquele arquivo). Esta migration já segue o padrão real.
CREATE TABLE IF NOT EXISTS public.fatura_correcoes_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES public.grupos(id),
  assinatura text NOT NULL,
  campo text NOT NULL CHECK (campo IN ('data_compra', 'descricao', 'valor')),
  valor_original text NOT NULL,
  valor_corrigido text NOT NULL,
  ocorrencias integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fatura_correcoes_usuario_uidx
  ON public.fatura_correcoes_usuario (assinatura, campo, valor_original);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fatura_correcoes_usuario TO authenticated;
GRANT ALL ON public.fatura_correcoes_usuario TO service_role;

ALTER TABLE public.fatura_correcoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY fatura_correcoes_usuario_do_grupo ON public.fatura_correcoes_usuario
  FOR ALL TO authenticated
  USING (grupo_id = private.meu_grupo_id())
  WITH CHECK (grupo_id = private.meu_grupo_id());

CREATE TRIGGER set_grupo_id_trigger BEFORE INSERT ON public.fatura_correcoes_usuario
  FOR EACH ROW EXECUTE FUNCTION private.set_grupo_id();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fatura_correcoes_usuario
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
