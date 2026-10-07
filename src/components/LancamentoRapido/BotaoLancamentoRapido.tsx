import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissoes } from "@/hooks/useAuthData";
import { LancamentoRapidoDialog } from "@/components/LancamentoRapido/LancamentoRapidoDialog";

/**
 * Botão flutuante "+ Lançar" (acessível de qualquer tela de Finanças). Ao tocar,
 * pergunta o que a pessoa quer fazer: lançar uma despesa, lançar uma receita ou
 * usar a IA (texto ou voz). Despesa e receita abrem o formulário pronto na tela
 * correspondente (`?novo=1`).
 * Ver `claude/plano-lancamento-ia-2026-10-01.md` no projeto Claude.
 *
 * Só aparece pra quem pode editar despesas OU receitas.
 */
export function BotaoLancamentoRapido() {
  const { can } = usePermissoes();
  const navigate = useNavigate();
  const [escolha, setEscolha] = useState(false);
  const [ia, setIa] = useState(false);

  const podeDespesa = can("despesas", "editar");
  const podeReceita = can("receitas", "editar");
  if (!podeDespesa && !podeReceita) return null;

  function ir(destino: "/despesas" | "/receitas") {
    setEscolha(false);
    void navigate({ to: destino, search: { novo: true } as never });
  }

  return (
    <>
      <Button
        onClick={() => setEscolha(true)}
        className="fixed bottom-20 right-4 z-40 h-14 gap-2 rounded-full px-5 text-base font-bold shadow-lg lg:bottom-6"
        aria-label="Lançar uma despesa, uma receita ou usar a IA"
        title="Lançar"
        data-tour="lancamento-ia"
      >
        <Plus className="size-6" />
        Lançar
      </Button>

      <Dialog open={escolha} onOpenChange={setEscolha}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>O que você quer lançar?</DialogTitle>
            <DialogDescription>Escolha uma opção. Você confere tudo antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {podeDespesa && (
              <Button variant="outline" className="h-14 justify-start gap-3 text-base" onClick={() => ir("/despesas")}>
                <TrendingDown className="size-5 text-rose-600" /> Despesa
              </Button>
            )}
            {podeReceita && (
              <Button variant="outline" className="h-14 justify-start gap-3 text-base" onClick={() => ir("/receitas")}>
                <TrendingUp className="size-5 text-emerald-600" /> Receita
              </Button>
            )}
            <Button
              className="h-14 justify-start gap-3 text-base"
              onClick={() => {
                setEscolha(false);
                setIa(true);
              }}
            >
              <Sparkles className="size-5" /> Lançar com IA (texto ou voz)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LancamentoRapidoDialog open={ia} onOpenChange={setIa} />
    </>
  );
}
