import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Landmark, Link2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsSiteAdmin } from "@/hooks/useAuthData";
import { formatBRL } from "@/lib/format";
import {
  pluggyBuscarMovimentos,
  pluggyCriarConnectToken,
  pluggyListarItens,
  pluggyRegistrarItem,
  pluggyRemoverItem,
  pluggyStatus,
} from "@/lib/pluggy.functions";
import { ADMIN_ONLY_CARD, ADMIN_ONLY_TAG } from "@/lib/areas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pluggy")({
  head: () => ({ meta: [{ title: "Bancos (teste) | Control ALL" }, { name: "robots", content: "noindex" }] }),
  component: PluggyPage,
});

function PluggyPage() {
  const qc = useQueryClient();
  const { data: ehAdmin, isLoading: carregandoAdmin } = useIsSiteAdmin();
  const status = useServerFn(pluggyStatus);
  const criarToken = useServerFn(pluggyCriarConnectToken);
  const registrar = useServerFn(pluggyRegistrarItem);
  const listar = useServerFn(pluggyListarItens);
  const remover = useServerFn(pluggyRemoverItem);
  const buscar = useServerFn(pluggyBuscarMovimentos);
  const [token, setToken] = useState<string | null>(null);
  const [Widget, setWidget] = useState<any>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: st } = useQuery({ queryKey: ["pluggy-status"], queryFn: () => status(), enabled: !!ehAdmin, retry: false });
  const { data: itens = { itens: [] } } = useQuery({
    queryKey: ["pluggy-itens"],
    queryFn: () => listar(),
    enabled: !!ehAdmin,
    retry: false,
  });

  const conectar = useMutation({
    mutationFn: async () => {
      const [{ accessToken }, mod] = await Promise.all([criarToken(), import("react-pluggy-connect")]);
      setWidget(() => (mod as any).PluggyConnect ?? (mod as any).default);
      setToken(accessToken);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const guardar = useMutation({
    mutationFn: (p: { itemId: string; conector?: string }) => registrar({ data: p }),
    onSuccess: () => {
      toast.success("Banco conectado.");
      setToken(null);
      qc.invalidateQueries({ queryKey: ["pluggy-itens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const apagar = useMutation({
    mutationFn: (itemId: string) => remover({ data: { itemId } }),
    onSuccess: () => {
      toast.success("Conexão removida.");
      qc.invalidateQueries({ queryKey: ["pluggy-itens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mov = useQuery({
    queryKey: ["pluggy-mov", aberto],
    queryFn: () => buscar({ data: { itemId: aberto!, dias: 30 } }),
    enabled: !!aberto,
    retry: false,
  });

  if (!carregandoAdmin && !ehAdmin) {
    return (
      <AppLayout title="Bancos (teste)">
        <Card>
          <CardContent className="p-6 text-sm">Recurso restrito à administração do site.</CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Bancos e cartões (teste)"
      description="Conexão automática via Pluggy (Open Finance). Visível só para a administração, não afeta os outros usuários."
    >
      <div className="space-y-4">
        <Card className={cn(ADMIN_ONLY_CARD)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="size-4" aria-hidden="true" /> Conectar banco ou cartão
              <span className={ADMIN_ONLY_TAG}>Só admin</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              A conexão é feita na janela segura da Pluggy; o Control ALL nunca vê sua senha do banco. Nesta fase os
              movimentos são só exibidos, nada é gravado nas suas despesas e receitas.
            </p>
            {st && !st.configurado && (
              <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                Faltam as variáveis PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor (Vercel). Veja docs/PENDENCIAS.md.
              </p>
            )}
            <Button disabled={!st?.configurado || conectar.isPending} onClick={() => conectar.mutate()}>
              <Link2 className="mr-1.5 size-4" aria-hidden="true" />
              {conectar.isPending ? "Preparando…" : "Conectar um banco"}
            </Button>
          </CardContent>
        </Card>

        {token && Widget && (
          <Widget
            connectToken={token}
            includeSandbox
            language="pt"
            onSuccess={({ item }: any) => guardar.mutate({ itemId: item.id, conector: item.connector?.name })}
            onError={() => toast.error("Não foi possível concluir a conexão.")}
            onClose={() => setToken(null)}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conexões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {itens.itens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum banco conectado ainda.</p>}
            {itens.itens.map((i) => (
              <div key={i.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="mr-auto text-sm">{i.conector ?? "Banco"}</b>
                  {i.status && <Badge variant="outline">{i.status}</Badge>}
                  <Button size="sm" variant="outline" onClick={() => setAberto(aberto === i.item_id ? null : i.item_id)}>
                    <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />
                    {aberto === i.item_id ? "Fechar" : "Ver últimos 30 dias"}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8"
                    aria-label="Remover conexão"
                    disabled={apagar.isPending}
                    onClick={() => apagar.mutate(i.item_id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                {aberto === i.item_id && (
                  <div className="mt-3 space-y-3">
                    {mov.isLoading && <p className="text-sm text-muted-foreground">Consultando…</p>}
                    {mov.error && <p className="text-sm text-destructive">{(mov.error as Error).message}</p>}
                    {mov.data?.contas.map(({ conta, transacoes }) => (
                      <div key={conta.id} className="rounded-md bg-muted/40 p-2">
                        <p className="text-sm font-medium">
                          {conta.name} <span className="text-xs text-muted-foreground">({conta.subtype})</span> · saldo/fatura{" "}
                          {formatBRL(conta.balance)}
                        </p>
                        <ul className="mt-1 divide-y text-xs">
                          {transacoes.slice(0, 50).map((t) => (
                            <li key={t.id} className="flex justify-between gap-2 py-1">
                              <span className="min-w-0 truncate">
                                {new Date(t.date).toLocaleDateString("pt-BR")} · {t.description}
                              </span>
                              <span className={t.amount < 0 ? "text-destructive" : "text-success"}>{formatBRL(t.amount)}</span>
                            </li>
                          ))}
                          {transacoes.length === 0 && <li className="py-1 text-muted-foreground">Sem movimentos no período.</li>}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
