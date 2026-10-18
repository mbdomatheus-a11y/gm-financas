import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsSiteAdmin } from "@/hooks/useAuthData";
import { definirModoCliente, useModoCliente } from "@/lib/modo-cliente";

/**
 * Botão fixo na home para o admin do site alternar entre a visão admin e a visão
 * de um usuário comum. Só aparece para admin do site.
 */
export function ModoClienteControle({ className = "" }: { className?: string }) {
  const { data: admin } = useIsSiteAdmin();
  const modo = useModoCliente();
  if (!admin) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-4 py-2 text-sm ${className}`}
    >
      <span className="text-muted-foreground">
        {modo
          ? "Você está vendo o app como um usuário comum. Itens administrativos ficam ocultos."
          : "Você é admin do site. Quer ver o app exatamente como um usuário comum?"}
      </span>
      <Button
        size="sm"
        variant={modo ? "default" : "outline"}
        onClick={() => definirModoCliente(!modo)}
      >
        {modo ? <EyeOff className="mr-1.5 size-4" /> : <Eye className="mr-1.5 size-4" />}
        {modo ? "Voltar à visão admin" : "Ver como usuário comum"}
      </Button>
    </div>
  );
}
