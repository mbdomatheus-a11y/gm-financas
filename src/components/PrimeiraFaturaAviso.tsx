import { useEffect, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";

/** Na primeira visita à importação (e sem nenhuma fatura importada), pergunta se quer importar a primeira. */
export function PrimeiraFaturaAviso({ onImportar }: { onImportar: () => void }) {
  const { user } = useSession();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!user) return;
    const chave = `control-all-primeira-fatura-${user.id}`;
    try {
      if (localStorage.getItem(chave)) return;
    } catch {
      return;
    }
    let cancelado = false;
    (async () => {
      const { count } = await supabase
        .from("import_faturas")
        .select("id", { count: "exact", head: true });
      if (cancelado) return;
      if ((count ?? 0) === 0) setAberto(true);
      else {
        try {
          localStorage.setItem(chave, "1");
        } catch {
          // ignorado
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user]);

  function fechar(importar: boolean) {
    if (user) {
      try {
        localStorage.setItem(`control-all-primeira-fatura-${user.id}`, "1");
      } catch {
        // ignorado
      }
    }
    setAberto(false);
    if (importar) setTimeout(onImportar, 150);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="size-5 text-primary" /> Importar sua primeira fatura?
          </DialogTitle>
          <DialogDescription>
            Escolha o PDF da fatura do seu cartão. Você confere linha a linha antes de salvar nada.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => fechar(false)}>
            Agora não
          </Button>
          <Button onClick={() => fechar(true)}>Sim, escolher fatura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
