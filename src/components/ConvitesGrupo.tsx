import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  aceitarConviteGrupoPorId,
  excluirConviteGrupo,
  meusConvitesEnviados,
  meusConvitesRecebidos,
  meuStatusGrupo,
  recusarConviteGrupo,
  sairDoGrupo,
} from "@/lib/grupos.functions";

const ROTULO: Record<string, string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  recusado: "Recusado",
  cancelado: "Cancelado",
  expirado: "Expirado",
  revogado: "Revogado",
};

/** Aviso fixo no topo do app: convites pendentes para o e-mail do usuário. */
export function ConvitesRecebidosAviso() {
  const qc = useQueryClient();
  const listar = useServerFn(meusConvitesRecebidos);
  const aceitar = useServerFn(aceitarConviteGrupoPorId);
  const recusar = useServerFn(recusarConviteGrupo);
  const { data = [] } = useQuery({ queryKey: ["convites-grupo-recebidos"], queryFn: () => listar() });
  const pendentes = data.filter((c) => c.status === "pendente");
  const aceitando = useMutation({
    mutationFn: (id: string) => aceitar({ data: { id } }),
    onSuccess: () => {
      toast.success("Workspace integrado. Recarregando dados…");
      qc.clear();
      window.location.assign("/inicio");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const recusando = useMutation({
    mutationFn: (id: string) => recusar({ data: { id } }),
    onSuccess: () => {
      toast.success("Convite recusado.");
      void qc.invalidateQueries({ queryKey: ["convites-grupo-recebidos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  if (pendentes.length === 0) return null;
  return (
    <div className="space-y-3 border-b border-primary/40 bg-primary/5 px-4 py-3">
      {pendentes.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <p className="min-w-0 flex-1">
            <strong>{c.de}</strong> convidou você para integrar o workspace dele(a). Ao aceitar, você
            passa a ver os dados do grupo e o seu workspace atual fica guardado, sem alterações, até
            você sair do grupo.
          </p>
          <div className="flex justify-end gap-3">
            <Button size="sm" disabled={aceitando.isPending} onClick={() => aceitando.mutate(c.id)}>
              Aceitar
            </Button>
            <Button size="sm" variant="outline" disabled={recusando.isPending} onClick={() => recusando.mutate(c.id)}>
              Recusar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Histórico de convites (enviados e recebidos) com exclusão definitiva do registro. */
export function HistoricoConvitesGrupo() {
  const qc = useQueryClient();
  const env = useServerFn(meusConvitesEnviados);
  const rec = useServerFn(meusConvitesRecebidos);
  const excluir = useServerFn(excluirConviteGrupo);
  const { data: enviados = [] } = useQuery({ queryKey: ["convites-grupo-enviados"], queryFn: () => env() });
  const { data: recebidos = [] } = useQuery({ queryKey: ["convites-grupo-recebidos"], queryFn: () => rec() });
  const del = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Registro excluído.");
      void qc.invalidateQueries({ queryKey: ["convites-grupo-enviados"] });
      void qc.invalidateQueries({ queryKey: ["convites-grupo-recebidos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const itens = [
    ...enviados.map((c) => ({ id: c.id, texto: `Enviado para ${c.email}`, status: c.status, em: c.criadoEm })),
    ...recebidos.map((c) => ({ id: c.id, texto: `Recebido de ${c.de}`, status: c.status, em: c.criadoEm })),
  ].sort((a, b) => b.em.localeCompare(a.em));
  if (itens.length === 0) return null;
  return (
    <div className="space-y-3 pt-2">
      <p className="text-base font-bold">Histórico de convites</p>
      <div className="divide-y rounded-2xl border">
      {itens.map((c) => (
        <div key={`${c.texto}-${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{c.texto}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{ROTULO[c.status] ?? c.status}</span>
              <span className="tabular-nums">{new Date(c.em).toLocaleDateString("pt-BR")}</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 text-xs text-destructive hover:text-destructive"
            disabled={del.isPending}
            onClick={() => {
              if (window.confirm("Excluir definitivamente este registro? Isso não altera o acesso ao grupo.")) del.mutate(c.id);
            }}
          >
            Excluir
          </Button>
        </div>
      ))}
      </div>
    </div>
  );
}

/** Quem está no grupo de outra pessoa pode sair e voltar ao workspace original (guardado intacto). */
export function SairDoGrupoCard() {
  const qc = useQueryClient();
  const status = useServerFn(meuStatusGrupo);
  const sair = useServerFn(sairDoGrupo);
  const { data } = useQuery({ queryKey: ["meu-status-grupo"], queryFn: () => status() });
  const m = useMutation({
    mutationFn: () => sair(),
    onSuccess: () => {
      toast.success("Você voltou ao seu workspace original.");
      qc.clear();
      window.location.assign("/inicio");
    },
    onError: (e: any) => toast.error(e.message),
  });
  if (!data?.emGrupoDeOutro) return null;
  return (
    <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="text-sm">
        Você está usando o workspace de outro grupo. O seu workspace original está guardado, sem
        alterações, e volta quando você sair do grupo.
      </p>
      <div className="flex justify-end gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={m.isPending}
        onClick={() => {
          if (window.confirm("Sair do grupo e voltar ao seu workspace original?")) m.mutate();
        }}
      >
        Sair do grupo e voltar ao meu workspace
      </Button>
      </div>
    </div>
  );
}
