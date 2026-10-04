import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Boxes, Calendar, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onde-esta")({ component: OndeEsta });

type Local = {
  id: string;
  grupo_id: string;
  nome: string;
  detalhe: string | null;
  local_pai_id: string | null;
};

type Item = {
  id: string;
  grupo_id: string;
  local_id: string;
  nome: string;
  quantidade: number;
  observacao: string | null;
  data_compra: string | null;
  data_validade: string | null;
};

const localVazio = { nome: "", detalhe: "", local_pai_id: null as string | null };
const itemVazio = {
  nome: "",
  local_id: "",
  quantidade: "1",
  observacao: "",
  data_compra: "",
  data_validade: "",
};

/**
 * Caminho completo de um local, subindo pela cadeia de `local_pai_id` — ex.:
 * "Escritório › Guarda-roupa (caixa de sapato cinza, lado esquerdo)".
 */
function caminhoDoLocal(localId: string | null, locais: Local[]): string {
  const partes: string[] = [];
  let atual = locais.find((l) => l.id === localId);
  let guarda = 0;
  while (atual && guarda < 10) {
    partes.unshift(atual.detalhe ? `${atual.nome} (${atual.detalhe})` : atual.nome);
    atual = atual.local_pai_id ? locais.find((l) => l.id === atual!.local_pai_id) : undefined;
    guarda++;
  }
  return partes.join(" › ") || "—";
}

function formatarData(iso: string | null): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function OndeEsta() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [dialogLocal, setDialogLocal] = useState<null | "novo" | Local>(null);
  const [formLocal, setFormLocal] = useState(localVazio);
  const [dialogItem, setDialogItem] = useState<null | "novo" | Item>(null);
  const [formItem, setFormItem] = useState(itemVazio);

  const { data: locais = [] } = useQuery({
    queryKey: ["locais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("locais_armazenamento")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Local[];
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["itens-armazenados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("itens_armazenados").select("*");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  async function grupoAtual(): Promise<string> {
    const { data: me } = await supabase.auth.getUser();
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("grupo_id")
      .eq("id", me.user?.id ?? "")
      .single();
    if (!profile?.grupo_id) throw new Error("Não foi possível identificar seu grupo.");
    return profile.grupo_id as string;
  }

  const salvarLocal = useMutation({
    mutationFn: async () => {
      if (!formLocal.nome.trim()) throw new Error("Informe o nome do local.");
      const grupoId = await grupoAtual();
      const payload = {
        nome: formLocal.nome.trim(),
        detalhe: formLocal.detalhe.trim() || null,
        local_pai_id: formLocal.local_pai_id || null,
      };
      if (dialogLocal && dialogLocal !== "novo") {
        const { error } = await (supabase as any)
          .from("locais_armazenamento")
          .update(payload)
          .eq("id", dialogLocal.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("locais_armazenamento")
          .insert({ ...payload, grupo_id: grupoId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Local salvo.");
      setDialogLocal(null);
      setFormLocal(localVazio);
      qc.invalidateQueries({ queryKey: ["locais"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluirLocal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("locais_armazenamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local removido.");
      qc.invalidateQueries({ queryKey: ["locais"] });
      qc.invalidateQueries({ queryKey: ["itens-armazenados"] });
    },
    onError: () =>
      toast.error("Não foi possível remover. Verifique se não há locais ou itens dentro dele."),
  });

  const salvarItem = useMutation({
    mutationFn: async () => {
      if (!formItem.nome.trim()) throw new Error("Informe o nome do item.");
      if (!formItem.local_id) throw new Error("Escolha em qual local o item está guardado.");
      const grupoId = await grupoAtual();
      const payload = {
        nome: formItem.nome.trim(),
        local_id: formItem.local_id,
        quantidade: Number(formItem.quantidade) || 1,
        observacao: formItem.observacao.trim() || null,
        data_compra: formItem.data_compra || null,
        data_validade: formItem.data_validade || null,
      };
      if (dialogItem && dialogItem !== "novo") {
        const { error } = await (supabase as any)
          .from("itens_armazenados")
          .update(payload)
          .eq("id", dialogItem.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("itens_armazenados")
          .insert({ ...payload, grupo_id: grupoId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Item salvo.");
      setDialogItem(null);
      setFormItem(itemVazio);
      qc.invalidateQueries({ queryKey: ["itens-armazenados"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluirItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("itens_armazenados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido.");
      qc.invalidateQueries({ queryKey: ["itens-armazenados"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const termo = q.trim().toLowerCase();
  const resultado = useMemo(() => {
    if (!termo) return itens;
    return itens.filter((i) => {
      const caminho = caminhoDoLocal(i.local_id, locais).toLowerCase();
      return (
        i.nome.toLowerCase().includes(termo) ||
        (i.observacao ?? "").toLowerCase().includes(termo) ||
        caminho.includes(termo)
      );
    });
  }, [itens, locais, termo]);

  function abrirNovoLocal(paiId?: string) {
    setFormLocal({ ...localVazio, local_pai_id: paiId ?? null });
    setDialogLocal("novo");
  }

  function abrirEdicaoLocal(l: Local) {
    setFormLocal({ nome: l.nome, detalhe: l.detalhe ?? "", local_pai_id: l.local_pai_id });
    setDialogLocal(l);
  }

  function abrirNovoItem(localId?: string) {
    setFormItem({ ...itemVazio, local_id: localId ?? "" });
    setDialogItem("novo");
  }

  function abrirEdicaoItem(i: Item) {
    setFormItem({
      nome: i.nome,
      local_id: i.local_id,
      quantidade: String(i.quantidade ?? 1),
      observacao: i.observacao ?? "",
      data_compra: i.data_compra ?? "",
      data_validade: i.data_validade ?? "",
    });
    setDialogItem(i);
  }

  return (
    <AppLayout
      title="Onde está?"
      description="Guarde local, cômodo, detalhes e validade de cada coisa — preencha só o que souber."
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder='Digite pra encontrar (ex.: "pilha" ou "AAA")'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => abrirNovoLocal()} variant="outline" className="gap-1.5 shrink-0">
          <MapPin className="size-4" /> Novo local
        </Button>
        <Button onClick={() => abrirNovoItem()} className="gap-1.5 shrink-0" disabled={!locais.length}>
          <Plus className="size-4" /> Novo item
        </Button>
      </div>

      {termo ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {resultado.length} {resultado.length === 1 ? "resultado" : "resultados"} para "{q}"
          </p>
          {resultado.map((i) => (
            <ItemCard
              key={i.id}
              item={i}
              caminho={caminhoDoLocal(i.local_id, locais)}
              onEditar={() => abrirEdicaoItem(i)}
              onExcluir={() => excluirItem.mutate(i.id)}
            />
          ))}
          {!resultado.length && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nada encontrado com esse termo.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="flex items-center gap-1.5 font-semibold">
                <MapPin className="size-4 text-primary" /> Locais
              </h2>
              {!locais.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhum local cadastrado ainda. Comece com algo simples, como "Escritório" ou
                  "Quarto" — você pode detalhar depois.
                </p>
              )}
              <div className="space-y-2">
                {locais
                  .filter((l) => !l.local_pai_id)
                  .map((l) => (
                    <LocalNode
                      key={l.id}
                      local={l}
                      locais={locais}
                      itens={itens}
                      onNovoSublocal={abrirNovoLocal}
                      onEditar={abrirEdicaoLocal}
                      onExcluir={(id) => excluirLocal.mutate(id)}
                      onNovoItem={abrirNovoItem}
                      onEditarItem={abrirEdicaoItem}
                      onExcluirItem={(id) => excluirItem.mutate(id)}
                    />
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="flex items-center gap-1.5 font-semibold">
                <Boxes className="size-4 text-primary" /> Todos os itens
              </h2>
              {!itens.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhum item guardado ainda. Cadastre um local e depois adicione itens a ele.
                </p>
              )}
              <div className="space-y-2">
                {itens.map((i) => (
                  <ItemCard
                    key={i.id}
                    item={i}
                    caminho={caminhoDoLocal(i.local_id, locais)}
                    onEditar={() => abrirEdicaoItem(i)}
                    onExcluir={() => excluirItem.mutate(i.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: novo/editar local */}
      <Dialog open={!!dialogLocal} onOpenChange={(v) => !v && setDialogLocal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogLocal === "novo" ? "Novo local" : "Editar local"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="local-nome">Nome</Label>
              <Input
                id="local-nome"
                placeholder="Ex.: Escritório, Guarda-roupa, Caixa de sapato"
                value={formLocal.nome}
                onChange={(e) => setFormLocal({ ...formLocal, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="local-detalhe">Detalhes (opcional)</Label>
              <Textarea
                id="local-detalhe"
                placeholder="Ex.: cor cinza, lado esquerdo, prateleira de cima"
                value={formLocal.detalhe}
                onChange={(e) => setFormLocal({ ...formLocal, detalhe: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fica dentro de (opcional)</Label>
              <Select
                value={formLocal.local_pai_id ?? "none"}
                onValueChange={(v) => setFormLocal({ ...formLocal, local_pai_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum — é um local principal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum — é um local principal</SelectItem>
                  {locais
                    .filter((l) => !(dialogLocal !== "novo" && dialogLocal && l.id === dialogLocal.id))
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {caminhoDoLocal(l.id, locais)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use isso pra criar hierarquia: ex. "Guarda-roupa" dentro de "Quarto", ou "Caixa de
                sapato" dentro de "Guarda-roupa".
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogLocal(null)}>Cancelar</Button>
            <Button onClick={() => salvarLocal.mutate()} disabled={salvarLocal.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: novo/editar item */}
      <Dialog open={!!dialogItem} onOpenChange={(v) => !v && setDialogItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogItem === "novo" ? "Novo item" : "Editar item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-nome">Nome</Label>
              <Input
                id="item-nome"
                placeholder="Ex.: Pacote de pilha AAA"
                value={formItem.nome}
                onChange={(e) => setFormItem({ ...formItem, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Onde está</Label>
              <Select
                value={formItem.local_id}
                onValueChange={(v) => setFormItem({ ...formItem, local_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o local" />
                </SelectTrigger>
                <SelectContent>
                  {locais.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {caminhoDoLocal(l.id, locais)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-qtd">Quantidade</Label>
                <Input
                  id="item-qtd"
                  type="number"
                  min={0}
                  value={formItem.quantidade}
                  onChange={(e) => setFormItem({ ...formItem, quantidade: e.target.value })}
                />
              </div>
              <div />
              <div className="space-y-1.5">
                <Label htmlFor="item-compra">Comprado em (opcional)</Label>
                <Input
                  id="item-compra"
                  type="date"
                  value={formItem.data_compra}
                  onChange={(e) => setFormItem({ ...formItem, data_compra: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-validade">Validade (opcional)</Label>
                <Input
                  id="item-validade"
                  type="date"
                  value={formItem.data_validade}
                  onChange={(e) => setFormItem({ ...formItem, data_validade: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-obs">Observações (opcional)</Label>
              <Textarea
                id="item-obs"
                placeholder="Qualquer outro detalhe que ajude a encontrar"
                value={formItem.observacao}
                onChange={(e) => setFormItem({ ...formItem, observacao: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogItem(null)}>Cancelar</Button>
            <Button onClick={() => salvarItem.mutate()} disabled={salvarItem.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function LocalNode({
  local,
  locais,
  itens,
  onNovoSublocal,
  onEditar,
  onExcluir,
  onNovoItem,
  onEditarItem,
  onExcluirItem,
  nivel = 0,
}: {
  local: Local;
  locais: Local[];
  itens: Item[];
  onNovoSublocal: (paiId: string) => void;
  onEditar: (l: Local) => void;
  onExcluir: (id: string) => void;
  onNovoItem: (localId: string) => void;
  onEditarItem: (i: Item) => void;
  onExcluirItem: (id: string) => void;
  nivel?: number;
}) {
  const filhos = locais.filter((l) => l.local_pai_id === local.id);
  const itensDoLocal = itens.filter((i) => i.local_id === local.id);

  return (
    <div className={nivel > 0 ? "ml-4 border-l pl-3" : ""}>
      <div className="rounded-lg border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{local.nome}</p>
            {local.detalhe && <p className="text-xs text-muted-foreground">{local.detalhe}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="icon" variant="ghost" className="size-7" onClick={() => onEditar(local)} aria-label="Editar local">
              <Pencil className="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => onExcluir(local.id)} aria-label="Excluir local">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onNovoSublocal(local.id)}>
            <Plus className="size-3" /> Sublocal
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onNovoItem(local.id)}>
            <Plus className="size-3" /> Item aqui
          </Button>
        </div>
        {itensDoLocal.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {itensDoLocal.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-sm">
                <span>
                  {i.nome} {i.quantidade > 1 && <span className="text-muted-foreground">×{i.quantidade}</span>}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => onEditarItem(i)} aria-label="Editar item">
                    <Pencil className="size-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={() => onExcluirItem(i.id)} aria-label="Excluir item">
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {filhos.length > 0 && (
        <div className="mt-2 space-y-2">
          {filhos.map((f) => (
            <LocalNode
              key={f.id}
              local={f}
              locais={locais}
              itens={itens}
              onNovoSublocal={onNovoSublocal}
              onEditar={onEditar}
              onExcluir={onExcluir}
              onNovoItem={onNovoItem}
              onEditarItem={onEditarItem}
              onExcluirItem={onExcluirItem}
              nivel={nivel + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  caminho,
  onEditar,
  onExcluir,
}: {
  item: Item;
  caminho: string;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const validade = formatarData(item.data_validade);
  const compra = formatarData(item.data_compra);
  const vencido = item.data_validade ? new Date(item.data_validade) < new Date() : false;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {item.nome} {item.quantidade > 1 && <span className="text-muted-foreground">×{item.quantidade}</span>}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {caminho}
          </p>
          {item.observacao && <p className="mt-1 text-xs text-muted-foreground">{item.observacao}</p>}
          {(compra || validade) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {compra && (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Calendar className="size-3" /> Comprado {compra}
                </Badge>
              )}
              {validade && (
                <Badge variant={vencido ? "destructive" : "outline"} className="gap-1 text-[11px]">
                  <Calendar className="size-3" /> Validade {validade}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={onEditar} aria-label="Editar item">
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={onExcluir} aria-label="Excluir item">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
