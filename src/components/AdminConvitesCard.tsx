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
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" /> Todos os convites
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Códigos gerados por qualquer pessoa. Você pode cancelar os que ainda não foram usados.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : convites.length === 0 ? (
          <p className="rounded-2xl border px-4 py-6 text-center text-sm text-muted-foreground">Nenhum convite gerado ainda.</p>
        ) : (
          <div className="max-h-96 divide-y overflow-y-auto rounded-2xl border">
            {convites.map((c: any) => {
              const expirado = !c.usado && new Date(c.expiraEm).getTime() < agora;
              const podeCancelar = !c.usado && !expirado;
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <KeyRound className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{c.token}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Gerado por <span className="font-medium text-foreground">{c.criadoPorNome}</span> em <span className="tabular-nums">{formatDate(c.criadoEm)}</span>
                    </p>
                  </div>
                  <Badge
                    variant={c.usado ? "default" : expirado ? "destructive" : "secondary"}
                    className="shrink-0 rounded-full text-xs font-medium"
                  >
                    {c.usado ? "Usado" : expirado ? "Expirado" : "Pendente"}
                  </Badge>
                  {podeCancelar && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9 shrink-0 text-destructive hover:text-destructive"
                      disabled={cancelarMutation.isPending}
                      onClick={() => cancelarMutation.mutate(c.id)}
                      aria-label="Cancelar convite"
                    >
                      <X className="size-4" />
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
