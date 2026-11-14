import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowUpRight, Baby, Briefcase, Car, Check, Gamepad2, Gift, GraduationCap, Hammer, HeartPulse, Home,
  type LucideIcon, PartyPopper, PawPrint, Pencil, Plane, Plus, Repeat, RotateCcw, ShoppingBag, Siren, Sparkles,
  Tag as TagIcon, TreePine, Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { ChipTag } from "@/components/SeletorTags";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chaveNomeTag, COR_TAG_PADRAO, CORES_TAGS, type Tag, TAGS_SUGERIDAS, useTags, useVinculosTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tags")({
  head: () => ({ meta: [{ title: "Tags | Control ALL" }] }),
  component: TagsPage,
});

const ICONES_TAGS: Record<string, LucideIcon> = {
  viagem: Plane, reforma: Hammer, presente: Gift, saude: HeartPulse, educacao: GraduationCap, trabalho: Briefcase,
  assinatura: Repeat, emergencia: Siren, casa: Home, carro: Car, pet: PawPrint, filhos: Baby, lazer: Gamepad2,
  festas: PartyPopper, natal: TreePine, "black friday": ShoppingBag, investimento: ArrowUpRight, reembolsavel: RotateCcw,
};
function iconeDaTag(nome: string): LucideIcon {
  return ICONES_TAGS[chaveNomeTag(nome)] ?? TagIcon;
}

function contarUsos(mapa: Map<string, string[]> | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const ids of mapa?.values() ?? []) for (const id of ids) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

function TagsPage() {
  const { tags, tabelaPendente, isLoading, excluir, criarSugeridas, excluirVarias } = useTags();
  const { data: vinculosDespesas } = useVinculosTags("despesa");
  const { data: vinculosReceitas } = useVinculosTags("receita");
  const [editando, setEditando] = useState<Tag | "nova" | null>(null);
  const [zerou, setZerou] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const usosDespesas = contarUsos(vinculosDespesas);
  const usosReceitas = contarUsos(vinculosReceitas);

  const totalUsos = tags.reduce((a, t) => a + (usosDespesas.get(t.id) ?? 0) + (usosReceitas.get(t.id) ?? 0), 0);

  function usarSugeridas() {
    criarSugeridas.mutate(undefined, {
      onSuccess: (n) => toast.success(n > 0 ? `${n} tags sugeridas criadas.` : "Você já tem todas as sugeridas."),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível criar as tags."),
    });
  }
  function alternar(id: string) {
    setMarcadas((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function sairSelecao() {
    setSelecionando(false);
    setMarcadas(new Set());
  }
  function excluirMarcadas() {
    const ids = [...marcadas];
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} ${ids.length === 1 ? "tag" : "tags"}? Elas saem dos lançamentos marcados, que continuam salvos.`)) return;
    excluirVarias.mutate(ids, {
      onSuccess: () => {
        toast.success("Tags excluídas.");
        sairSelecao();
      },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
    });
  }
  function zerarTodas() {
    if (
      !window.confirm(
        `Zerar todas as ${tags.length} tags e começar do zero? Os lançamentos${totalUsos > 0 ? ` (${totalUsos} marcações)` : ""} perdem a etiqueta, mas não são apagados. Depois você pode restaurar as sugeridas.`,
      )
    )
      return;
    excluirVarias.mutate(
      tags.map((t) => t.id),
      {
        onSuccess: () => {
          setZerou(true);
          toast.success("Tags zeradas. Você pode restaurar as sugeridas quando quiser.");
          sairSelecao();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível zerar."),
      },
    );
  }

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
            <div className="flex flex-wrap justify-center gap-2">
              <Button className="rounded-full" onClick={usarSugeridas} disabled={criarSugeridas.isPending}>
                <Sparkles className="size-4" /> {zerou ? "Restaurar sugeridas" : "Usar tags sugeridas"}
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => setEditando("nova")}>
                <Plus className="size-4" /> Começar do zero
              </Button>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground">
              Sugeridas: {TAGS_SUGERIDAS.map((t) => t.nome).join(", ")}. Você edita ou exclui depois.
            </p>
          </CardContent>
        </Card>
      )}

      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {selecionando ? (
            <>
              <Button size="sm" variant="destructive" className="rounded-full" disabled={marcadas.size === 0 || excluirVarias.isPending} onClick={excluirMarcadas}>
                <Trash2 className="size-4" /> Excluir selecionadas ({marcadas.size})
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setMarcadas(new Set(tags.map((t) => t.id)))}>
                Marcar todas
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={sairSelecao}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setSelecionando(true)}>
                <Check className="size-4" /> Selecionar
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={usarSugeridas} disabled={criarSugeridas.isPending}>
                <Sparkles className="size-4" /> Restaurar sugeridas
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full text-destructive hover:text-destructive" onClick={zerarTodas} disabled={excluirVarias.isPending}>
                <RotateCcw className="size-4" /> Zerar todas e começar do zero
              </Button>
            </>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <Card className="rounded-3xl">
          <CardContent className="divide-y divide-border p-2">
            {tags.map((t) => {
              const nd = usosDespesas.get(t.id) ?? 0;
              const nr = usosReceitas.get(t.id) ?? 0;
              const Icone = iconeDaTag(t.nome);
              return (
                <div key={t.id} className="flex items-center gap-3 px-3 py-3">
                  {selecionando && (
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={marcadas.has(t.id)}
                      onChange={() => alternar(t.id)}
                      aria-label={`Selecionar tag ${t.nome}`}
                    />
                  )}
                  <Icone className="size-4 shrink-0" style={{ color: t.cor }} aria-hidden="true" />
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
