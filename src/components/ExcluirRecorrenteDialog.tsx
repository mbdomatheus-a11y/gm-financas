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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lançamento fixo</AlertDialogTitle>
          <AlertDialogDescription>
            "{descricao}" é um lançamento fixo. Como deseja excluir? Os meses anteriores não serão alterados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Button variant="destructive" onClick={() => onConfirmar("so_competencia")}>
            Só {mes}
          </Button>
          <Button variant="outline" onClick={() => onConfirmar("futuras")}>
            {mes} e todas as seguintes
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
