import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Regra = {
  id: string;
  nome: string;
  receita_descricao: string;
  valor_minimo: number;
  valor_maximo: number;
  dias_tolerancia: number;
  ativo: boolean;
};

const formInicial = { nome: "", receita: "", min: "", max: "", dias: "3" };

/**
 * Regras de PIX para receitas fixas (só administração). Um PIX dentro da faixa de valor e
 * dentro do intervalo de dias em torno do dia previsto confirma a receita daquela competência.
 */
export function RegrasPixReceita() {
  const qc = useQueryClient();
  const [form, setForm] = useState(formInicial);

  const { data: regras = [] } = useQuery({
    queryKey: ["regras-pix"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("regras_pix_receita").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Regra[];
    },
  });

  const { data: fixas = [] } = useQuery({
    queryKey: ["receitas-fixas-para-pix"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receitas").select("descricao").eq("recorrente", true);
      if (error) throw error;
      return [...new Set((data ?? []).map((r: any) => String(r.descricao)))].sort();
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const min = Number(form.min.replace(",", "."));
      const max = Number(form.max.replace(",", "."));
      const dias = Number(form.dias);
      if (!form.receita) throw new Error("Escolha a receita fixa.");
      if (!(min > 0) || !(max >= min)) throw new Error("Informe a faixa de valor: mínimo maior que zero e máximo igual ou maior que o mínimo.");
      if (!(Number.isInteger(dias) && dias >= 0 && dias <= 31)) throw new Error("Intervalo de dias deve ser um número inteiro de 0 a 31.");
      const { error } = await (supabase as any).from("regras_pix_receita").insert({
        nome: form.nome.trim() || form.receita,
        receita_descricao: form.receita,
        valor_minimo: min,
        valor_maximo: max,
        dias_tolerancia: dias,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra criada");
      setForm(formInicial);
      void qc.invalidateQueries({ queryKey: ["regras-pix"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar regra"),
  });

  const alternar = useMutation({
    mutationFn: async (r: Regra) => {
      const { error } = await (supabase as any).from("regras_pix_receita").update({ ativo: !r.ativo }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["regras-pix"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao alterar regra"),
  });

  const excluir = useMutation({
    mutationFn: async (r: Regra) => {
      const { data, error } = await (supabase as any).from("regras_pix_receita").delete().eq("id", r.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Não foi possível excluir a regra.");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["regras-pix"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir regra"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Regras de PIX para receitas fixas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Um PIX recebido dentro da faixa de valor e no intervalo de dias em torno do dia previsto confirma a
          receita fixa daquele mês. Só afeta a competência do PIX.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {regras.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>}
          {regras.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
              <div className="mr-auto min-w-0">
                <p className="truncate font-medium">{r.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {r.receita_descricao} · R$ {Number(r.valor_minimo).toFixed(2)} a R$ {Number(r.valor_maximo).toFixed(2)} ·
                  ±{r.dias_tolerancia} dia(s)
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => alternar.mutate(r)}>
                {r.ativo ? "Desativar" : "Ativar"}
              </Button>
              <Button size="icon" variant="ghost" aria-label="Excluir regra" onClick={() => excluir.mutate(r)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
          <Input placeholder="Nome da regra (opcional)" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.receita}
            onChange={(e) => setForm({ ...form, receita: e.target.value })}
          >
            <option value="">Receita fixa…</option>
            {fixas.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Input inputMode="decimal" placeholder="Valor mínimo (R$)" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} />
          <Input inputMode="decimal" placeholder="Valor máximo (R$)" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
          <Input inputMode="numeric" placeholder="Intervalo de dias (0 a 31)" value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} />
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
            Criar regra
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
