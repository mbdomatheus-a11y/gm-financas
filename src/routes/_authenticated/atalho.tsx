import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mic } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/atalho")({
  head: () => ({ meta: [{ title: "Lançar sem abrir o app | Control ALL" }] }),
  component: AtalhoPage,
});

const URL_API = "https://www.controlall.com.br/api/atalho";
type Estado = { ativo: boolean; criado_em?: string; ultimo_uso_em?: string | null; usos?: number };

/** Lançar sem abrir o app (15/11/2026), igual ao app (Mais > Configurações > Lançar sem abrir o app). */
function AtalhoPage() {
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState<string | null>(null);
  const { data: estado } = useQuery({
    queryKey: ["meu-atalho"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("meu_atalho");
      return ((data as Estado) ?? { ativo: false }) as Estado;
    },
  });
  const copiar = async (t: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast.success(msg);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };
  const gerar = async () => {
    const { data, error } = await (supabase as any).rpc("gerar_token_atalho");
    if (error || !data) {
      toast.error("Não foi possível gerar. Tente de novo.");
      return;
    }
    setCodigo(String(data));
    void qc.invalidateQueries({ queryKey: ["meu-atalho"] });
  };
  const revogar = async () => {
    if (!window.confirm("Desligar o atalho? Ele para de funcionar até você gerar um código novo.")) return;
    await (supabase as any).rpc("revogar_token_atalho");
    setCodigo(null);
    void qc.invalidateQueries({ queryKey: ["meu-atalho"] });
  };
  const passos = [
    'Abra o app Atalhos, toque em + e dê o nome "Gastei no Control ALL".',
    'Adicione a ação "Ditar texto".',
    'Adicione "Obter conteúdo do URL" com o endereço abaixo. Na seta: Método POST; Cabeçalhos: Authorization = Bearer e o seu código; Corpo: JSON com o campo texto = Texto ditado.',
    'Adicione "Mostrar resultado" para ver o que foi lançado.',
    "Use pela Siri, pelo Botão de Ação (Ajustes > Botão de Ação > Atalho) ou como widget.",
  ];
  return (
    <AppLayout title="Lançar sem abrir o app" description="Siri, Botão de Ação ou widget do iPhone">
      <div className="max-w-2xl space-y-4">
        <p className="text-muted-foreground">
          Diga "E aí Siri, gastei no Control ALL" e fale o gasto. A IA lança sozinha; quando você abrir o app, ele já está lá.
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="size-4" aria-hidden="true" /> 1. Seu código pessoal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {codigo ? (
              <>
                <code className="block break-all rounded-xl bg-muted p-3 text-sm">{codigo}</code>
                <p className="text-sm text-muted-foreground">Ele aparece só agora. Para trocar, gere outro.</p>
                <Button onClick={() => void copiar(codigo, "Código copiado.")}>
                  <Copy className="mr-1.5 size-4" /> Copiar código
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {estado?.ativo
                    ? `Atalho ligado${estado.usos ? `, ${estado.usos} lançamento${estado.usos === 1 ? "" : "s"} feitos` : ""}.`
                    : "Gere o código que liga o atalho à sua conta."}
                </p>
                <Button onClick={() => void gerar()}>{estado?.ativo ? "Gerar código novo" : "Gerar código"}</Button>
              </>
            )}
            {estado?.ativo && (
              <Button variant="outline" onClick={() => void revogar()}>
                Desligar atalho
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Crie o atalho no iPhone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {passos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
            <Button variant="outline" onClick={() => void copiar(URL_API, "Endereço copiado.")}>
              <Copy className="mr-1.5 size-4" /> Copiar endereço
            </Button>
            <p className="text-sm text-muted-foreground">
              Prefere conferir antes de salvar? Crie um atalho com "Abrir URLs" e o endereço controlall://novo: ele abre o app direto na IA.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
