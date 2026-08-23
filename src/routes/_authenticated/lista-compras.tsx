import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Apple, Gamepad2, Plus, ShoppingCart, Sofa, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/lista-compras")({
  head: () => ({
    meta: [
      { title: "Lista de compras — Finanças do Casal" },
      {
        name: "description",
        content:
          "Lista de compras compartilhada do casal, dividida em alimentação, bens duráveis e diversão.",
      },
      { property: "og:title", content: "Lista de compras — Finanças do Casal" },
      {
        property: "og:description",
        content: "Adicione, marque e organize os itens que o casal precisa comprar.",
      },
    ],
  }),
  component: ListaComprasPage,
});

const CATEGORIAS = [
  { id: "alimentacao", label: "Alimentação", icon: Apple },
  { id: "bens_duraveis", label: "Bens duráveis", icon: Sofa },
  { id: "diversao", label: "Diversão", icon: Gamepad2 },
] as const;

type CategoriaId = (typeof CATEGORIAS)[number]["id"];

function ListaComprasPage() {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<CategoriaId>("alimentacao");
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  const { data: itens = [] } = useQuery({
    queryKey: ["lista-compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_compras")
        .select("*")
        .order("comprado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const doGrupo = useMemo(
    () => itens.filter((i) => i.categoria === categoria),
    [itens, categoria],
  );
  const pendentes = doGrupo.filter((i) => !i.comprado);
  const comprados = doGrupo.filter((i) => i.comprado);

  const adicionar = useMutation({
    mutationFn: async () => {
      const texto = nome.trim();
      if (texto.length < 2) throw new Error("Informe o nome do item");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("lista_compras").insert({
        nome: texto,
        categoria,
        quantidade: Math.max(1, Number(quantidade) || 1),
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      setQuantidade("1");
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: async (item: any) => {
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

  const excluir = useMutation({
    mutationFn: async (id: string) => {
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
      const ids = comprados.map((i) => i.id);
      if (!ids.length) return;
      const { error } = await supabase.from("lista_compras").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const Linha = ({ item }: { item: any }) => (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Checkbox
        checked={item.comprado}
        onCheckedChange={() => alternar.mutate(item)}
        aria-label={`Marcar ${item.nome}`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${item.comprado ? "text-muted-foreground line-through" : ""}`}
        >
          {item.nome}
        </p>
        {item.quantidade > 1 && (
          <p className="text-xs text-muted-foreground">{item.quantidade} un.</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => excluir.mutate(item.id)}
        aria-label="Remover item"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  return (
    <AppLayout
      title="Lista de compras"
      description="O que o casal precisa comprar"
      actions={
        comprados.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => limparComprados.mutate()}>
            Limpar comprados
          </Button>
        )
      }
    >
      <Tabs value={categoria} onValueChange={(v) => setCategoria(v as CategoriaId)}>
        <TabsList className="h-9">
          {CATEGORIAS.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs">
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar.mutate();
        }}
      >
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: sabonete, arroz, feijão…"
          className="flex-1"
        />
        <Input
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          inputMode="numeric"
          className="w-16"
          aria-label="Quantidade"
        />
        <Button type="submit" disabled={adicionar.isPending}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </form>

      <div className="mt-4 space-y-4">
        {doGrupo.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ShoppingCart className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum item nesta categoria ainda.</p>
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
                  Comprados ({comprados.length})
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
