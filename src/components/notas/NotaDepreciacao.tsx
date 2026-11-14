import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate } from "@/lib/format";
import { classificarItemNota } from "@/lib/nota-itens-classificacao";
import { PresetsVidaUtil } from "@/components/notas/DepreciacaoItem";

export const ROTULO_CATEGORIA_NOTA: Record<string, string> = {
  eletronicos: "Eletrônicos",
  eletrodomesticos: "Eletrodomésticos",
  moveis: "Móveis",
  vestuario: "Vestuário",
  servicos: "Serviços",
  alimentacao: "Alimentação",
  outros: "Outros",
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Combobox com busca (sem acento/maiúsculas); as mais usadas aparecem primeiro. */
export function CategoriaCombobox({
  valor,
  opcoes,
  usos,
  onChange,
}: {
  valor: string;
  opcoes: string[];
  usos: Record<string, number>;
  onChange: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ordenadas = useMemo(
    () =>
      [...opcoes].sort(
        (a, b) =>
          (usos[b] ?? 0) - (usos[a] ?? 0) ||
          (ROTULO_CATEGORIA_NOTA[a] ?? a).localeCompare(ROTULO_CATEGORIA_NOTA[b] ?? b),
      ),
    [opcoes, usos],
  );
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={aberto} className="w-full justify-between font-normal">
          <span className="truncate">{ROTULO_CATEGORIA_NOTA[valor] ?? valor}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(v, busca) => (semAcento(v).includes(semAcento(busca)) ? 1 : 0)}>
          <CommandInput placeholder="Buscar categoria" />
          <CommandList>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            <CommandGroup>
              {ordenadas.map((c) => (
                <CommandItem
                  key={c}
                  value={ROTULO_CATEGORIA_NOTA[c] ?? c}
                  onSelect={() => {
                    onChange(c);
                    setAberto(false);
                  }}
                >
                  <Check className={`mr-2 size-4 ${c === valor ? "opacity-100" : "opacity-0"}`} />
                  {ROTULO_CATEGORIA_NOTA[c] ?? c}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function vidaUtilSugerida(descricao: string, categoria: string | null | undefined): number {
  const s = classificarItemNota(descricao).sugestaoDepreciacao?.meses;
  if (s) return s;
  if (categoria === "moveis") return 120;
  if (categoria === "eletrodomesticos") return 60;
  return 36;
}

type ItemMin = { id: string; descricao: string; valor_total: number | string | null; deprecia?: boolean | null; meses_depreciacao?: number | null };
type NotaMin = {
  id: string;
  estabelecimento: string | null;
  descricao: string | null;
  data_compra: string;
  valor_total: number | string;
  categoria: string | null;
  nota_itens?: ItemMin[] | null;
};

export const itemEmDepreciacao = (i: ItemMin) => !!i.deprecia && !!i.meses_depreciacao;
export const notaEmDepreciacao = (n: NotaMin) => (n.nota_itens ?? []).some(itemEmDepreciacao);
export const notaTodaEmDepreciacao = (n: NotaMin) => (n.nota_itens ?? []).length > 0 && (n.nota_itens ?? []).every(itemEmDepreciacao);

/** Opção "Acompanhar depreciação" do formulário de nova nota. */
export function AcompanharDepreciacaoCampo({
  meses,
  sugerido,
  onChange,
}: {
  meses: number | null;
  sugerido: number;
  onChange: (m: number | null) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Acompanhar depreciação</p>
          <p className="text-xs text-muted-foreground">Usa descrição, valor e data desta nota, sem digitar de novo.</p>
        </div>
        <Switch checked={meses !== null} onCheckedChange={(v) => onChange(v ? sugerido : null)} />
      </div>
      {meses !== null && <PresetsVidaUtil valor={meses} sugerido={sugerido} onEscolher={(m) => onChange(m)} />}
    </div>
  );
}

/** Insere o bem em nota_itens (ou marca os itens existentes). Mesma tabela da aba Depreciação. */
export async function depreciarNotaNoBanco(nota: { id: string; descricao: string; valor: number }, meses: number) {
  const { data, error } = await supabase.from("nota_itens").select("id, deprecia, meses_depreciacao").eq("nota_id", nota.id);
  if (error) throw error;
  if (!data?.length) {
    const { error: e } = await (supabase.from("nota_itens") as any).insert({
      nota_id: nota.id,
      descricao: nota.descricao,
      quantidade: 1,
      valor_unitario: nota.valor,
      valor_total: nota.valor,
      categoria: "Compras / Varejo",
      subcategoria: "Compras diversas",
      deprecia: true,
      meses_depreciacao: meses,
    });
    if (e) throw e;
    return;
  }
  for (const i of data.filter((x: any) => !(x.deprecia && x.meses_depreciacao))) {
    const { error: e } = await supabase.from("nota_itens").update({ deprecia: true, meses_depreciacao: meses } as any).eq("id", i.id);
    if (e) throw e;
  }
}

/** Passo curto já preenchido; pede só a vida útil. */
export function EnviarParaDepreciacaoDialog({ nota, onClose }: { nota: NotaMin | null; onClose: () => void }) {
  const qc = useQueryClient();
  const candidatos = useMemo(() => {
    if (!nota) return [];
    const itens = nota.nota_itens ?? [];
    if (!itens.length) return [{ id: "", descricao: nota.descricao || nota.estabelecimento || "Nota fiscal", valor: Number(nota.valor_total) }];
    return itens.filter((i) => !itemEmDepreciacao(i)).map((i) => ({ id: i.id, descricao: i.descricao, valor: Number(i.valor_total ?? 0) }));
  }, [nota]);
  const [sel, setSel] = useState(0);
  const [meses, setMeses] = useState<number | null>(null);
  const atual = candidatos[sel];
  const sugerido = atual && nota ? vidaUtilSugerida(atual.descricao, nota.categoria) : 36;
  const m = meses ?? sugerido;

  const enviar = useMutation({
    mutationFn: async () => {
      if (!nota || !atual) return;
      if (atual.id) {
        const { error } = await supabase.from("nota_itens").update({ deprecia: true, meses_depreciacao: m } as any).eq("id", atual.id);
        if (error) throw error;
      } else {
        await depreciarNotaNoBanco({ id: nota.id, descricao: atual.descricao, valor: atual.valor }, m);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notas-fiscais"] });
      toast.success("Enviado para depreciação");
      setSel(0);
      setMeses(null);
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível enviar"),
  });

  return (
    <Dialog open={!!nota} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar para depreciação</DialogTitle>
          <DialogDescription>Já preenchido com os dados da nota. Falta só a vida útil.</DialogDescription>
        </DialogHeader>
        {nota && (
          <div className="space-y-3">
            {candidatos.length === 0 && <p className="text-sm text-muted-foreground">Todos os itens desta nota já estão em depreciação.</p>}
            {candidatos.map((c, idx) => (
              <button
                key={c.id || "nota"}
                type="button"
                onClick={() => { setSel(idx); setMeses(null); }}
                className={`w-full rounded-md border p-3 text-left ${idx === sel ? "border-primary bg-primary/5" : ""}`}
              >
                <p className="text-sm font-medium">{c.descricao}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(c.valor)} · {formatDate(nota.data_compra)}</p>
              </button>
            ))}
            {atual && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Vida útil (sugerida pelo tipo)</p>
                <PresetsVidaUtil valor={m} sugerido={sugerido} onEscolher={setMeses} />
              </div>
            )}
            <Button className="w-full" disabled={!atual || enviar.isPending} onClick={() => enviar.mutate()}>
              <TrendingDown className="mr-1 size-4" /> Enviar para depreciação
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
