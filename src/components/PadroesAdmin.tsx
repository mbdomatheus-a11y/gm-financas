import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, Trash2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCategoriasPadrao } from "@/hooks/useCategoriasPadrao";

type DeParaPadrao = { id: string; texto: string; categoria: string; subcategoria: string | null };
const db = supabase as any;

/** Admin: categorias e de-para padrão (sugeridos a todos os usuários). */
export function PadroesAdmin() {
  const qc = useQueryClient();
  const { lista } = useCategoriasPadrao();
  const [nome, setNome] = useState("");
  const [subs, setSubs] = useState("");
  const [texto, setTexto] = useState("");
  const [catDe, setCatDe] = useState("");
  const [subDe, setSubDe] = useState("");

  const { data: depara = [] } = useQuery({
    queryKey: ["depara-padrao"],
    queryFn: async () => {
      const { data, error } = await db
        .from("depara_padrao")
        .select("id,texto,categoria,subcategoria")
        .eq("ativo", true)
        .order("texto");
      if (error) throw error;
      return (data ?? []) as DeParaPadrao[];
    },
  });

  const refazer = () => {
    void qc.invalidateQueries({ queryKey: ["categorias-padrao"] });
    void qc.invalidateQueries({ queryKey: ["depara-padrao"] });
  };
  const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");

  const addCategoria = useMutation({
    mutationFn: async () => {
      const lim = nome.trim();
      if (!lim) throw new Error("Informe o nome da categoria.");
      const subcategorias = subs.split(",").map((s) => s.trim()).filter(Boolean);
      const ordem = Math.max(-1, ...lista.map((c) => c.ordem)) + 1;
      const { error } = await db
        .from("categorias_padrao")
        .upsert({ nome: lim, subcategorias, ordem, ativo: true }, { onConflict: "nome" });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      setSubs("");
      refazer();
      toast.success("Categoria padrão salva.");
    },
    onError: erro,
  });

  const delCategoria = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("categorias_padrao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refazer();
      toast.success("Categoria padrão removida (as que os usuários já criaram não mudam).");
    },
    onError: erro,
  });

  const addDePara = useMutation({
    mutationFn: async () => {
      if (!texto.trim() || !catDe.trim()) throw new Error("Informe o estabelecimento e a categoria.");
      const { error } = await db.from("depara_padrao").insert({
        texto: texto.trim(),
        categoria: catDe.trim(),
        subcategoria: subDe.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      setSubDe("");
      refazer();
      toast.success("De-para padrão salvo.");
    },
    onError: erro,
  });

  const delDePara = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("depara_padrao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refazer();
      toast.success("De-para padrão removido.");
    },
    onError: erro,
  });

  const idsReais = lista.every((c) => c.id !== c.nome);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="size-4.5" /> Categorias padrão
          </CardTitle>
          <CardDescription>
            Lista sugerida a todos os usuários (tela Categorias, importações e primeiro lançamento).
            Remover aqui não apaga as categorias que os usuários já criaram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <Input placeholder="Categoria (ex.: Mercado)" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input
              placeholder="Subcategorias separadas por vírgula (opcional)"
              value={subs}
              onChange={(e) => setSubs(e.target.value)}
            />
            <Button onClick={() => addCategoria.mutate()} disabled={addCategoria.isPending}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {lista.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.nome}</p>
                  {c.subcategorias.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">{c.subcategorias.join(" · ")}</p>
                  )}
                </div>
                {idsReais && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${c.nome}`}
                    onClick={() => delCategoria.mutate(c.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shuffle className="size-4.5" /> De-para padrão
          </CardTitle>
          <CardDescription>
            Estabelecimentos que já entram categorizados para todos nas importações (ex.: "UBER" vira
            Transporte). As regras do próprio usuário sempre têm prioridade sobre estas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
            <Input placeholder="Estabelecimento" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Input
              placeholder="Categoria"
              list="categorias-padrao-lista"
              value={catDe}
              onChange={(e) => setCatDe(e.target.value)}
            />
            <Input placeholder="Subcategoria (opcional)" value={subDe} onChange={(e) => setSubDe(e.target.value)} />
            <Button onClick={() => addDePara.mutate()} disabled={addDePara.isPending}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
          <datalist id="categorias-padrao-lista">
            {lista.map((c) => (
              <option key={c.id} value={c.nome} />
            ))}
          </datalist>
          {depara.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhum de-para padrão cadastrado.
            </p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {depara.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <strong>{d.texto}</strong> → {d.categoria}
                    {d.subcategoria ? ` / ${d.subcategoria}` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${d.texto}`}
                    onClick={() => delDePara.mutate(d.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
