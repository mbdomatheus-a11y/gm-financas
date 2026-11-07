import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { ChipTag } from "@/components/SeletorTags";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COR_TAG_PADRAO, CORES_TAGS, type Tag, useTags, useVinculosTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tags")({
  head: () => ({ meta: [{ title: "Tags | Control ALL" }] }),
  component: TagsPage,
});

function contarUsos(mapa: Map<string, string[]> | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const ids of mapa?.values() ?? []) for (const id of ids) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

function TagsPage() {
  const { tags, tabelaPendente, isLoading, excluir } = useTags();
  const { data: vinculosDespesas } = useVinculosTags("despesa");
  const { data: vinculosReceitas } = useVinculosTags("receita");
  const [editando, setEditando] = useState<Tag | "nova" | null>(null);
  const usosDespesas = contarUsos(vinculosDespesas);
  const usosReceitas = contarUsos(vinculosReceitas);

  return (
    <AppLayout
      title="Tags"
      description="Marque lançamentos com etiquetas livres, como Viagem ou Reforma"
      actions={
        <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setEditando("nova")} disabled={tabelaPendente}>
          <Plus className="size-4" /> Nova tag
        </Button>
      }
    >
      {tabelaPendente && (
        <Card className="mb-6 rounded-3xl border-warning/40 bg-warning/10">
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground dark:text-warning" aria-hidden="true" />
            <p>
              As tags ainda não foram ativadas no banco de dados. Assim que a atualização for aplicada, esta tela passa a
              funcionar sem nenhuma ação sua.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && !tabelaPendente && tags.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <TagIcon className="size-7" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Organize do seu jeito</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Tags cruzam categorias: junte tudo de uma viagem, de uma obra ou de um projeto e veja quanto custou.
              </p>
            </div>
            <Button className="rounded-full" onClick={() => setEditando("nova")}>
              <Plus className="size-4" /> Criar primeira tag
            </Button>
          </CardContent>
        </Card>
      )}

      {tags.length > 0 && (
        <Card className="rounded-3xl">
          <CardContent className="divide-y divide-border p-2">
            {tags.map((t) => {
              const nd = usosDespesas.get(t.id) ?? 0;
              const nr = usosReceitas.get(t.id) ?? 0;
              return (
                <div key={t.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: t.cor }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <ChipTag tag={t} />
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {nd + nr === 0
                        ? "Ainda sem lançamentos"
                        : [nd > 0 && `${nd} ${nd === 1 ? "despesa" : "despesas"}`, nr > 0 && `${nr} ${nr === 1 ? "receita" : "receitas"}`]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Editar tag ${t.nome}`} onClick={() => setEditando(t)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir tag ${t.nome}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const aviso = nd + nr > 0 ? " Ela sai dos lançamentos marcados, que continuam salvos." : "";
                      if (!window.confirm(`Excluir a tag "${t.nome}"?${aviso}`)) return;
                      excluir.mutate(t.id, {
                        onSuccess: () => toast.success("Tag excluída."),
                        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {editando && <FormTag tag={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} />}
    </AppLayout>
  );
}

function FormTag({ tag, onFechar }: { tag: Tag | null; onFechar: () => void }) {
  const { criar, editar } = useTags();
  const [nome, setNome] = useState(tag?.nome ?? "");
  const [cor, setCor] = useState(tag?.cor ?? COR_TAG_PADRAO);
  const salvando = criar.isPending || editar.isPending;

  function enviar() {
    const opcoes = {
      onSuccess: () => {
        toast.success("Tag salva.");
        onFechar();
      },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
    };
    if (tag) editar.mutate({ id: tag.id, nome, cor }, opcoes);
    else criar.mutate({ nome, cor }, opcoes);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{tag ? "Editar tag" : "Nova tag"}</DialogTitle>
          <DialogDescription>Use nomes curtos, como Viagem, Reforma ou Trabalho.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-nome">Nome</Label>
            <Input
              id="tag-nome"
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              placeholder="Ex.: Viagem Nordeste"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Cor da tag">
              {CORES_TAGS.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  role="radio"
                  aria-checked={cor === c.valor}
                  aria-label={c.nome}
                  title={c.nome}
                  onClick={() => setCor(c.valor)}
                  className={cn(
                    "grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-background transition",
                    cor === c.valor && "ring-2 ring-foreground/40",
                  )}
                  style={{ backgroundColor: c.valor }}
                >
                  {cor === c.valor && <Check className="size-4 text-white" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
          {nome.trim() && (
            <div className="rounded-2xl bg-muted/60 p-3">
              <ChipTag tag={{ nome: nome.trim(), cor }} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-full" onClick={onFechar}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={enviar} disabled={salvando}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
