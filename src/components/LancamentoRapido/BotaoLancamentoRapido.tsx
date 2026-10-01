import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissoes } from "@/hooks/useAuthData";
import { LancamentoRapidoDialog } from "@/components/LancamentoRapido/LancamentoRapidoDialog";

/**
 * Botão flutuante de "lançamento rápido" (texto/áudio por IA) — pedido
 * explícito do usuário: acessível de qualquer tela autenticada, não escondido
 * dentro dos formulários de `/despesas`/`/receitas`. Montado dentro de
 * `AppLayout`, que já envolve praticamente toda tela autenticada.
 * Ver `claude/plano-lancamento-ia-2026-10-01.md` no projeto Claude.
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
        size="icon"
        className="fixed bottom-20 right-4 z-40 size-14 rounded-full shadow-lg lg:bottom-6"
        aria-label="Lançamento rápido por texto ou áudio"
        title="Lançamento rápido por texto ou áudio"
      >
        <Sparkles className="size-6" />
      </Button>
      <LancamentoRapidoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
