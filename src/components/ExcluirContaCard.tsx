import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/useAuthData";
import { excluirMinhaConta } from "@/lib/conta-exclusao.functions";

/**
 * Item 9 (2026-10-05): "Excluir minha conta" em um só componente, usado em
 * Conta e em Backup e Reset. Mesmo comportamento: guarda por 90 dias e exige as
 * duas confirmações digitadas. A administração do site não pode se excluir.
 */
export function ExcluirContaCard({ className }: { className?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isSiteAdmin } = usePermissoes();
  const excluirConta = useServerFn(excluirMinhaConta);
  const [aberto, setAberto] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");

  const excluir = useMutation({
    mutationFn: () =>
      excluirConta({
        data: {
          modo: "recuperavel",
          confirmacao1: c1 as "DELETAR",
          confirmacao2: c2 as "Confirmo Delete",
        },
      }),
    onSuccess: async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/entrar", replace: true });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir a conta"),
  });

  return (
    <>
      <Card className={className ?? "border-destructive/30"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="size-4" /> Excluir minha conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ao excluir, seu acesso é encerrado e seus dados pessoais ficam disponíveis para
            recuperação por até 90 dias. Lançamentos compartilhados permanecem para os demais
            membros do grupo. A administração do site não pode excluir a própria conta.
          </p>
          <Button
            variant="destructive"
            disabled={isSiteAdmin}
            title={isSiteAdmin ? "A administração do site não pode excluir a própria conta" : undefined}
            onClick={() => setAberto(true)}
          >
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão da conta</DialogTitle>
            <DialogDescription>
              Esta ação encerra seu acesso imediatamente. Seus dados ficam guardados por 90 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Digite "DELETAR"</Label>
              <Input value={c1} onChange={(e) => setC1(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Digite "Confirmo Delete"</Label>
              <Input value={c2} onChange={(e) => setC2(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={c1 !== "DELETAR" || c2 !== "Confirmo Delete" || excluir.isPending}
              onClick={() => excluir.mutate()}
            >
              Excluir conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
