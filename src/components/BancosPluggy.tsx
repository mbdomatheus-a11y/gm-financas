import type React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Landmark, Link2, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { RegrasPixReceita } from "@/components/RegrasPixReceita";
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
  pluggyListarSincronizacoes,
  pluggyEditarItem,
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

const dataBR = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");

/** Agrupa lançamentos importados por banco ou cartão e, dentro, por data (mais recente primeiro). */
/** Identificação curta da conta: cartão com bandeira e final, ou conta com o número. */
function identificadorConta(c: any): string {
  if (c.tipo === "CREDIT") return `Cartão ${c.bandeira ? `${c.bandeira} ` : ""}final ${c.cartao_final ?? "?"}`;
  return c.numero_conta ? `Conta ${c.numero_conta}` : "Conta";
}

/** Nomes dos bancos das contas de uma conexão, para o título do card (no lugar do conector genérico). */
function bancosDaConexao(contas: any[], itemId: string): string {
  return [...new Set(contas.filter((c) => c.item_id === itemId && c.banco_nome).map((c) => c.banco_nome as string))].join(", ");
}

/** Título do card: o nome que o usuário salvou vale mais; senão, os bancos das contas; senão, o conector. */
function tituloDaConexao(contas: any[], i: { item_id: string; conector: string | null }): string {
  const nome = (i.conector ?? "").trim();
  const generico = !nome || /^(meu\s*pluggy|meupluggy|pluggy|sandbox|banco)$/i.test(nome);
  if (!generico) return nome;
  return bancosDaConexao(contas, i.item_id) || nome || "Banco";
}

function agruparImportados(itens: any[]) {
  const mapa = new Map<
    string,
    { nome: string; quantidade: number; total: number; dias: Map<string, { data: string; total: number; itens: any[] }> }
  >();
  for (const d of itens) {
    const nome = d.cartao_final ? `${d.banco_nome ?? "Cartão"} · final ${d.cartao_final}` : (d.banco_nome ?? "Conta");
    const data = String(d.data_compra).slice(0, 10);
    let g = mapa.get(nome);
    if (!g) {
      g = { nome, quantidade: 0, total: 0, dias: new Map() };
      mapa.set(nome, g);
    }
    let dia = g.dias.get(data);
    if (!dia) {
      dia = { data, total: 0, itens: [] };
      g.dias.set(data, dia);
    }
    dia.itens.push(d);
    dia.total += d.valor_total;
    g.quantidade += 1;
    g.total += d.valor_total;
  }
  return [...mapa.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((g) => ({ ...g, dias: [...g.dias.values()].sort((a, b) => b.data.localeCompare(a.data)) }));
}

/** Agrupa o histórico de sincronizações por banco, com contagem de sucessos e falhas. */
function agruparHistorico(historico: any[], conectorDoItem: (itemId: string) => string) {
  const mapa = new Map<string, { nome: string; ok: number; falhas: number; entradas: any[] }>();
  for (const h of historico) {
    const nome = conectorDoItem(h.item_id);
    let g = mapa.get(nome);
    if (!g) {
      g = { nome, ok: 0, falhas: 0, entradas: [] };
      mapa.set(nome, g);
    }
    if (h.status === "ok") g.ok += 1;
    else if (h.status === "erro") g.falhas += 1;
    g.entradas.push(h);
  }
  return [...mapa.values()];
}


/** Moldura: na rota /pluggy vira página; dentro da Administração, só o conteúdo. */
function Moldura({ embutido, title, description, children }: { embutido: boolean; title: string; description?: string; children: React.ReactNode }) {
  if (embutido) return <>{children}</>;
  return (
    <AppLayout title={title} {...(description ? { description } : {})}>
      {children}
    </AppLayout>
  );
}

/** Bancos e cartões do Open Finance (Pluggy). 27/10/2026: também aparece como aba da Administração. */
export function ConteudoBancosPluggy({ embutido = false }: { embutido?: boolean }) {
  const qc = useQueryClient();
  const { data: ehAdmin, isLoading: carregandoAdmin } = useIsSiteAdmin();
  const status = useServerFn(pluggyStatus);
  const criarToken = useServerFn(pluggyCriarConnectToken);
  const registrar = useServerFn(pluggyRegistrarItem);
  const listar = useServerFn(pluggyListarItens);
  const remover = useServerFn(pluggyRemoverItem);
  const editarItem = useServerFn(pluggyEditarItem);
  const [editandoItem, setEditandoItem] = useState<{ itemId: string; nome: string } | null>(null);
  const buscar = useServerFn(pluggyBuscarMovimentos);
  const listarImportados = useServerFn(pluggyListarImportados);
  const rejeitar = useServerFn(pluggyRejeitarLancamento);
  const listarContas = useServerFn(pluggyListarContas);
  const sincronizar = useServerFn(pluggySincronizarAgora);
  const sincronizarTodos = useServerFn(pluggySincronizarTodos);
  const listarHistorico = useServerFn(pluggyListarSincronizacoes);
  const listarPatrimonio = useServerFn(pluggyListarPatrimonio);
  const [token, setToken] = useState<string | null>(null);
  const [Widget, setWidget] = useState<any>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [itemManual, setItemManual] = useState("");
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Aceita o link completo da conexão (meu.pluggy.ai/connections/<id>) ou só o Item ID.
  const extrairItemId = (texto: string): string | null => {
    const achado = texto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return achado && UUID.test(achado[0]) ? achado[0] : null;
  };
  const itemExtraido = extrairItemId(itemManual);
  // Links de meu.pluggy.ai/connections são conexões do produto Meu Pluggy, não itens da aplicação do site:
  // a API devolve 404. Para conectar um banco, use o botão "Conectar um banco" e escolha o banco na lista.
  const ehLinkMeuPluggy = /meu\.pluggy\.ai\/connections/i.test(itemManual);

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
  const renomear = useMutation({
    mutationFn: (p: { itemId: string; nome: string }) => editarItem({ data: p }),
    onSuccess: () => {
      toast.success("Nome da conexão salvo.");
      setEditandoItem(null);
      qc.invalidateQueries({ queryKey: ["pluggy-itens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const apagar = useMutation({
    mutationFn: (itemId: string) => remover({ data: { itemId } }),
    onSuccess: () => {
      toast.success("Banco removido e dados apagados.");
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
  const { data: historico } = useQuery({
    queryKey: ["pluggy-historico"],
    queryFn: () => listarHistorico(),
    enabled: !!ehAdmin,
    retry: false,
  });
  const ultimaDaConexao = (itemId: string) => historico?.historico.find((h: any) => h.item_id === itemId);
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
      qc.invalidateQueries({ queryKey: ["pluggy-itens"] });
      qc.invalidateQueries({ queryKey: ["pluggy-contas"] });
      qc.invalidateQueries({ queryKey: ["pluggy-importados"] });
      qc.invalidateQueries({ queryKey: ["pluggy-patrimonio"] });
      qc.invalidateQueries({ queryKey: ["pluggy-historico"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sincronizarItem = useMutation({
    mutationFn: (itemId: string) => sincronizar({ data: { itemId } }),
    onSuccess: (r) => {
      toast.success(`Sincronizado: ${r.transacoes} lançamentos lidos.`);
      qc.invalidateQueries({ queryKey: ["pluggy-itens"] });
      qc.invalidateQueries({ queryKey: ["pluggy-historico"] });
      qc.invalidateQueries({ queryKey: ["pluggy-patrimonio"] });
      qc.invalidateQueries({ queryKey: ["pluggy-contas"] });
      qc.invalidateQueries({ queryKey: ["pluggy-importados"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ocupado = sincronizarItem.isPending || sincronizarTudo.isPending;
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
      <Moldura embutido={embutido} title="Bancos (teste)">
        <Card>
          <CardContent className="p-6 text-sm">Recurso restrito à administração do site.</CardContent>
        </Card>
      </Moldura>
    );
  }

  const conectorDoItem = (itemId: string) => {
    const it = itens.itens.find((x) => x.item_id === itemId);
    return it ? tituloDaConexao(contas?.contas ?? [], it) : "Banco";
  };
  const grupos = agruparImportados(importados?.itens ?? []);
  const historicoPorBanco = agruparHistorico(historico?.historico ?? [], conectorDoItem);
  const totalImportados = importados?.itens.length ?? 0;
  const investimentos = patrimonio?.investimentos ?? [];
  const emprestimos = patrimonio?.emprestimos ?? [];
  const totalInvestido = investimentos.reduce((s: number, i: any) => s + (i.saldo ?? 0), 0);
  const totalDevedor = emprestimos.reduce((s: number, e: any) => s + (e.saldo_devedor ?? 0), 0);

  return (
    <Moldura
      embutido={embutido}
      title="Bancos e cartões (teste)"
      description="Conexão automática via Pluggy (Open Finance). Visível só para a administração, não afeta os outros usuários."
    >
      <div className="space-y-4">
        <RegrasPixReceita />

        {/* 1. Sincronização (compacta, no topo) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="mr-auto flex items-center gap-2 text-base">
                <RefreshCw className="size-4" aria-hidden="true" /> Sincronização
              </CardTitle>
              <Button
                size="sm"
                disabled={ocupado || itens.itens.length === 0}
                onClick={() => sincronizarTudo.mutate()}
              >
                {sincronizarTudo.isPending ? "Sincronizando todos…" : "Sincronizar todos os bancos"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {itens.itens.length === 0 && <p className="text-muted-foreground">Nenhum banco conectado ainda.</p>}
            {itens.itens.map((i) => {
              const u = ultimaDaConexao(i.item_id);
              const emAndamento = sincronizarItem.isPending && sincronizarItem.variables === i.item_id;
              return (
                <div
                  key={i.id}
                  aria-busy={emAndamento || undefined}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card p-4 shadow-sm transition-opacity",
                    ocupado && !emAndamento && "pointer-events-none opacity-50",
                  )}
                >
                  <span
                    className={cn("size-2 rounded-full", u?.status === "ok" ? "bg-success" : u ? "bg-destructive" : "bg-muted-foreground")}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 basis-full">
                    {editandoItem?.itemId === i.item_id ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          renomear.mutate({ itemId: i.item_id, nome: editandoItem.nome });
                        }}
                      >
                        <Input
                          autoFocus
                          value={editandoItem.nome}
                          onChange={(e) => setEditandoItem({ itemId: i.item_id, nome: e.target.value })}
                          placeholder="Nome do banco (ex.: Itaú)"
                          className="h-8"
                          maxLength={120}
                        />
                        <Button size="sm" type="submit" disabled={renomear.isPending || !editandoItem.nome.trim()}>
                          Salvar
                        </Button>
                        <Button size="sm" variant="ghost" type="button" onClick={() => setEditandoItem(null)}>
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <p className="flex items-center gap-1 font-medium">
                        {tituloDaConexao(contas?.contas ?? [], i)}
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Editar nome da conexão"
                          onClick={() => setEditandoItem({ itemId: i.item_id, nome: i.conector ?? "" })}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                      </p>
                    )}
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                      Chave: <code className="break-all">{i.item_id}</code>
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-muted hover:text-foreground"
                        aria-label="Copiar chave da conexão"
                        onClick={() => {
                          void navigator.clipboard.writeText(i.item_id).then(
                            () => toast.success("Chave copiada."),
                            () => toast.error("Não foi possível copiar."),
                          );
                        }}
                      >
                        <Copy className="size-3" aria-hidden="true" />
                      </button>
                    </p>
                    <ul className="text-xs text-muted-foreground">
                      {(contas?.contas ?? [])
                        .filter((c: any) => c.item_id === i.item_id)
                        .map((c: any) => (
                          <li key={c.id}>
                            {(c.banco_nome ?? "Banco não definido") + " · " + identificadorConta(c)}
                          </li>
                        ))}
                      {(contas?.contas ?? []).every((c: any) => c.item_id !== i.item_id) && <li>Contas ainda não sincronizadas</li>}
                    </ul>
                  </div>
                  {i.status && <Badge variant="outline">{i.status}</Badge>}
                  <span className={cn("min-w-0 flex-1 text-xs", u && u.status !== "ok" ? "text-destructive" : "text-muted-foreground")}>
                    {u
                      ? `${new Date(u.iniciado_em).toLocaleString("pt-BR")} · ${
                          u.status === "ok"
                            ? `${u.transacoes_lidas} lidos, ${u.despesas_criadas} novos`
                            : `falhou: ${u.mensagem ?? ""}`
                        }`
                      : "Nunca sincronizado"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ocupado}
                    onClick={() => sincronizarItem.mutate(i.item_id)}
                  >
                    {emAndamento ? "Sincronizando…" : "Sincronizar"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Remover conexão"
                    disabled={apagar.isPending || ocupado}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remover este banco? Apaga as contas, os lançamentos ainda não aprovados, os investimentos e o histórico dele. Despesas e receitas já aprovadas continuam.",
                        )
                      )
                        apagar.mutate(i.item_id);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 2. Contas e cartões */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contas e cartões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(contas?.contas.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma conta sincronizada ainda.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {contas?.contas.map((c: any) => (
                <div key={c.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{c.banco_nome ?? "Banco não definido"}</p>
                  <p className="text-xs text-muted-foreground">
                    {identificadorConta(c)}
                    {c.titular ? ` · Titular: ${c.titular}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">Nome no Open Finance: {c.nome ?? "não informado"}</p>
                  {c.tipo === "CREDIT" ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <li>Limite: {c.limite != null ? formatBRL(c.limite) : "não informado"}</li>
                      <li>Disponível: {c.limite_disponivel != null ? formatBRL(c.limite_disponivel) : "não informado"}</li>
                      <li>Fatura atual: {c.fatura_valor != null ? formatBRL(c.fatura_valor) : "não informado"}</li>
                      <li>Vencimento: {c.fatura_vencimento ? dataBR(c.fatura_vencimento) : "não informado"}</li>
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saldo: {c.saldo != null ? formatBRL(c.saldo) : "não informado"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 3. Conectar (link agrupado e resumido) */}
        <Card className={cn(ADMIN_ONLY_CARD)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="size-4" aria-hidden="true" /> Conectar banco ou cartão
              <span className={ADMIN_ONLY_TAG}>Só admin</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {st && !st.configurado && (
              <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                Faltam as variáveis PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor (Vercel). Veja docs/PENDENCIAS.md.
              </p>
            )}
            <ul className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-2">
              <li>Conexão protegida pelo Open Finance.</li>
              <li>Sistema regulamentado pelo Banco Central.</li>
              <li>Sua senha do banco não passa pelo Control ALL.</li>
              <li>Você desconecta quando quiser.</li>
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!st?.configurado || conectar.isPending} onClick={() => conectar.mutate()}>
                <Link2 className="mr-1.5 size-4" aria-hidden="true" />
                {conectar.isPending ? "Preparando…" : "Conectar um banco"}
              </Button>
              <span className="text-xs text-muted-foreground">
                A aplicação da Pluggy está em modo demo: esta janela só conecta o banco de teste (Sandbox). Bancos reais entram pelo
                Item ID do conector MeuPluggy, logo abaixo.
              </span>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Usar dados reais pelo Meu Pluggy (gratuito)</summary>
              <div className="mt-2 space-y-2">
                <p className="text-muted-foreground">
                  Conecte o banco no meu.pluggy.ai. Depois, no dashboard.pluggy.ai, abra sua aplicação, crie uma conexão com o conector
                  MeuPluggy (login com sua conta do Meu Pluggy), autorize o banco e copie o Item ID da conexão. Cole o Item ID aqui.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Item ID da aplicação do site"
                    value={itemManual}
                    onChange={(e) => setItemManual(e.target.value.trim())}
                    aria-label="Item ID da Pluggy"
                  />
                  <Button
                    disabled={!st?.configurado || !itemExtraido || ehLinkMeuPluggy || guardar.isPending}
                    onClick={() => itemExtraido && guardar.mutate({ itemId: itemExtraido, conector: "Meu Pluggy" })}
                  >
                    Adicionar
                  </Button>
                </div>
                {ehLinkMeuPluggy && (
                  <p className="text-destructive">
                    Este link é a página da conexão no Meu Pluggy, não o Item ID, e a Pluggy responde 404 para ele. O Item ID sai do
                    dashboard.pluggy.ai, na conexão criada na sua aplicação com o conector MeuPluggy.
                  </p>
                )}
              </div>
            </details>
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

        {/* 4. Investimentos e dívidas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Investimentos e empréstimos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Investimentos ({investimentos.length})</p>
                <p className="text-lg font-semibold tabular-nums">{formatBRL(totalInvestido)}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Saldo devedor ({emprestimos.length})</p>
                <p className="text-lg font-semibold tabular-nums">{formatBRL(totalDevedor)}</p>
              </div>
            </div>
            {investimentos.length > 0 && (
              <ul className="divide-y text-xs">
                {investimentos.map((i: any) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">
                      {i.nome ?? "Investimento"}
                      <span className="text-muted-foreground">
                        {" "}· {i.tipo ?? ""}
                        {i.instituicao ? ` · ${i.instituicao}` : ""}
                        {i.rentabilidade_anual != null ? ` · ${i.rentabilidade_anual}% a.a.` : ""}
                        {i.vencimento ? ` · vence ${dataBR(i.vencimento)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{i.saldo != null ? formatBRL(i.saldo) : "sem saldo"}</span>
                  </li>
                ))}
              </ul>
            )}
            {emprestimos.length > 0 && (
              <ul className="divide-y text-xs">
                {emprestimos.map((e: any) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">
                      {e.tipo ?? "Empréstimo"}
                      <span className="text-muted-foreground">
                        {" "}· {e.instituicao ?? ""}
                        {e.indexador ? ` · indexador ${e.indexador}` : ""}
                        {e.taxa_anual != null ? ` · ${e.taxa_anual}% a.a.` : ""}
                        {e.vencimento ? ` · vence ${dataBR(e.vencimento)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {e.saldo_devedor != null
                        ? `saldo ${formatBRL(e.saldo_devedor)}`
                        : e.valor_contratado != null
                          ? formatBRL(e.valor_contratado)
                          : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 5. Histórico resumido, agrupado por banco */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de sincronizações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {historicoPorBanco.length === 0 && (
              <p className="text-muted-foreground">Nenhuma sincronização registrada ainda.</p>
            )}
            {historicoPorBanco.map((g) => (
              <div key={g.nome}>
                <p className="font-medium">
                  {g.nome}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {g.ok} ok · {g.falhas} com falha
                  </span>
                </p>
                <ul className="mt-1 divide-y text-xs">
                  {g.entradas.slice(0, 5).map((h: any) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="tabular-nums text-muted-foreground">
                        {new Date(h.iniciado_em).toLocaleString("pt-BR")}
                      </span>
                      <span className={h.status === "ok" ? "text-success" : "text-destructive"}>
                        {h.status === "ok" ? "ok" : "falhou"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {h.status === "ok" ? `${h.transacoes_lidas} lidos, ${h.despesas_criadas} novos` : h.mensagem}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 6. Lançamentos importados, agrupados por banco/cartão e data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Lançamentos importados <span className="text-xs font-normal text-muted-foreground">({totalImportados})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Entram já aprovados. Você pode rejeitar o que não for seu; depois de 30 dias o lançamento fica congelado.
            </p>
            {grupos.length === 0 && <p className="text-muted-foreground">Nenhum lançamento importado ainda.</p>}
            {grupos.map((g) => (
              <section key={g.nome} className="rounded-lg border">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                  <span className="font-medium">{g.nome}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {g.quantidade} lançamento(s) · {formatBRL(g.total)}
                  </span>
                </header>
                {g.dias.map((dia) => (
                  <div key={dia.data} className="border-b px-3 py-2 last:border-b-0">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-muted-foreground">{dataBR(dia.data)}</span>
                      <span className="tabular-nums text-muted-foreground">{formatBRL(dia.total)}</span>
                    </div>
                    <ul className="divide-y">
                      {dia.itens.map((d: any) => (
                        <li key={d.id} className="flex items-center gap-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate">{d.descricao}</span>
                          <span className="shrink-0 tabular-nums">{formatBRL(d.valor_total)}</span>
                          {congelado(d) ? (
                            <Badge variant="outline">Congelado</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
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
                  </div>
                ))}
              </section>
            ))}
          </CardContent>
        </Card>

        {/* 7. Extrato dos últimos 30 dias (consulta direta na Pluggy) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Extrato dos últimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {itens.itens.length === 0 && <p className="text-muted-foreground">Nenhum banco conectado ainda.</p>}
            <div className="flex flex-wrap gap-2">
              {itens.itens.map((i) => (
                <Button
                  key={i.id}
                  size="sm"
                  variant={aberto === i.item_id ? "default" : "outline"}
                  onClick={() => setAberto(aberto === i.item_id ? null : i.item_id)}
                >
                  {tituloDaConexao(contas?.contas ?? [], i)}
                </Button>
              ))}
            </div>
            {aberto && (
              <div className="space-y-3">
                {mov.isLoading && <p className="text-muted-foreground">Consultando…</p>}
                {mov.error && <p className="text-destructive">{(mov.error as Error).message}</p>}
                {mov.data?.contas.map(({ conta, transacoes }) => (
                  <div key={conta.id} className="rounded-md bg-muted/40 p-2">
                    <p className="font-medium">
                      {conta.name} <span className="text-xs text-muted-foreground">({conta.subtype})</span> · saldo/fatura{" "}
                      {formatBRL(conta.balance)}
                    </p>
                    <ul className="mt-1 divide-y text-xs">
                      {transacoes.slice(0, 50).map((t) => (
                        <li key={t.id} className="flex justify-between gap-2 py-1">
                          <span className="min-w-0 truncate">
                            {dataBR(t.date)} · {t.description}
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
          </CardContent>
        </Card>
      </div>
    </Moldura>
  );
}
