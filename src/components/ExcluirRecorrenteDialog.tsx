import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { monthLabelLong } from "@/lib/format";
import type { ModoExclusao } from "@/lib/exclusao-recorrente";

/** Pergunta, antes de excluir um lançamento fixo, se vale só o mês ou também os seguintes. */
export function ExcluirRecorrenteDialog({
  aberto,
  onFechar,
  descricao,
  competencia,
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  descricao: string;
  competencia: string;
  onConfirmar: (modo: ModoExclusao) => void;
}) {
  const mes = monthLabelLong(competencia);
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <AlertDialogContent className="gap-4 rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lançamento fixo?</AlertDialogTitle>
          <AlertDialogDescription>
            "{descricao}" se repete todo mês. Os meses anteriores não mudam.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3">
          <Button variant="destructive" className="h-11 rounded-xl" onClick={() => onConfirmar("so_competencia")}>
            Só {mes}
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => onConfirmar("futuras")}>
            {mes} e todas as seguintes
          </Button>
        </div>
        <AlertDialogFooter className="gap-3 sm:space-x-0">
          <AlertDialogCancel className="mt-0 h-11 rounded-xl sm:h-10">Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
