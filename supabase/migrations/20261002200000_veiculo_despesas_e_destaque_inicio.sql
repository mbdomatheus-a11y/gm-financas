-- Etapa "Módulo Veículo: preferências restantes" (plano-mega-2026-09-14.md,
-- Bloco 7): cada evento do veículo com custo pode, opcionalmente, também
-- aparecer no painel principal de despesas (cria uma despesa+parcela
-- espelhada, categoria "Veículo", com `despesa_id` de volta pro evento
-- pra manter os dois sincronizados em edição/exclusão); e o usuário pode
-- marcar no próprio perfil que a soma do módulo apareça destacada na
-- Início (card "Veículo").
ALTER TABLE public.veiculo_eventos
  ADD COLUMN IF NOT EXISTS aparecer_em_despesas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS despesa_id uuid REFERENCES public.despesas(id) ON DELETE SET NULL;

ALTER TABLE public.preferencias_usuario
  ADD COLUMN IF NOT EXISTS destacar_veiculo_inicio boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
