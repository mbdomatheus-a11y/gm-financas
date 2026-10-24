import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Pede o código de 6 dígitos enviado ao e-mail (cadastro e troca de e-mail).
 * Revisão de segurança de 24/10/2026.
 */
export function DialogoCodigoEmail({
  aberto,
  emailMascarado,
  carregando,
  onConfirmar,
  onReenviar,
  onFechar,
}: {
  aberto: boolean;
  emailMascarado: string;
  carregando: boolean;
  onConfirmar: (codigo: string) => void;
  onReenviar: () => void;
  onFechar: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  useEffect(() => {
    if (aberto) setCodigo("");
  }, [aberto]);
  const valido = codigo.length === 6;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !carregando && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-1 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-6" />
          </div>
          <DialogTitle className="text-center">Confirme seu e-mail</DialogTitle>
          <DialogDescription className="text-center">
            Enviamos um código de 6 dígitos para <strong>{emailMascarado}</strong>. Ele vale por 15 minutos.
            Confira também a caixa de spam.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valido && !carregando) onConfirmar(codigo);
          }}
          className="space-y-4"
        >
          <Input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-label="Código de confirmação"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-14 text-center text-2xl font-semibold tracking-[0.5em]"
          />
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" className="h-11 w-full" disabled={!valido || carregando}>
              {carregando ? "Confirmando..." : "Confirmar"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" disabled={carregando} onClick={onReenviar}>
              Reenviar código
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
