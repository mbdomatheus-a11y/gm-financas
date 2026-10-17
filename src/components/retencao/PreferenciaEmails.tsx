import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { obterPreferenciaEmails, salvarPreferenciaEmails } from "@/lib/funil.functions";

/** Liga e desliga o resumo semanal e o lembrete de vencimento por e-mail (2026-10-17). */
export function PreferenciaEmails() {
  const qc = useQueryClient();
  const obter = useServerFn(obterPreferenciaEmails);
  const salvar = useServerFn(salvarPreferenciaEmails);
  const { data } = useQuery({ queryKey: ["preferencia-emails"], queryFn: () => obter() });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="size-4" /> Avisos por e-mail
        </CardTitle>
        <CardDescription>Resumo da semana toda segunda-feira e lembrete 3 dias antes de um vencimento.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 text-sm">
        <span>{data?.ativo === false ? "Desligado" : "Ligado"}</span>
        <Switch
          checked={data?.ativo !== false}
          disabled={!data}
          onCheckedChange={async (v) => {
            try {
              await salvar({ data: { ativo: v } });
              await qc.invalidateQueries({ queryKey: ["preferencia-emails"] });
              toast.success(v ? "Avisos por e-mail ligados." : "Avisos por e-mail desligados.");
            } catch {
              toast.error("Não foi possível salvar.");
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
