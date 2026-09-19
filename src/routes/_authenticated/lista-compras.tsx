import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Apple,
  BellRing,
  CheckCircle2,
  Download,
  Gamepad2,
  MoreVertical,
  Plus,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Sofa,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { appSupabase } from "@/integrations/supabase/app-types";
import { usePermissoes, useSession } from "@/hooks/useAuthData";
import { useProfilesList } from "@/hooks/useFinance";
import { addMonths, formatDate, toISODate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/lista-compras")({
  head: () => ({
    meta: [
      { title: "Lista de compras — Control ALL" },
      {
        name: "description",
        content:
          "Lista de compras compartilhada do casal com datas, alertas de recompra, itens únicos e exportação.",
      },
      { property: "og:title", content: "Lista de compras — Control ALL" },
      {
        property: "og:description",
        content: "Adicione, marque, repita e exporte os itens que o casal precisa comprar.",
      },
    ],
  }),
  component: ListaComprasPage,
});

const CATEGORIAS = [
  { id: "alimentacao", label: "Alimentação", icon: Apple },
  { id: "bens_duraveis", label: "Bens duráveis", icon: Sofa },
  { id: "diversao", label: "Diversão", icon: Gamepad2 },
  { id: "outros", label: "Outros", icon: Sparkles },
] as const;

type CategoriaId = (typeof CATEGORIAS)[number]["id"];

const LIMITE = 2000;

function categoriaLabel(id: string) {
  return CATEGORIAS.find((c) => c.id === id)?.label ?? id;
}

function ListaComprasPage() {
  const { exclusaoBloqueada } = usePermissoes();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profiles = [] } = useProfilesList();
  const [lista, setLista] = useState<"compras" | "unicos">("compras");
  const [filtro, setFiltro] = useState<CategoriaId | "todas">("todas");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaId>("alimentacao");
  const [quantidade, setQuantidade] = useState("1");
  const [alertaEm, setAlertaEm] = useState("");
  const [aprovacoesNecessarias, setAprovacoesNecessarias] = useState("0");

  // Aprovação só faz sentido se houver alguém além de quem cria o item pra
  // aprovar — com 1 pessoa com acesso, o máximo selecionável é 0 (ninguém
  // pra aprovar); com 2, até 1; e assim por diante.
  const pessoasComAcesso = useMemo(() => (profiles as any[]).filter((p) => p.ativo), [profiles]);
  const maxAprovacoes = Math.max(0, pessoasComAcesso.length - 1);

  const { data: itens = [] } = useQuery({
    queryKey: ["lista-compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("*")
        .order("comprado")
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (error) throw error;
      return data ?? [];
    },
  });

  const daLista = useMemo(
    () =>
      itens.filter(
        (i) => (i.lista ?? "compras") === lista && (filtro === "todas" || i.categoria === filtro),
      ),
    [itens, lista, filtro],
  );
  const pendentes = daLista.filter((i) => !i.comprado);
  const comprados = daLista.filter((i) => i.comprado);

  const hoje = toISODate(new Date());
  const alertasVencidos = itens.filter((i) => i.alerta_em && i.alerta_em <= hoje);

  const adicionar = useMutation({
    mutationFn: async () => {
      const texto = nome.trim();
      if (texto.length < 2) throw new Error("Informe o nome do item");
      if (itens.length >= LIMITE) throw new Error(`Limite de ${LIMITE} itens atingido`);
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await appSupabase.from("lista_compras").insert({
        nome: texto,
        categoria,
        lista,
        quantidade: Math.max(1, Number(quantidade) || 1),
        alerta_em: alertaEm || null,
        aprovacoes_necessarias: Math.min(
          maxAprovacoes,
          Math.max(0, Number(aprovacoesNecessarias) || 0),
        ),
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      setQuantidade("1");
      setAlertaEm("");
      setAprovacoesNecessarias("0");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: async (item: any) => {
      if (!item.comprado) {
        const necessarias = item.aprovacoes_necessarias ?? 0;
        const aprovados = (item.aprovado_por ?? []).length;
        if (necessarias > 0 && aprovados < necessarias) {
          throw new Error(
            `Faltam ${necessarias - aprovados} aprovação(ões) para comprar "${item.nome}"`,
          );
        }
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("lista_compras")
        .update({
          comprado: !item.comprado,
          comprado_em: !item.comprado ? new Date().toISOString() : null,
          comprado_por: !item.comprado ? (auth.user?.id ?? null) : null,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Qualquer pessoa com acesso pode aprovar, exceto quem criou o item —
  // aprovar de novo remove a própria aprovação (alternância).
  const aprovar = useMutation({
    mutationFn: async (item: any) => {
      if (!user?.id) throw new Error("Sessão inválida");
      const atuais: string[] = item.aprovado_por ?? [];
      const jaAprovou = atuais.includes(user.id);
      const novaLista = jaAprovou ? atuais.filter((id) => id !== user.id) : [...atuais, user.id];
      const { error } = await appSupabase
        .from("lista_compras")
        .update({ aprovado_por: novaLista })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const repetir = useMutation({
    mutationFn: async (item: any) => {
      const { data: auth } = await supabase.auth.getUser();
      const proximo = toISODate(addMonths(new Date(), 1));
      const { error } = await supabase.from("lista_compras").insert({
        nome: item.nome,
        categoria: item.categoria,
        lista: item.lista ?? "compras",
        quantidade: item.quantidade,
        observacao: item.observacao,
        alerta_em: proximo,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item repetido para o próximo mês");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const definirAlerta = useMutation({
    mutationFn: async ({ item, dias }: { item: any; dias: number }) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      const { error } = await supabase
        .from("lista_compras")
        .update({ alerta_em: toISODate(d) })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta definido");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async (item: any) => {
      const destino = (item.lista ?? "compras") === "compras" ? "unicos" : "compras";
      const { error } = await supabase
        .from("lista_compras")
        .update({ lista: destino })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      if (exclusaoBloqueada) throw new Error("Seu perfil não possui permissão para excluir dados.");
      const { error } = await supabase.from("lista_compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const limparComprados = useMutation({
    mutationFn: async () => {
      if (exclusaoBloqueada) throw new Error("Seu perfil não possui permissão para excluir dados.");
      const ids = comprados.map((i) => i.id);
      if (!ids.length) return;
      const { error } = await supabase.from("lista_compras").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  function exportar() {
    const linhas = [
      ["Lista", "Item", "Categoria", "Qtd", "Solicitado em", "Concluído em", "Alerta em", "Status"],
      ...itens.map((i) => [
        (i.lista ?? "compras") === "compras" ? "Compras" : "Itens únicos",
        i.nome,
        categoriaLabel(i.categoria),
        String(i.quantidade),
        i.created_at ? formatDate(i.created_at) : "",
        i.comprado_em ? formatDate(i.comprado_em) : "",
        i.alerta_em ? formatDate(i.alerta_em) : "",
        i.comprado ? "Concluído" : "Pendente",
      ]),
    ];
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-compras-${toISODate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Linha = ({ item }: { item: any }) => {
    const alerta = item.alerta_em && item.alerta_em <= hoje;
    const necessarias: number = item.aprovacoes_necessarias ?? 0;
    const aprovadores: string[] = item.aprovado_por ?? [];
    const faltam = Math.max(0, necessarias - aprovadores.length);
    const souCriador = !!user?.id && item.created_by === user.id;
    const jaAprovei = !!user?.id && aprovadores.includes(user.id);
    const bloqueadoPorAprovacao = necessarias > 0 && faltam > 0 && !item.comprado;

    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Checkbox
          checked={item.comprado}
          onCheckedChange={() => alternar.mutate(item)}
          disabled={bloqueadoPorAprovacao}
          title={bloqueadoPorAprovacao ? `Faltam ${faltam} aprovação(ões)` : undefined}
          aria-label={`Marcar ${item.nome}`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium ${item.comprado ? "text-muted-foreground line-through" : ""}`}
          >
            {item.nome}
            {item.quantidade > 1 && (
              <span className="text-muted-foreground"> · {item.quantidade} un.</span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {categoriaLabel(item.categoria)} · pedido em{" "}
            {item.created_at ? formatDate(item.created_at) : "—"}
            {item.comprado_em && ` · concluído em ${formatDate(item.comprado_em)}`}
          </p>
          {item.alerta_em && (
            <p
              className={`mt-0.5 inline-flex items-center gap-1 text-xs ${alerta ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
              <BellRing className="size-3" /> Alerta em {formatDate(item.alerta_em)}
            </p>
          )}
          {necessarias > 0 && !item.comprado && (
            <div className="mt-1 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={
                  faltam > 0 ? "border-warning/40 text-warning" : "border-success/40 text-success"
                }
              >
                <ShieldCheck className="size-3" />
                {aprovadores.length}/{necessarias} aprovações
              </Badge>
              {!souCriador && (
                <Button
                  size="sm"
                  variant={jaAprovei ? "outline" : "default"}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => aprovar.mutate(item)}
                >
                  <CheckCircle2 className="size-3" />
                  {jaAprovei ? "Remover aprovação" : "Aprovar"}
                </Button>
              )}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Ações do item">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={bloqueadoPorAprovacao}
              onClick={() => alternar.mutate(item)}
            >
              {item.comprado ? "Reabrir item" : "Marcar como concluído"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => repetir.mutate(item)}>
              <Repeat className="size-4" /> Repetir no próximo mês
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => definirAlerta.mutate({ item, dias: 30 })}>
              <BellRing className="size-4" /> Lembrar em 30 dias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => definirAlerta.mutate({ item, dias: 90 })}>
              <BellRing className="size-4" /> Lembrar em 90 dias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => mover.mutate(item)}>
              Mover para{" "}
              {(item.lista ?? "compras") === "compras" ? "itens únicos" : "lista de compras"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => excluir.mutate(item.id)}>
              <Trash2 className="size-4" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <AppLayout
      title="Lista de compras"
      description={`${itens.length}/${LIMITE} itens registrados`}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportar}>
            <Download className="size-4" /> Exportar
          </Button>
          {comprados.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => limparComprados.mutate()}>
              Limpar concluídos
            </Button>
          )}
        </div>
      }
    >
      {alertasVencidos.length > 0 && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-3">
            <BellRing className="mt-0.5 size-4 text-destructive" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-destructive">
                {alertasVencidos.length} alerta(s) no prazo
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {alertasVencidos.map((i) => i.nome).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={lista} onValueChange={(v) => setLista(v as "compras" | "unicos")}>
        <TabsList className="h-9">
          <TabsTrigger value="compras" className="text-xs">
            Lista de compras
          </TabsTrigger>
          <TabsTrigger value="unicos" className="text-xs">
            Itens únicos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_170px_80px_170px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar.mutate();
        }}
      >
        <div>
          <Label className="sr-only">Item</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: sabonete, arroz, feijão…"
          />
        </div>
        <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaId)}>
          <SelectTrigger aria-label="Categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          inputMode="numeric"
          aria-label="Quantidade"
        />
        <Input
          type="date"
          value={alertaEm}
          onChange={(e) => setAlertaEm(e.target.value)}
          aria-label="Alertar em"
          title="Alertar em"
        />
        <Button type="submit" disabled={adicionar.isPending}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </form>

      {maxAprovacoes >= 1 && (
        <div className="mt-2 flex items-center gap-2">
          <Label className="shrink-0 text-xs text-muted-foreground">
            Aprovações p/ comprar este item
          </Label>
          <Select value={aprovacoesNecessarias} onValueChange={setAprovacoesNecessarias}>
            <SelectTrigger className="h-8 w-40" aria-label="Aprovações necessárias">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Nenhuma</SelectItem>
              {Array.from({ length: maxAprovacoes }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={filtro === "todas" ? "default" : "outline"}
          onClick={() => setFiltro("todas")}
        >
          Todas
        </Button>
        {CATEGORIAS.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={filtro === c.id ? "default" : "outline"}
            onClick={() => setFiltro(c.id)}
          >
            <c.icon className="size-4" /> {c.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {daLista.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ShoppingCart className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum item aqui ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendentes.length > 0 && (
              <div className="divide-y overflow-hidden rounded-xl border bg-card">
                {pendentes.map((i) => (
                  <Linha key={i.id} item={i} />
                ))}
              </div>
            )}
            {comprados.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">
                  Concluídos ({comprados.length})
                </p>
                <div className="divide-y overflow-hidden rounded-xl border bg-card">
                  {comprados.map((i) => (
                    <Linha key={i.id} item={i} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
