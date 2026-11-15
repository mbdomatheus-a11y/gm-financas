import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Sparkles, TrendingDown, TrendingUp, Repeat, PiggyBank } from "lucide-react";
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
export function BotaoLancamentoRapido({ flutuante = true }: { flutuante?: boolean }) {
  const { can } = usePermissoes();
  const navigate = useNavigate();
  const [escolha, setEscolha] = useState(false);
  const [ia, setIa] = useState(false);
  // Ação "Lançar" disparada pela barra inferior ou pelo menu do celular.
  useEffect(() => {
    const abrir = () => setEscolha(true);
    window.addEventListener("abrir-lancamento-rapido", abrir);
    return () => window.removeEventListener("abrir-lancamento-rapido", abrir);
  }, []);

  const podeDespesa = can("despesas", "editar");
  const podeReceita = can("receitas", "editar");
  if (!podeDespesa && !podeReceita) return null;

  function ir(destino: "/despesas" | "/receitas" | "/caixinhas", tipo?: "fixa" | "variavel") {
    setEscolha(false);
    if (destino === "/caixinhas") void navigate({ to: destino });
    else void navigate({ to: destino, search: (tipo ? { novo: true, tipo } : { novo: true }) as never });
  }

  return (
    <>
      {flutuante && (
      <Button
        onClick={() => setEscolha(true)}
        className="hidden lg:inline-flex fixed bottom-6 right-4 2xl:right-[calc(50%-800px+1.5rem)] z-40 h-14 gap-2 rounded-full px-5 text-base font-bold shadow-lg"
        aria-label="Lançar uma despesa, uma receita ou usar a IA"
        title="Lançar"
        data-tour="lancamento-ia"
      >
        <Plus className="size-6" />
        Lançar
      </Button>
      )}

      <Dialog open={escolha} onOpenChange={setEscolha}>
        {/* 15/11/2026: no celular a escolha sobe de baixo, perto do polegar; no computador segue no meio. */}
        <DialogContent className="max-w-sm max-sm:bottom-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
            <DialogDescription>Fale ou escreva para a IA, ou escolha o tipo.</DialogDescription>
          </DialogHeader>
          {/* 15/11/2026: IA primeiro e quatro tipos lado a lado (Entrada, Gasto, Conta fixa, Guardar). */}
          <div className="grid gap-2">
            <Button
              className="h-14 justify-start gap-3 text-base"
              onClick={() => {
                setEscolha(false);
                setIa(true);
              }}
            >
              <Sparkles className="size-5" /> Falar ou escrever com a IA
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {podeReceita && (
                <Button variant="outline" className="h-16 flex-col gap-1 text-sm font-semibold" onClick={() => ir("/receitas")}>
                  <TrendingUp className="size-5 text-emerald-600" /> Entrada
                </Button>
              )}
              {podeDespesa && (
                <Button variant="outline" className="h-16 flex-col gap-1 text-sm font-semibold" onClick={() => ir("/despesas", "variavel")}>
                  <TrendingDown className="size-5 text-rose-600" /> Gasto
                </Button>
              )}
              {podeDespesa && (
                <Button variant="outline" className="h-16 flex-col gap-1 text-sm font-semibold" onClick={() => ir("/despesas", "fixa")}>
                  <Repeat className="size-5 text-sky-600" /> Conta fixa
                </Button>
              )}
              <Button variant="outline" className="h-16 flex-col gap-1 text-sm font-semibold" onClick={() => ir("/caixinhas")}>
                <PiggyBank className="size-5 text-amber-600" /> Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LancamentoRapidoDialog open={ia} onOpenChange={setIa} />
    </>
  );
}
