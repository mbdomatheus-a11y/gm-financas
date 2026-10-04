import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissoes } from "@/hooks/useAuthData";
import { LancamentoRapidoDialog } from "@/components/LancamentoRapido/LancamentoRapidoDialog";

/**
 * Botão flutuante de "lançar ou resumir com IA" (texto/áudio) — pedido
 * explícito do usuário: acessível de qualquer tela autenticada, não escondido
 * dentro dos formulários de `/despesas`/`/receitas`. Montado dentro de
 * `AppLayout`, que já envolve praticamente toda tela autenticada.
 * Ver `claude/plano-lancamento-ia-2026-10-01.md` e
 * `claude/plano-fase2-lancamento-2026-10-02.md` no projeto Claude.
 *
 * Com texto visível ao lado do ícone (não só ícone) — pedido explícito do
 * usuário na Frente 1 do plano de 2026-10-02: "botão precisa ser mais claro"
 * pra quem ainda não conhece a funcionalidade.
 *
 * Só aparece pra quem pode editar despesas OU receitas — quem só tem
 * permissão de "ver" não ganha um atalho pra criar lançamento.
 */
export function BotaoLancamentoRapido() {
  const { can } = usePermissoes();
  const [open, setOpen] = useState(false);

  if (!can("despesas", "editar") && !can("receitas", "editar")) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 h-12 gap-2 rounded-full px-4 shadow-lg lg:bottom-6"
        aria-label="Lançar com IA ou ver resumo das finanças"
        title="Lançar com IA ou ver resumo das finanças"
        data-tour="lancamento-ia"
      >
        <Sparkles className="size-5" />
        <span className="hidden sm:inline">Lançar com IA</span>
      </Button>
      <LancamentoRapidoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
