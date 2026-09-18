import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminCancelarConvite, adminListarConvites } from "@/lib/admin.functions";
import { formatDate } from "@/lib/format";

/**
 * Visão do admin sobre TODOS os convites gerados por TODOS os usuários (não
 * só os próprios) — inclui quem gerou cada um, e permite cancelar qualquer
 * convite pendente (ninguém além do admin pode cancelar convite de outra
 * pessoa, só o próprio dono ou um admin).
 */
export function AdminConvitesCard() {
  const qc = useQueryClient();
  const listar = useServerFn(adminListarConvites);
  const cancelar = useServerFn(adminCancelarConvite);

  const { data: convites = [], isLoading } = useQuery({
    queryKey: ["admin-convites"],
    queryFn: async () => listar(),
  });

  const cancelarMutation = useMutation({
    mutationFn: (conviteId: string) => cancelar({ data: { conviteId } }),
    onSuccess: () => {
      toast.success("Convite cancelado");
      qc.invalidateQueries({ queryKey: ["admin-convites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível cancelar o convite"),
  });

  const agora = Date.now();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldAlert className="size-4" /> Todos os convites (visão do admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Todo código gerado por qualquer pessoa aparece aqui, com quem gerou. Como admin, você
          pode cancelar qualquer convite ainda não usado.
        </p>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : convites.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum convite gerado ainda.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {convites.map((c: any) => {
              const expirado = !c.usado && new Date(c.expiraEm).getTime() < agora;
              const podeCancelar = !c.usado && !expirado;
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono">{c.token}</p>
                    <p className="text-muted-foreground">
                      Gerado por <strong>{c.criadoPorNome}</strong> em {formatDate(c.criadoEm)}
                    </p>
                  </div>
                  <Badge
                    variant={c.usado ? "default" : expirado ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {c.usado ? "usado" : expirado ? "expirado" : "pendente"}
                  </Badge>
                  {podeCancelar && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-destructive hover:text-destructive"
                      disabled={cancelarMutation.isPending}
                      onClick={() => cancelarMutation.mutate(c.id)}
                      aria-label="Cancelar convite"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
