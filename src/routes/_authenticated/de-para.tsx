import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { useCategorias } from "@/hooks/useFinance";
import { chaveEstabelecimento } from "@/lib/categorizacao";
import { lerPlanilhaDePara, modeloCsv, type LinhaDePara } from "@/lib/depara";

export const Route = createFileRoute("/_authenticated/de-para")({
  head: () => ({
    meta: [
      { title: "De-para de categorias — Finanças do Casal" },
      {
        name: "description",
        content:
          "Suba uma planilha Excel ou CSV com o de-para de descrição para categoria e mantenha a categorização automática das despesas sempre calibrada.",
      },
      { property: "og:title", content: "De-para de categorias — Finanças do Casal" },
      {
        property: "og:description",
        content: "Regras de categorização automática alimentadas por planilha Excel ou CSV.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeParaPage,
});

function DeParaPage() {
  const qc = useQueryClient();
  const { user } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: categorias = [] } = useCategorias("despesa");

  const [previa, setPrevia] = useState<LinhaDePara[]>([]);
  const [arquivo, setArquivo] = useState<string>("");
  const [lendo, setLendo] = useState(false);
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState({ descricao: "", categoria: "", subcategoria: "" });

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["categoria-regras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categoria_regras")
        .select("*")
        .order("categoria")
        .order("estabelecimento_normalizado");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nomesCategorias = useMemo(
    () => new Set((categorias as any[]).map((c) => c.nome.toLowerCase())),
    [categorias],
  );

  const categoriasNovas = useMemo(
    () =>
      Array.from(
        new Set(
          previa
            .map((l) => l.categoria)
            .filter((c) => !nomesCategorias.has(c.toLowerCase())),
        ),
      ),
    [previa, nomesCategorias],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return regras as any[];
    return (regras as any[]).filter(
      (r) =>
        String(r.texto_original ?? "").toLowerCase().includes(q) ||
        String(r.estabelecimento_normalizado ?? "").toLowerCase().includes(q) ||
        String(r.categoria ?? "").toLowerCase().includes(q),
    );
  }, [regras, busca]);

  async function onFile(file: File | null | undefined) {
    if (!file) return;
    setLendo(true);
    try {
      const linhas = await lerPlanilhaDePara(file);
      if (!linhas.length) {
        toast.error("Não encontrei colunas de descrição e categoria na planilha.");
        return;
      }
      setPrevia(linhas);
      setArquivo(file.name);
      toast.success(`${linhas.length} linha(s) lida(s).`);
    } catch {
      toast.error("Não consegui ler este arquivo. Use Excel (.xlsx) ou CSV.");
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const salvar = useMutation({
    mutationFn: async (linhas: LinhaDePara[]) => {
      const faltantes = Array.from(
        new Set(linhas.map((l) => l.categoria).filter((c) => !nomesCategorias.has(c.toLowerCase()))),
      );
      if (faltantes.length) {
        const { error } = await supabase
          .from("categorias")
          .insert(faltantes.map((nome) => ({ nome, tipo: "despesa" })));
        if (error) throw error;
      }

      const payload = linhas.map((l) => ({
        texto_original: l.descricao,
        estabelecimento_normalizado: l.estabelecimento_normalizado,
        tipo_regra: "de_para",
        categoria: l.categoria,
        subcategoria: l.subcategoria,
        prioridade: l.prioridade,
        ativo: true,
        origem_arquivo: arquivo || null,
        created_by: user?.id ?? null,
      }));

      for (const item of payload) {
        const { data: existente } = await supabase
          .from("categoria_regras")
          .select("id")
          .eq("estabelecimento_normalizado", item.estabelecimento_normalizado)
          .maybeSingle();
        if (existente) {
          const { error } = await supabase
            .from("categoria_regras")
            .update(item)
            .eq("id", existente.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("categoria_regras").insert(item);
          if (error) throw error;
        }
      }
      return { total: payload.length, novas: faltantes.length };
    },
    onSuccess: ({ total, novas }) => {
      qc.invalidateQueries({ queryKey: ["categoria-regras"] });
      qc.invalidateQueries({ queryKey: ["categorias", "despesa"] });
      setPrevia([]);
      setArquivo("");
      toast.success(`${total} regra(s) salvas. ${novas} categoria(s) criada(s).`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar as regras."),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("categoria_regras").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categoria-regras"] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categoria_regras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categoria-regras"] });
      toast.success("Regra removida.");
    },
  });

  function baixarModelo() {
    const blob = new Blob([modeloCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-de-para.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout
      title="De-para de categorias"
      description="Suba a planilha com descrição → categoria. Toda importação passa a usar essas regras."
      actions={
        <Button variant="outline" onClick={baixarModelo}>
          <Download className="mr-2 size-4" /> Modelo CSV
        </Button>
      }
    >
      <Card>
        <CardContent className="p-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/50"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files?.[0]);
            }}
          >
            {lendo ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-6 text-muted-foreground" />
            )}
            <p className="text-sm font-medium">Arraste a planilha ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground">
              Excel (.xlsx) ou CSV · colunas: descrição, categoria, subcategoria (opcional)
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
        </CardContent>
      </Card>

      {previa.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">
              Prévia de {arquivo} · {previa.length} linha(s)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setPrevia([])}>
                Cancelar
              </Button>
              <Button onClick={() => salvar.mutate(previa)} disabled={salvar.isPending}>
                {salvar.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Salvar regras
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {categoriasNovas.length > 0 && (
              <p className="px-6 pb-3 text-xs text-muted-foreground">
                Serão criadas {categoriasNovas.length} categoria(s) nova(s):{" "}
                <span className="font-medium text-foreground">{categoriasNovas.join(", ")}</span>
              </p>
            )}
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Subcategoria</th>
                    <th className="w-10 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {previa.map((l, i) => (
                    <tr key={l.estabelecimento_normalizado} className="border-t">
                      <td className="p-2">
                        <Input
                          className="h-8"
                          value={l.descricao}
                          onChange={(e) =>
                            setPrevia((p) =>
                              p.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      descricao: e.target.value,
                                      estabelecimento_normalizado: chaveEstabelecimento(
                                        e.target.value,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8"
                          value={l.categoria}
                          onChange={(e) =>
                            setPrevia((p) =>
                              p.map((x, j) => (j === i ? { ...x, categoria: e.target.value } : x)),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8"
                          value={l.subcategoria ?? ""}
                          onChange={(e) =>
                            setPrevia((p) =>
                              p.map((x, j) =>
                                j === i ? { ...x, subcategoria: e.target.value || null } : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPrevia((p) => p.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Regras ativas ({regras.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-9 w-[220px] pl-8"
                placeholder="Buscar regra"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input
                className="h-9"
                value={nova.descricao}
                onChange={(e) => setNova((n) => ({ ...n, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Input
                className="h-9"
                value={nova.categoria}
                onChange={(e) => setNova((n) => ({ ...n, categoria: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subcategoria</Label>
              <Input
                className="h-9"
                value={nova.subcategoria}
                onChange={(e) => setNova((n) => ({ ...n, subcategoria: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="h-9"
                disabled={!nova.descricao.trim() || !nova.categoria.trim() || salvar.isPending}
                onClick={() => {
                  salvar.mutate([
                    {
                      descricao: nova.descricao.trim(),
                      estabelecimento_normalizado: chaveEstabelecimento(nova.descricao),
                      categoria: nova.categoria.trim(),
                      subcategoria: nova.subcategoria.trim() || null,
                      prioridade: 300,
                    },
                  ]);
                  setNova({ descricao: "", categoria: "", subcategoria: "" });
                }}
              >
                <Plus className="mr-2 size-4" /> Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Carregando…</p>
          ) : filtradas.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Nenhuma regra cadastrada ainda.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Subcategoria</th>
                    <th className="p-2 text-left">Origem</th>
                    <th className="p-2 text-left">Ativa</th>
                    <th className="w-10 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">
                        <p className="font-medium">{r.texto_original ?? r.estabelecimento_normalizado}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.estabelecimento_normalizado}
                        </p>
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8"
                          defaultValue={r.categoria}
                          onBlur={(e) =>
                            e.target.value !== r.categoria &&
                            atualizar.mutate({ id: r.id, patch: { categoria: e.target.value } })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8"
                          defaultValue={r.subcategoria ?? ""}
                          onBlur={(e) =>
                            (e.target.value || null) !== r.subcategoria &&
                            atualizar.mutate({
                              id: r.id,
                              patch: { subcategoria: e.target.value || null },
                            })
                          }
                        />
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{r.origem_arquivo ?? r.tipo_regra}</Badge>
                      </td>
                      <td className="p-2">
                        <Switch
                          checked={r.ativo !== false}
                          onCheckedChange={(v) => atualizar.mutate({ id: r.id, patch: { ativo: v } })}
                        />
                      </td>
                      <td className="p-2">
                        <Button variant="ghost" size="icon" onClick={() => remover.mutate(r.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
