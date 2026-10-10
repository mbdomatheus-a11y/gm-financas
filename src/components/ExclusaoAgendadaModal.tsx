import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cancelarMinhaExclusao, minhaExclusaoAgendada } from "@/lib/exclusao-agendada.functions";

export function diasRestantes(previstaEm: string): number {
  return Math.max(0, Math.ceil((new Date(previstaEm).getTime() - Date.now()) / 86400000));
}

/**
 * Aviso bloqueante quando a conta do usuário foi marcada para exclusão pela
 * administração. Mostra quanto falta dos 90 dias e pergunta se ele quer
 * cancelar: "sim" restaura a conta, "não" encerra a sessão.
 */
export function ExclusaoAgendadaModal() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const buscar = useServerFn(minhaExclusaoAgendada);
  const cancelar = useServerFn(cancelarMinhaExclusao);
  const [enviando, setEnviando] = useState(false);
  const { data } = useQuery({
    queryKey: ["minha-exclusao-agendada"],
    queryFn: () => buscar(),
    staleTime: 60_000,
  });
  if (!data) return null;
  const dias = diasRestantes(data.previstaEm);
  const dataFinal = new Date(data.previstaEm).toLocaleDateString("pt-BR");

  async function restaurar() {
    setEnviando(true);
    try {
      await cancelar();
      toast.success("Exclusão cancelada. Sua conta foi restaurada.");
      await qc.invalidateQueries({ queryKey: ["minha-exclusao-agendada"] });
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível cancelar a exclusão");
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    qc.clear();
    void navigate({ to: "/entrar" });
  }

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sua conta será excluída</AlertDialogTitle>
          <AlertDialogDescription>
            A administração agendou a exclusão da sua conta e de todos os seus dados.{" "}
            <strong>
              Faltam {dias} {dias === 1 ? "dia" : "dias"}
            </strong>{" "}
            (até {dataFinal}). Deseja cancelar a exclusão e manter a conta?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={sair} disabled={enviando}>
            Não, sair
          </Button>
          <Button onClick={restaurar} disabled={enviando}>
            Sim, cancelar a exclusão
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
