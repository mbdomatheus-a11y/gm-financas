import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useFinance";
import { useCategoriasPadrao } from "@/hooks/useCategoriasPadrao";
import { RECEITAS_SUGERIDAS } from "@/lib/categorias-planilha";

const CORES = ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"];

/**
 * Ajuda guiada do primeiro lançamento: se o usuário ainda não tem nenhuma
 * categoria própria do tipo informado, mostra um aviso na própria tela onde ele
 * está (IA, despesas, receitas ou importação) e abre uma janelinha para criar
 * categorias na hora, a partir das sugeridas pelo site ou digitando uma nova.
 */
export function PrimeiraCategoriaGuia({
  tipo,
  className,
}: {
  tipo: "despesa" | "receita";
  className?: string;
}) {
  const qc = useQueryClient();
  const { data: categorias, isLoading } = useCategorias(tipo);
  const { lista } = useCategoriasPadrao();
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState("");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);

  const criar = useMutation({
    mutationFn: async () => {
      const nomes = [...escolhidas, ...(nova.trim() ? [nova.trim()] : [])];
      if (nomes.length === 0) throw new Error("Escolha ao menos uma categoria.");
      // Evita o erro de nome repetido: só cria o que ainda não existe no seu grupo.
      const { data: existentes } = await supabase.from("categorias").select("nome").eq("tipo", tipo);
      const ja = new Set((existentes ?? []).map((c: any) => String(c.nome).trim().toLowerCase()));
      const novos = [...new Set(nomes.map((n) => n.trim()))].filter((n) => !ja.has(n.toLowerCase()));
      if (novos.length > 0) {
        const linhas = novos.map((nome, i) => ({ nome, tipo, cor: CORES[i % CORES.length]! }));
        const { error } = await supabase.from("categorias").insert(linhas);
        if (error) throw error;
      }
      return novos.length;
    },
    onSuccess: (n) => {
      toast.success(
        n === 0
          ? "Essas categorias já existiam. Pode continuar."
          : n === 1
            ? "Categoria criada."
            : `${n} categorias criadas.`,
      );
      void qc.invalidateQueries({ queryKey: ["categorias"] });
      setAberto(false);
      setNova("");
      setEscolhidas([]);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível criar."),
  });

  if (isLoading || (categorias?.length ?? 0) > 0) return null;

  const sugestoes =
    tipo === "despesa"
      ? lista.map((c) => c.nome).filter((n) => n !== "Categoria a confirmar")
      : RECEITAS_SUGERIDAS;

  return (
    <>
      <div
        className={
          "flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm " +
          (className ?? "")
        }
      >
        <Sparkles className="size-4.5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1">
          <strong>Primeiro lançamento?</strong> Você ainda não tem categorias de {tipo === "despesa" ? "despesa" : "receita"}.
          Vamos criar a primeira agora, sem sair desta tela.
        </p>
        <Button size="sm" onClick={() => setAberto(true)}>
          <Tags className="size-4" /> Criar categoria
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crie suas primeiras categorias</DialogTitle>
            <DialogDescription>
              Toque nas sugestões que combinam com você ou escreva uma nova. Dá para mudar tudo depois
              na tela Categorias.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
            {sugestoes.map((n) => {
              const on = escolhidas.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setEscolhidas((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]))
                  }
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                    (on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")
                  }
                >
                  {on && <Check className="size-3.5" />} {n}
                </button>
              );
            })}
          </div>
          <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
            Você pode adicionar, editar e remover categorias quando quiser, na tela Categorias.
          </p>
          <Input
            placeholder="Ou digite uma categoria nova"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            maxLength={60}
          />
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
            {criar.isPending ? "Criando..." : "Criar e continuar"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
