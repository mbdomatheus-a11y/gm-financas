import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { resumoFinanceiroIA } from "@/lib/lancamento-ia.functions";
import { useResumoFinanceiroMes } from "@/hooks/useResumoFinanceiroMes";
import { formatBRL } from "@/lib/format";

const SUGESTOES = [
  "Quanto sobra este mês?",
  "Quais garantias vencem em breve?",
  "O que tem na minha lista de compras?",
  "Quais notas fiscais lancei recentemente?",
];

/**
 * Assistente do Início. Responde com base nos dados do próprio usuário (resumo do
 * mês, lista de compras, garantias e notas). Não grava nada: lançamentos são feitos
 * pelo botão "Lançar", que mostra o rascunho para conferência antes de salvar.
 */
export function AssistenteHome() {
  const { resumo } = useResumoFinanceiroMes();
  const perguntarFn = useServerFn(resumoFinanceiroIA);
  const [pergunta, setPergunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<string | null>(null);

  const { data: contexto } = useQuery({
    queryKey: ["assistente-home-contexto"],
    queryFn: async () => {
      const hoje = new Date();
      const limite = new Date(hoje.getTime() + 60 * 86400000).toISOString().slice(0, 10);
      const [lista, notas] = await Promise.all([
        supabase
          .from("lista_compras")
          .select("nome,quantidade,comprado")
          .eq("comprado", false)
          .limit(100),
        supabase
          .from("notas_fiscais")
          .select("estabelecimento,descricao,data_compra,garantia_fim,valor_total")
          .order("data_compra", { ascending: false })
          .limit(30),
      ]);
      const garantias = (notas.data ?? []).filter(
        (n) => n.garantia_fim && n.garantia_fim >= hoje.toISOString().slice(0, 10) && n.garantia_fim <= limite,
      );
      const linhas: string[] = [];
      linhas.push(
        `Lista de compras pendentes (${lista.data?.length ?? 0}): ` +
          (lista.data ?? []).map((i) => `${i.nome}${i.quantidade ? ` x${i.quantidade}` : ""}`).join(", "),
      );
      linhas.push(
        `Garantias que vencem nos próximos 60 dias (${garantias.length}): ` +
          garantias.map((g) => `${g.descricao || g.estabelecimento} até ${g.garantia_fim}`).join("; "),
      );
      linhas.push(
        `Últimas notas fiscais (${notas.data?.length ?? 0}): ` +
          (notas.data ?? [])
            .slice(0, 10)
            .map((n) => `${n.estabelecimento} em ${n.data_compra} (${formatBRL(Number(n.valor_total ?? 0))})`)
            .join("; "),
      );
      return linhas.join("\n");
    },
  });

  async function perguntar(texto?: string) {
    const termo = (texto ?? pergunta).trim();
    if (!termo) return;
    setPergunta(termo);
    setEnviando(true);
    setResposta(null);
    try {
      const r = await perguntarFn({
        data: {
          // Só o que o usuário digitou conta no limite de caracteres; os dados vão à parte.
          pergunta: termo,
          resumo,
          contextoExtra: contexto ?? "",
        },
      });
      if (r.erro && !r.texto) {
        toast.error(r.erro);
        return;
      }
      setResposta(r.texto);
    } catch {
      toast.error("Assistente indisponível agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" /> Pergunte ao assistente
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Respondo com base nos seus dados. Para lançar uma despesa ou receita, use o botão Lançar: você confere o rascunho antes de salvar.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void perguntar(s)}
              disabled={enviando}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/60 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void perguntar();
          }}
        >
          <Input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex.: quanto gastei com mercado?"
            aria-label="Pergunta para o assistente"
            maxLength={500}
          />
          <Button type="submit" size="icon" disabled={enviando || !pergunta.trim()} aria-label="Enviar">
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
        {resposta && (
          <div className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm">{resposta}</div>
        )}
      </CardContent>
    </Card>
  );
}
