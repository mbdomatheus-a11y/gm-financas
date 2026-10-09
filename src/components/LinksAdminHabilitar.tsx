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
      <CardHeader>
        <CardTitle className="text-sm">Módulo Links (anotações)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Quando ligado, os outros usuários veem a lista de anotações ativas, só para leitura. Criar, editar,
          arquivar, excluir e unificar anotações é feito por você na própria tela de Links.
        </p>
        <label className="flex items-center gap-3">
          <Switch checked={ligado} disabled={!data || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
          <span>Habilitar para os outros usuários</span>
        </label>
        <Link to="/links" className="inline-block text-primary underline">
          Abrir a tela de Links
        </Link>
      </CardContent>
    </Card>
  );
}
