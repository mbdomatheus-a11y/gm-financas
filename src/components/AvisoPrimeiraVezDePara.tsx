import { useEffect, useState } from "react";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/useAuthData";

/** Primeira visita à tela De-para: explica para que serve (uma vez por usuário). */
export function AvisoPrimeiraVezDePara() {
  const { user } = useSession();
  const [aberto, setAberto] = useState(false);
  const chave = user ? `control-all-depara-aviso-${user.id}` : null;

  useEffect(() => {
    if (!chave) return;
    try {
      if (!localStorage.getItem(chave)) setAberto(true);
    } catch {
      setAberto(true);
    }
  }, [chave]);

  function fechar() {
    if (chave) {
      try {
        localStorage.setItem(chave, "1");
      } catch {
        // ignorado
      }
    }
    setAberto(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="size-5 text-primary" /> Para que serve o De-para
          </DialogTitle>
          <DialogDescription>
            Aqui você cadastra regras: quando o nome de um estabelecimento aparecer na importação da
            fatura, o lançamento já entra com a categoria certa, sem você precisar escolher uma por
            uma. Você pode adicionar, editar e remover as regras quando quiser.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={fechar}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
