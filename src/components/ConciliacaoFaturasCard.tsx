import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck } from "lucide-react";
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
  obterConciliacaoFaturas,
  salvarConciliacaoFaturas,
} from "@/lib/conciliacao-faturas.functions";

/**
 * Item 12 do backlog do proprietário: o grupo escolhe se parcelas vencidas
 * são consideradas pagas automaticamente 30 dias após o vencimento, ou se
 * prefere continuar marcando manualmente (padrão). O modo automático só
 * afeta parcelas com vencimento a partir de quando for ativado — não marca
 * retroativamente nada que já estava vencido antes da troca.
 */
export function ConciliacaoFaturasCard() {
  const qc = useQueryClient();
  const obter = useServerFn(obterConciliacaoFaturas);
  const salvar = useServerFn(salvarConciliacaoFaturas);

  const { data } = useQuery({
    queryKey: ["conciliacao-faturas"],
    queryFn: () => obter(),
  });

  const mudar = useMutation({
    mutationFn: (modo: "manual" | "automatico") => salvar({ data: { modo } }),
    onSuccess: (res) => {
      toast.success(
        res.modo === "automatico"
          ? "Conciliação automática ativada. Parcelas vencidas a partir de hoje serão marcadas como pagas 30 dias após o vencimento."
          : "Conciliação manual ativada. Você marca as parcelas como pagas.",
      );
      qc.invalidateQueries({ queryKey: ["conciliacao-faturas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarCheck className="size-4" /> Conciliação de faturas vencidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Escolha o que fazer com parcelas que passam do vencimento: marcar manualmente (você
          decide quando cada uma foi paga) ou automaticamente, 30 dias após o vencimento — ex.:
          uma parcela vencida em 15/08 é considerada paga em 15/09. Ao ativar o modo automático,
          só as parcelas que vencerem a partir de agora entram nessa regra; dívida já vencida
          antes disso continua exigindo confirmação manual.
        </p>
        <Select
          value={data?.modo ?? "manual"}
          onValueChange={(v) => mudar.mutate(v as "manual" | "automatico")}
          disabled={mudar.isPending}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual — eu marco quando pagar</SelectItem>
            <SelectItem value="automatico">Automático — 30 dias após o vencimento</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
