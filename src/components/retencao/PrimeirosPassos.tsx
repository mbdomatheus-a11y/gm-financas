import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileUp, PencilLine, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LancamentoRapidoDialog } from "@/components/LancamentoRapido/LancamentoRapidoDialog";
import { InstalarAppCartao } from "@/components/retencao/InstalarApp";
import { statusPrimeirosPassos } from "@/lib/funil.functions";
import { rastrearEvento } from "@/lib/funil-cliente";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import { formatBRL } from "@/lib/format";

/**
 * Primeiro valor em 2 minutos (2026-10-17, plano de retenção).
 * Conta sem nenhum lançamento próprio vê um passo único: falar/digitar um gasto, enviar a
 * fatura do cartão ou lançar à mão. Quando o 1º lançamento aparece, mostra o resultado na
 * hora e convida a instalar o site na tela inicial. "Agora não" vale até fechar o navegador.
 * Enquanto este passo estiver pendente, o tour guiado espera (ver route.tsx).
 */
const CHAVE_ADIADO = "control-all.primeiros-passos-adiado";

function adiado() {
  try {
    return sessionStorage.getItem(CHAVE_ADIADO) === "1";
  } catch {
    return false;
  }
}

export function usePrimeirosPassosPendente() {
  const { user } = useSession();
  const fn = useServerFn(statusPrimeirosPassos);
  const [acompanhar, setAcompanhar] = useState(false);
  const q = useQuery({
    queryKey: ["primeiros-passos", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: acompanhar ? 5_000 : false,
    queryFn: () => fn(),
  });
  return { ...q, acompanhar, setAcompanhar };
}

export function PrimeirosPassos({ bloqueado, onPendenteChange }: { bloqueado: boolean; onPendenteChange?: (p: boolean) => void }) {
  const navigate = useNavigate();
  const { can } = usePermissoes();
  const { data, acompanhar, setAcompanhar } = usePrimeirosPassosPendente();
  const [aberto, setAberto] = useState(false);
  const [ia, setIa] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const pendenteAntes = useRef(false);
  const vistoRegistrado = useRef(false);

  const pendente = !!data && !data.feito && can("despesas", "editar");

  useEffect(() => {
    onPendenteChange?.(pendente || sucesso);
  }, [pendente, sucesso, onPendenteChange]);

  useEffect(() => {
    if (bloqueado || !pendente || adiado()) return;
    // Pequena espera: o aviso de dados de exemplo pode abrir logo depois do login.
    const t = window.setTimeout(() => {
      setAberto(true);
      pendenteAntes.current = true;
      if (!vistoRegistrado.current) {
        vistoRegistrado.current = true;
        rastrearEvento("primeiros_passos_visto");
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [bloqueado, pendente]);

  // Quando o 1º lançamento aparece, mostra o resultado.
  useEffect(() => {
    if (data?.feito && pendenteAntes.current) {
      pendenteAntes.current = false;
      setAcompanhar(false);
      setAberto(false);
      setSucesso(true);
      rastrearEvento("primeiros_passos_concluido", { valor: data.lancamentos });
    }
  }, [data?.feito, data?.lancamentos, setAcompanhar]);

  function escolher(op: "ia" | "fatura" | "manual") {
    setAberto(false);
    setAcompanhar(true);
    pendenteAntes.current = true;
    if (op === "ia") setIa(true);
    if (op === "fatura") void navigate({ to: "/importar" });
    if (op === "manual") void navigate({ to: "/despesas", search: { novo: true } as never });
  }

  function adiar() {
    try {
      sessionStorage.setItem(CHAVE_ADIADO, "1");
    } catch {
      /* ignora */
    }
    setAberto(false);
  }

  return (
    <>
      <Dialog open={aberto && !bloqueado} onOpenChange={(o) => !o && adiar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vamos ver quanto sobra no seu mês?</DialogTitle>
            <DialogDescription>Escolha um jeito de começar. Leva menos de 2 minutos e você confere tudo antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button className="h-auto justify-start gap-3 py-3 text-left" onClick={() => escolher("ia")}>
              <Sparkles className="size-5 shrink-0" />
              <span>
                <span className="block font-semibold">Falar ou digitar um gasto</span>
                <span className="block text-xs font-normal opacity-90">Ex.: "mercado, 85 reais no cartão"</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left" onClick={() => escolher("fatura")}>
              <FileUp className="size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">Enviar a fatura do cartão (PDF)</span>
                <span className="block text-xs font-normal text-muted-foreground">Veja todas as compras e quando cada parcela acaba.</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left" onClick={() => escolher("manual")}>
              <PencilLine className="size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">Lançar um gasto à mão</span>
                <span className="block text-xs font-normal text-muted-foreground">Valor, data e categoria.</span>
              </span>
            </Button>
          </div>
          <button type="button" onClick={adiar} className="mx-auto mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
            Agora não
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={sucesso} onOpenChange={setSucesso}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" /> Primeiro lançamento feito!
            </DialogTitle>
            <DialogDescription>
              {data && data.totalDespesasMes > 0
                ? `Neste mês você já tem ${formatBRL(data.totalDespesasMes)} em despesas e parcelas registradas.`
                : "Seu controle começou. Cada gasto lançado deixa o resumo do mês mais preciso."}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Envie a fatura do cartão para ver quando acaba cada parcela.</li>
            <li>• Toda segunda-feira você recebe por e-mail o resumo da semana.</li>
          </ul>
          <InstalarAppCartao forcar />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => { setSucesso(false); void navigate({ to: "/dashboard" }); }}>
              Ver meu resumo
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => { setSucesso(false); void navigate({ to: "/importar" }); }}>
              Enviar fatura
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LancamentoRapidoDialog
        open={ia}
        onOpenChange={(o) => {
          setIa(o);
          if (!o) setAcompanhar(true);
        }}
      />
    </>
  );
}
