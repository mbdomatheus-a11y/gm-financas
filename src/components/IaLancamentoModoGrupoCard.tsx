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
  obterModoIaLancamento,
  salvarModoIaLancamentoGrupo,
  type ModoIaLancamento,
} from "@/lib/ia-lancamento-modo.functions";

const OPCOES: { valor: ModoIaLancamento | "herdar_site"; rotulo: string }[] = [
  { valor: "herdar_site", rotulo: "Seguir o padrão do site" },
  { valor: "ambos", rotulo: "Texto e áudio" },
  { valor: "somente_texto", rotulo: "Somente texto" },
  { valor: "somente_audio", rotulo: "Somente áudio" },
  { valor: "desabilitado", rotulo: "Desativado para o grupo" },
];

/**
 * Frente 2 do plano de 2026-10-02 (claude/plano-fase2-lancamento-2026-10-02.md
 * no projeto Claude): só o admin do GRUPO vê/edita este card — admin do site
 * define o padrão global em `/administracao`, e aqui o admin do grupo pode
 * sobrepor só pro próprio grupo. Mesmo padrão visual de
 * `ConciliacaoFaturasCard`.
 */
export function IaLancamentoModoGrupoCard() {
  const qc = useQueryClient();
  const obter = useServerFn(obterModoIaLancamento);
  const salvar = useServerFn(salvarModoIaLancamentoGrupo);

  const { data } = useQuery({
    queryKey: ["ia-lancamento-modo"],
    queryFn: () => obter(),
  });

  const mudar = useMutation({
    mutationFn: (valor: ModoIaLancamento | "herdar_site") => salvar({ data: { valor } }),
    onSuccess: () => {
      toast.success("Preferência de IA do grupo atualizada.");
      qc.invalidateQueries({ queryKey: ["ia-lancamento-modo"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4" /> Lançamento por IA do grupo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Escolha quais entradas o seu grupo pode usar no lançamento rápido por IA e no resumo
          financeiro: texto, áudio, os dois, ou desativar completamente — só pra quem faz parte
          deste grupo. Sem escolha aqui, vale o padrão definido pelo administrador do site.
        </p>
        <Select
          value={data?.overrideGrupo ?? "herdar_site"}
          onValueChange={(v) => mudar.mutate(v as ModoIaLancamento | "herdar_site")}
          disabled={mudar.isPending}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCOES.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data?.modo && (
          <p className="text-xs text-muted-foreground">
            Modo em vigor agora: <span className="font-medium">{rotuloModo(data.modo)}</span>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function rotuloModo(modo: ModoIaLancamento): string {
  switch (modo) {
    case "ambos":
      return "texto e áudio";
    case "somente_texto":
      return "somente texto";
    case "somente_audio":
      return "somente áudio";
    case "desabilitado":
      return "desativado";
    default:
      return modo;
  }
}
