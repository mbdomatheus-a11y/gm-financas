import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useFinance";

/** Edição rápida de uma despesa sem sair da tela. */
export function EditarDespesaRapido({
  despesa,
  onClose,
}: {
  despesa: any | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: categorias = [] } = useCategorias("despesa");
  const [form, setForm] = useState({
    descricao: "",
    categoria: "",
    tipo: "variavel",
    responsavel: "",
  });

  useEffect(() => {
    if (!despesa) return;
    setForm({
      descricao: despesa.descricao ?? "",
      categoria: despesa.categoria ?? "",
      tipo: despesa.tipo ?? "variavel",
      responsavel: despesa.responsavel ?? "",
    });
  }, [despesa]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("despesas")
        .update({
          descricao: form.descricao,
          categoria: form.categoria,
          tipo: form.tipo,
          responsavel: form.responsavel || null,
        })
        .eq("id", despesa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      toast.success("Despesa atualizada.");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não consegui salvar."),
  });

  return (
    <Dialog open={!!despesa} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(categorias as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Input
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
