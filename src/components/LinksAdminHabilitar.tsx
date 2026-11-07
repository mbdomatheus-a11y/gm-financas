import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { adminListarModulos, adminSalvarModulo } from "@/lib/configuracoes-site.functions";

/** Administração: só a opção de habilitar o módulo Links para os outros usuários. */
export function LinksAdminHabilitar() {
  const qc = useQueryClient();
  const listar = useServerFn(adminListarModulos);
  const salvar = useServerFn(adminSalvarModulo);
  const { data } = useQuery({ queryKey: ["admin-modulo-links"], queryFn: () => listar() });
  const ligado = !!data?.modulos.find((m: any) => m.modulo === "links")?.habilitado;
  const m = useMutation({
    mutationFn: (habilitado: boolean) => salvar({ data: { modulo: "links", habilitado, userId: null } }),
    onSuccess: () => {
      toast.success("Módulo Links atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin-modulo-links"] });
      void qc.invalidateQueries({ queryKey: ["modulos-disponiveis"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-bold">Módulo Links</CardTitle>
        <p className="text-sm text-muted-foreground">Anotações que os outros usuários podem ler.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="divide-y rounded-2xl border">
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium">Habilitar para os outros usuários</span>
              <span className="block text-xs text-muted-foreground">Só leitura. Criar, editar e arquivar continua com você.</span>
            </span>
            <Switch checked={ligado} disabled={!data || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
          </label>
          <Link to="/links" className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-muted/40">
            Abrir a tela de Links
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
