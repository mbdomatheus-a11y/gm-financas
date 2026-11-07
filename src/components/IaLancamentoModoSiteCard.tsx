import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminObterModoIaLancamentoSite,
  adminSalvarModoIaLancamentoSite,
  MODOS_IA,
  type ModoIaLancamento,
} from "@/lib/ia-lancamento-modo.functions";

const ROTULOS: Record<ModoIaLancamento, string> = {
  ambos: "Texto e áudio",
  somente_texto: "Somente texto",
  somente_audio: "Somente áudio",
  desabilitado: "Desativado para todo o site",
};

/**
 * Frente 2 do plano de 2026-10-02 (claude/plano-fase2-lancamento-2026-10-02.md
 * no projeto Claude): item 2 do pedido original — "na tela do admin deveria
 * ter opção de administrar se usuários podem mandar áudio ou texto, ou os
 * dois". Este é o padrão GLOBAL do site; cada grupo pode sobrepor o próprio
 * em "Minha conta" (`IaLancamentoModoGrupoCard`). Componente independente de
 * propósito (não thread na mutation grande de `adminSalvarConfiguracaoAcesso`
 * — mesma decisão já tomada para o toggle de Google Drive).
 */
export function IaLancamentoModoSiteCard() {
  const qc = useQueryClient();
  const obter = useServerFn(adminObterModoIaLancamentoSite);
  const salvar = useServerFn(adminSalvarModoIaLancamentoSite);

  const { data } = useQuery({
    queryKey: ["admin-ia-lancamento-modo-site"],
    queryFn: () => obter(),
  });

  const mudar = useMutation({
    mutationFn: (modoPadrao: ModoIaLancamento) => salvar({ data: { modoPadrao } }),
    onSuccess: () => {
      toast.success("Padrão de IA do site atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-ia-lancamento-modo-site"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar."),
  });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" /> Lançamento por IA
        </CardTitle>
        <p className="text-sm text-muted-foreground">Padrão do site, que cada grupo pode trocar em Minha conta.</p>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-2xl border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Modo padrão</p>
              <p className="text-xs text-muted-foreground">
                Desativado bloqueia texto, áudio e resumo para quem não tiver liberação do grupo.
              </p>
            </div>
        <Select
          value={data?.modoPadrao ?? "ambos"}
          onValueChange={(v) => mudar.mutate(v as ModoIaLancamento)}
          disabled={mudar.isPending}
        >
          <SelectTrigger className="w-44 shrink-0 sm:w-56" aria-label="Modo padrão do lançamento por IA">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODOS_IA.map((m) => (
              <SelectItem key={m} value={m}>
                {ROTULOS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
