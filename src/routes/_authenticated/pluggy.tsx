import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Landmark, Link2, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsSiteAdmin } from "@/hooks/useAuthData";
import { formatBRL } from "@/lib/format";
import {
  pluggyBuscarMovimentos,
  pluggyCriarConnectToken,
  pluggyListarContas,
  pluggyListarImportados,
  pluggyListarPatrimonio,
  pluggyListarItens,
  pluggyRegistrarItem,
  pluggyRejeitarLancamento,
  pluggySincronizarAgora,
  pluggySincronizarTodos,
  pluggyRemoverItem,
  pluggyStatus,
} from "@/lib/pluggy.functions";
import { ADMIN_ONLY_CARD, ADMIN_ONLY_TAG } from "@/lib/areas";
import { cn } from "@/lib/utils";

/** Congelado: primeira importação, ou mais de 30 dias depois da importação (a trava está também no banco). */
function congelado(d: { importada_em: string | null; congelada: boolean }): boolean {
  if (d.congelada) return true;
  if (!d.importada_em) return false;
  return Date.now() - new Date(d.importada_em).getTime() > 30 * 86400000;
}

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
  const listarImportados = useServerFn(pluggyListarImportados);
  const rejeitar = useServerFn(pluggyRejeitarLancamento);
  const listarContas = useServerFn(pluggyListarContas);
  const sincronizar = useServerFn(pluggySincronizarAgora);
  const sincronizarTodos = useServerFn(pluggySincronizarTodos);
  const listarPatrimonio = useServerFn(pluggyListarPatrimonio);
  const [token, setToken] = useState<string | null>(null);
  const [Widget, setWidget] = useState<any>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [itemManual, setItemManual] = useState("");
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      setItemManual("");
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
  const { data: importados } = useQuery({
    queryKey: ["pluggy-importados"],
    queryFn: () => listarImportados(),
    enabled: !!ehAdmin,
    retry: false,
  });
  const { data: contas } = useQuery({
    queryKey: ["pluggy-contas"],
    queryFn: () => listarContas(),
    enabled: !!ehAdmin,
    retry: false,
  });
  const { data: patrimonio } = useQuery({
    queryKey: ["pluggy-patrimonio"],
    queryFn: () => listarPatrimonio(),
    enabled: !!ehAdmin,
    retry: false,
  });
  const sincronizarTudo = useMutation({
    mutationFn: () => sincronizarTodos(),
    onSuccess: (r) => {
      toast.success(
        `Sincronizados: ${r.ok} banco(s), ${r.lancamentos} lançamento(s) lidos${r.falhas ? `, ${r.falhas} com falha` : ""}.`,
      );
      qc.invalidateQueries({ queryKey: ["pluggy-contas"] });
      qc.invalidateQueries({ queryKey: ["pluggy-importados"] });
      qc.invalidateQueries({ queryKey: ["pluggy-patrimonio"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sincronizarItem = useMutation({
    mutationFn: (itemId: string) => sincronizar({ data: { itemId } }),
    onSuccess: (r) => {
      toast.success(`Sincronizado: ${r.transacoes} lançamentos lidos.`);
      qc.invalidateQueries({ queryKey: ["pluggy-contas"] });
      qc.invalidateQueries({ queryKey: ["pluggy-importados"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const recusar = useMutation({
    mutationFn: (transactionId: string) => rejeitar({ data: { transactionId } }),
    onSuccess: () => {
      toast.success("Lançamento rejeitado.");
      qc.invalidateQueries({ queryKey: ["pluggy-importados"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
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
              A conexão é feita na janela segura da Pluggy; o Control ALL nunca vê sua senha do banco. As saídas dos
              bancos e cartões conectados entram nas despesas já aprovadas; você pode rejeitar qualquer uma na lista abaixo.
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

        <Card className={cn(ADMIN_ONLY_CARD)}>
          <CardHeader>
            <CardTitle className="text-base">Usar dados reais pelo Meu Pluggy (gratuito)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Conecte seu banco real em meu.pluggy.ai (serviço gratuito da Pluggy para desenvolvedores). No painel da
              Pluggy, abra sua aplicação, clique em "Ir para Demo" e, no menu de três pontos, copie o Item ID. Cole aqui:
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-0 flex-1"
                placeholder="Item ID (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
                value={itemManual}
                onChange={(e) => setItemManual(e.target.value.trim())}
                aria-label="Item ID da Pluggy"
              />
              <Button
                disabled={!st?.configurado || !UUID.test(itemManual) || guardar.isPending}
                onClick={() => guardar.mutate({ itemId: itemManual, conector: "Meu Pluggy" })}
              >
                Adicionar
              </Button>
            </div>
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
            <CardTitle className="text-base">Contas e cartões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(contas?.contas.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma conta sincronizada ainda.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {contas?.contas.map((c: any) => (
                <div key={c.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    {c.nome ?? (c.tipo === "CREDIT" ? "Cartão" : "Conta")}
                    {c.cartao_final && <span className="text-xs text-muted-foreground"> · final {c.cartao_final}</span>}
                  </p>
                  {(c.numero_conta || c.titular) && (
                    <p className="text-xs text-muted-foreground">
                      {c.titular ? `Titular: ${c.titular}` : ""}
                      {c.titular && c.numero_conta ? " · " : ""}
                      {c.numero_conta ? `Conta: ${c.numero_conta}` : ""}
                    </p>
                  )}
                  {c.tipo === "CREDIT" ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <li>Limite: {c.limite != null ? formatBRL(c.limite) : "não informado"}</li>
                      <li>Disponível: {c.limite_disponivel != null ? formatBRL(c.limite_disponivel) : "não informado"}</li>
                      <li>Fatura atual: {c.fatura_valor != null ? formatBRL(c.fatura_valor) : "não informado"}</li>
                      <li>
                        Vencimento:{" "}
                        {c.fatura_vencimento
                          ? new Date(`${c.fatura_vencimento}T12:00:00`).toLocaleDateString("pt-BR")
                          : "não informado"}
                      </li>
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Saldo: {c.saldo != null ? formatBRL(c.saldo) : "não informado"}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Investimentos ({patrimonio?.investimentos.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(patrimonio?.investimentos.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum investimento importado.</p>
            )}
            <ul className="divide-y text-sm">
              {patrimonio?.investimentos.map((i: any) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {i.nome ?? "Investimento"}
                    <span className="text-xs text-muted-foreground">
                      {" "}· {i.tipo ?? ""}{i.instituicao ? ` · ${i.instituicao}` : ""}
                      {i.rentabilidade_anual != null ? ` · taxa ${i.rentabilidade_anual}% a.a.` : ""}
                      {i.vencimento ? ` · vence ${new Date(`${i.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{i.saldo != null ? formatBRL(i.saldo) : "sem saldo"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empréstimos e financiamentos ({patrimonio?.emprestimos.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(patrimonio?.emprestimos.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum empréstimo importado.</p>
            )}
            <ul className="divide-y text-sm">
              {patrimonio?.emprestimos.map((e: any) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {e.tipo ?? "Empréstimo"}
                    <span className="text-xs text-muted-foreground">
                      {" "}· {e.instituicao ?? ""}
                      {e.indexador ? ` · indexador ${e.indexador}` : ""}
                      {e.taxa_anual != null ? ` · taxa ${e.taxa_anual}% a.a.` : ""}
                      {e.vencimento ? ` · vence ${new Date(`${e.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {e.saldo_devedor != null ? `saldo ${formatBRL(e.saldo_devedor)}` : e.valor_contratado != null ? formatBRL(e.valor_contratado) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importadas automaticamente ({importados?.itens.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(importados?.itens.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum lançamento importado ainda.</p>
            )}
            <ul className="divide-y text-sm">
              {importados?.itens.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {new Date(`${d.data_compra}T12:00:00`).toLocaleDateString("pt-BR")} · {d.descricao}
                    <span className="text-xs text-muted-foreground"> · {d.cartao_final ? `cartão final ${d.cartao_final}` : d.banco_nome ?? "banco"}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatBRL(d.valor_total)}</span>
                  {congelado(d) ? (
                    <Badge variant="outline">Congelado</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={recusar.isPending}
                      onClick={() => recusar.mutate(d.pluggy_transaction_id)}
                      aria-label="Rejeitar lançamento"
                    >
                      <X className="mr-1 size-3.5" aria-hidden="true" />
                      Rejeitar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="mr-auto text-base">Conexões</CardTitle>
              <Button
                size="sm"
                disabled={sincronizarTudo.isPending || (itens.itens.length === 0)}
                onClick={() => sincronizarTudo.mutate()}
              >
                <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />
                {sincronizarTudo.isPending ? "Sincronizando todos…" : "Sincronizar todos os bancos"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {itens.itens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum banco conectado ainda.</p>}
            {itens.itens.map((i) => (
              <div key={i.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="mr-auto text-sm">{i.conector ?? "Banco"}</b>
                  {i.status && <Badge variant="outline">{i.status}</Badge>}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sincronizarItem.isPending}
                    onClick={() => sincronizarItem.mutate(i.item_id)}
                  >
                    {sincronizarItem.isPending ? "Sincronizando…" : "Sincronizar agora"}
                  </Button>
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
