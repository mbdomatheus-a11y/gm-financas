import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  marcarExemplosVistos,
  removerDadosExemplo,
  semearDadosExemplo,
} from "@/lib/dados-exemplo.functions";
import { useSession } from "@/hooks/useAuthData";

/**
 * Para contas novas: cria dados fictícios de exemplo (uma vez) e explica no
 * primeiro acesso que eles existem só para facilitar o entendimento do site.
 */
export function BoasVindasExemplos({
  bloqueado,
  onVisibilityChange,
}: {
  bloqueado: boolean;
  onVisibilityChange?: (aberto: boolean) => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const semear = useServerFn(semearDadosExemplo);
  const visto = useServerFn(marcarExemplosVistos);
  const remover = useServerFn(removerDadosExemplo);
  const [mostrar, setMostrar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    semear()
      .then((r) => {
        if (!vivo) return;
        if (r.mostrar) {
          setMostrar(true);
          void qc.invalidateQueries();
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user?.id, semear, qc]);

  async function fechar(apagar: boolean) {
    setOcupado(true);
    try {
      if (apagar) {
        await remover();
        toast.success("Dados de exemplo removidos (receitas, cartão, investimento e categorias).");
        void qc.invalidateQueries();
      }
      await visto();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover os dados de exemplo.");
    } finally {
      setOcupado(false);
      setMostrar(false);
    }
  }

  useEffect(() => {
    onVisibilityChange?.(mostrar);
  }, [mostrar, onVisibilityChange]);

  if (!mostrar || bloqueado) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && void fechar(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deixamos dados de exemplo na sua conta</DialogTitle>
          <DialogDescription className="text-foreground/90">
            São receitas, um cartão e um investimento fictícios, só para você ver o site funcionando.
            Dá para apagar agora ou depois.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={ocupado} onClick={() => fechar(true)}>
            Apagar exemplos
          </Button>
          <Button disabled={ocupado} onClick={() => fechar(false)}>
            Manter por enquanto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
