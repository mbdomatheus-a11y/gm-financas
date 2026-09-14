import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useFinance";
import { usePermissoes } from "@/hooks/useAuthData";

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Control ALL" },
      {
        name: "description",
        content: "Crie, edite e remova categorias de receitas e despesas usadas nos lançamentos.",
      },
      { property: "og:title", content: "Categorias — Control ALL" },
      { property: "og:description", content: "Organize os lançamentos do casal por categoria." },
    ],
  }),
  component: CategoriasPage,
});

const CORES = [
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#16a34a",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#ea580c",
  "#ef4444",
  "#db2777",
  "#a855f7",
  "#6366f1",
  "#334155",
];

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da categoria").max(40),
  tipo: z.enum(["receita", "despesa"]),
  cor: z.string(),
});

function CategoriasPage() {
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const { data: categorias = [] } = useCategorias(tipo);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", cor: CORES[0] });

  const podeEditar = can("despesas", "editar") || can("receitas", "editar");

  function abrirNova() {
    setEditId(null);
    setForm({ nome: "", cor: CORES[0] });
    setOpen(true);
  }

  function abrirEdicao(c: any) {
    setEditId(c.id);
    setForm({ nome: c.nome, cor: c.cor ?? CORES[0] });
    setOpen(true);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({ nome: form.nome, tipo, cor: form.cor });
      const { error } = editId
        ? await supabase.from("categorias").update(parsed).eq("id", editId)
        : await supabase.from("categorias").insert(parsed);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Categoria atualizada" : "Categoria criada");
      setOpen(false);
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["categorias"] });
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria removida");
      qc.invalidateQueries({ queryKey: ["categorias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout
      title="Categorias"
      description="Organize receitas e despesas do jeito do casal"
      actions={
        podeEditar && (
          <Button size="sm" onClick={abrirNova}>
            <Plus className="size-4" /> Nova categoria
          </Button>
        )
      }
    >
      <Tabs value={tipo} onValueChange={(v) => setTipo(v as "despesa" | "receita")}>
        <TabsList className="h-9">
          <TabsTrigger value="despesa" className="text-xs">
            Despesas
          </TabsTrigger>
          <TabsTrigger value="receita" className="text-xs">
            Receitas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {categorias.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Tags className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {categorias.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: c.cor ?? "var(--muted-foreground)" }}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{c.nome}</p>
                {podeEditar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-primary"
                    onClick={() => abrirEdicao(c)}
                    aria-label="Editar categoria"
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                {podeEditar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => excluir.mutate(c.id)}
                    aria-label="Remover categoria"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Nome">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Mercado"
              />
            </Field>
            <Field label="Cor">
              <div className="flex flex-wrap gap-2">
                {CORES.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => setForm({ ...form, cor })}
                    aria-label={`Cor ${cor}`}
                    className={`size-7 rounded-full border-2 transition-transform ${
                      form.cor === cor ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {editId ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
