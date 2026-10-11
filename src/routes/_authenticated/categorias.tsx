import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, Pencil, Plus, Tags, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useEstruturaCategorias } from "@/hooks/useEstruturaCategorias";
import { useCategoriasPadrao } from "@/hooks/useCategoriasPadrao";
import { usePermissoes } from "@/hooks/useAuthData";
import { baixarTxt, baixarXlsx } from "@/lib/exportar-planilha";
import {
  CABECALHO_CATEGORIAS,
  lerPlanilhaCategorias,
  linhasListaSugerida,
  linhasMinhasCategorias,
} from "@/lib/categorias-planilha";

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
  const { can, exclusaoBloqueada } = usePermissoes();
  const { mapa: padraoMapa } = useCategoriasPadrao();
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const { data: categorias = [] } = useCategorias(tipo);
  const { estrutura, subcategorias, criarSubcategoria, excluirSubcategorias } =
    useEstruturaCategorias(tipo);
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const [novaSub, setNovaSub] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<null | "selecionadas" | "todas">(null);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", cor: CORES[0] });

  const podeEditar = can("despesas", "editar") || can("receitas", "editar");
  const inputRef = useRef<HTMLInputElement>(null);

  async function importar(file: File | undefined) {
    if (!file) return;
    try {
      const linhas = await lerPlanilhaCategorias(file, tipo);
      if (linhas.length === 0) {
        toast.error("Nenhuma categoria encontrada no arquivo.");
        return;
      }
      const { data: existentes, error: e1 } = await supabase.from("categorias").select("nome,tipo");
      if (e1) throw e1;
      const ja = new Set(
        (existentes ?? []).map((c: any) => `${c.tipo}:${String(c.nome).toLowerCase()}`),
      );
      const novas = linhas
        .filter((l) => !ja.has(`${l.tipo}:${l.nome.toLowerCase()}`))
        .map((l, i) => ({ nome: l.nome, tipo: l.tipo, cor: l.cor ?? CORES[i % CORES.length]! }));
      if (novas.length === 0) {
        toast.info("Todas as categorias do arquivo já existem.");
        return;
      }
      const { error } = await supabase.from("categorias").insert(novas);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["categorias"] });
      toast.success(`${novas.length} categoria(s) criada(s). ${linhas.length - novas.length} já existiam.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível importar o arquivo.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

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
    onError: (e: any) =>
      toast.error(
        String(e?.message ?? "").includes("duplicate key")
          ? "Você já tem uma categoria com esse nome."
          : (e?.errors?.[0]?.message ?? e.message),
      ),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      if (exclusaoBloqueada) throw new Error("Seu perfil não possui permissão para excluir dados.");
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria removida");
      qc.invalidateQueries({ queryKey: ["categorias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluirSelecionadas = useMutation({
    mutationFn: async ({ ids, subIds }: { ids: string[]; subIds: string[] }) => {
      if (exclusaoBloqueada) throw new Error("Seu perfil não possui permissão para excluir dados.");
      if (ids.length) {
        const { error } = await supabase.from("categorias").delete().in("id", ids);
        if (error) throw error;
      }
      if (subIds.length) await excluirSubcategorias.mutateAsync(subIds);
    },
    onSuccess: (_r, v) => {
      toast.success(`${v.ids.length + v.subIds.length} item(ns) removido(s).`);
      setSel(new Set());
      setConfirmar(null);
      qc.invalidateQueries({ queryKey: ["categorias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  /** Backup no mesmo formato da planilha de categorias, para reimportar se precisar. */
  function baixarBackup() {
    const linhas = [
      ...linhasMinhasCategorias(categorias as any[], tipo),
      ...subcategorias.map((x) => [tipo, x.categoria, x.nome, ""]),
    ];
    baixarTxt(`backup-categorias-${tipo}`, CABECALHO_CATEGORIAS, linhas);
  }

  function alternarSel(id: string) {
    setSel((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const idsUsuario = (categorias as any[]).map((c) => c.id as string);
  const todasMarcadas = idsUsuario.length > 0 && idsUsuario.every((id) => sel.has(id));
  const subsDoUsuario = subcategorias;
  const subIdPorChave = new Map(subsDoUsuario.map((x) => [`${x.categoria}|${x.nome}`, x.id]));

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

      <Card className="mt-4">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-medium">Baixar, editar e enviar de volta</p>
          <p className="text-xs text-muted-foreground">
            Baixe a lista sugerida completa do site (ou as suas categorias), edite no Excel ou no
            bloco de notas e envie o arquivo. Só as categorias novas são criadas; as que já existem
            não são alteradas nem duplicadas. A coluna "subcategoria" serve de referência.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => baixarXlsx(`categorias-sugeridas-${tipo}`, CABECALHO_CATEGORIAS, linhasListaSugerida(padraoMapa, tipo))}>
              <Download className="size-4" /> Modelo de {tipo === "receita" ? "receitas" : "despesas"} (Excel)
            </Button>
            <Button variant="outline" size="sm" onClick={() => baixarTxt(`categorias-sugeridas-${tipo}`, CABECALHO_CATEGORIAS, linhasListaSugerida(padraoMapa, tipo))}>
              <Download className="size-4" /> Modelo de {tipo === "receita" ? "receitas" : "despesas"} (TXT)
            </Button>
            <Button variant="outline" size="sm" onClick={() => baixarXlsx(`minhas-categorias-${tipo}`, CABECALHO_CATEGORIAS, linhasMinhasCategorias(categorias as any[], tipo))}>
              <Download className="size-4" /> Minhas (Excel)
            </Button>
            <Button variant="outline" size="sm" onClick={() => baixarTxt(`minhas-categorias-${tipo}`, CABECALHO_CATEGORIAS, linhasMinhasCategorias(categorias as any[], tipo))}>
              <Download className="size-4" /> Minhas (TXT)
            </Button>
            {podeEditar && (
              <>
                <Button size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload className="size-4" /> Enviar arquivo
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => void importar(e.target.files?.[0])}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {tipo === "despesa" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Macro categorias e subcategorias</p>
          <p className="text-xs text-muted-foreground">
            Toque numa macro para ver as subcategorias. As padrão vêm do site. As que você cria aparecem como "sua" e podem ser removidas.
          </p>
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {estrutura.map((e) => {
              const aberta = !!abertas[e.macro];
              return (
                <div key={e.macro}>
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() => setAbertas((a) => ({ ...a, [e.macro]: !aberta }))}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-accent"
                  >
                    {aberta ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.macro}</span>
                    <span className="text-xs text-muted-foreground">{e.subcategorias.length} sub</span>
                  </button>
                  {aberta && (
                    <div className="space-y-1.5 bg-muted/30 py-2.5 pl-9 pr-3">
                      {e.subcategorias.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhuma subcategoria ainda.</p>
                      )}
                      {e.subcategorias.map((sub) => {
                        const subId = subIdPorChave.get(`${e.macro}|${sub}`);
                        const ehPadrao = (padraoMapa[e.macro] ?? []).includes(sub);
                        return (
                          <div key={sub} className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">{sub}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {subId ? "sua" : ehPadrao ? "padrão" : "cadastrada"}
                            </span>
                            {subId && podeEditar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                aria-label={`Remover subcategoria ${sub}`}
                                onClick={() => excluirSubcategorias.mutate([subId])}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                      {podeEditar && (
                        <form
                          className="flex gap-2 pt-1"
                          onSubmit={(ev) => {
                            ev.preventDefault();
                            const t = (novaSub[e.macro] ?? "").trim();
                            if (!t) return;
                            criarSubcategoria.mutate(
                              { categoria: e.macro, nome: t },
                              {
                                onSuccess: () => {
                                  setNovaSub((a) => ({ ...a, [e.macro]: "" }));
                                  toast.success("Subcategoria criada");
                                },
                                onError: (err: any) => toast.error(err.message),
                              },
                            );
                          }}
                        >
                          <Input
                            className="h-8 text-xs"
                            placeholder={`Nova subcategoria de ${e.macro}`}
                            value={novaSub[e.macro] ?? ""}
                            onChange={(ev) => setNovaSub((a) => ({ ...a, [e.macro]: ev.target.value }))}
                          />
                          <Button size="sm" type="submit" disabled={!(novaSub[e.macro] ?? "").trim()}>
                            <Plus className="size-4" /> Adicionar
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm font-medium">
            {tipo === "despesa" ? "Categorias cadastradas" : "Categorias de receita"}
          </p>
          {podeEditar && idsUsuario.length > 0 && (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={todasMarcadas}
                onCheckedChange={(v) => setSel(v ? new Set(idsUsuario) : new Set())}
                aria-label="Selecionar todas as categorias"
              />
              Selecionar todas
            </label>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={baixarBackup}
            disabled={idsUsuario.length === 0 && subsDoUsuario.length === 0}
          >
            <Download className="size-4" /> Backup
          </Button>
          {podeEditar && (
            <Button variant="outline" size="sm" disabled={sel.size === 0} onClick={() => setConfirmar("selecionadas")}>
              <Trash2 className="size-4" /> Excluir selecionadas ({sel.size})
            </Button>
          )}
          {podeEditar && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={idsUsuario.length === 0 && subsDoUsuario.length === 0}
              onClick={() => setConfirmar("todas")}
            >
              Excluir todas
            </Button>
          )}
        </div>

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
                {podeEditar && (
                  <Checkbox
                    checked={sel.has(c.id)}
                    onCheckedChange={() => alternarSel(c.id)}
                    aria-label={`Selecionar ${c.nome}`}
                  />
                )}
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
      <AlertDialog open={confirmar !== null} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar === "todas" ? "Excluir todas as categorias?" : `Excluir ${sel.size} categoria(s)?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === "todas"
                ? `Serão removidas ${idsUsuario.length} categoria(s) e ${subsDoUsuario.length} subcategoria(s) criadas por você neste tipo.`
                : `Serão removidas ${sel.size} categoria(s) selecionada(s).`}{" "}
              Os lançamentos já salvos continuam com o nome que tinham. Esta ação não pode ser desfeita.
              Antes de excluir, baixe um backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={baixarBackup}>
              <Download className="size-4" /> Baixar backup
            </Button>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluirSelecionadas.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                const todas = confirmar === "todas";
                excluirSelecionadas.mutate({
                  ids: todas ? idsUsuario : [...sel],
                  subIds: todas ? subsDoUsuario.map((x) => x.id) : [],
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
