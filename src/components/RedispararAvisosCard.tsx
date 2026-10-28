import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminAlternarBetaAndroid, adminRedispararAviso, obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";

/**
 * Avisos que a pessoa dispensa uma vez e não vê mais (convite de amigos e aviso de cookies).
 * O admin pode mostrar de novo para todos: isso cria uma "rodada" nova do aviso.
 */
export function RedispararAvisosCard() {
  const qc = useQueryClient();
  const obterFn = useServerFn(obterConfiguracaoAcesso);
  const redispararFn = useServerFn(adminRedispararAviso);
  const betaAndroidFn = useServerFn(adminAlternarBetaAndroid);
  const betaAndroid = useMutation({
    mutationFn: (aberto: boolean) => betaAndroidFn({ data: { aberto } }),
    onSuccess: (_r, aberto) => {
      toast.success(aberto ? "Vagas do beta Android abertas no site (limite de 50)." : "Beta Android fechado no site.");
      void qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível alterar."),
  });
  const { data: config } = useQuery({
    queryKey: ["configuracao-acesso-publica"],
    queryFn: () => obterFn(),
    staleTime: 60_000,
  });
  const redisparar = useMutation({
    mutationFn: (aviso: "convite" | "privacidade" | "beta") => redispararFn({ data: { aviso } }),
    onSuccess: (r, aviso) => {
      toast.success(
        aviso === "beta"
          ? `Aviso do app beta disparado para todos (rodada ${r.rodada}).`
          : aviso === "convite"
            ? `Convite de amigos vai aparecer de novo para todos (rodada ${r.rodada}).`
            : `Aviso de cookies vai aparecer de novo para todos (rodada ${r.rodada}).`,
      );
      void qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível redisparar."),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="size-4" aria-hidden="true" /> Avisos dispensáveis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Quem marca "não mostrar mais" no aviso do app beta ou no convite de amigos, ou responde o aviso de cookies, não vê mais (vale em qualquer aparelho). Use os botões abaixo para
          mostrar de novo a todos (por exemplo, depois de mudar a política de privacidade).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={redisparar.isPending}
            onClick={() => redisparar.mutate("beta")}
          >
            {Number(config?.rodada_aviso_beta ?? 0) > 0
              ? `Disparar de novo o aviso do app beta (rodada atual ${config?.rodada_aviso_beta})`
              : "Disparar aviso do app beta (TestFlight)"}
          </Button>
          <Button
            variant={config?.beta_android_aberto ? "outline" : "default"}
            disabled={betaAndroid.isPending}
            onClick={() => betaAndroid.mutate(!config?.beta_android_aberto)}
          >
            {config?.beta_android_aberto ? "Fechar vagas do beta Android" : "Abrir vagas do beta Android (Google Play, 50 vagas)"}
          </Button>
          <Button
            variant="outline"
            disabled={redisparar.isPending}
            onClick={() => redisparar.mutate("convite")}
          >
            Redisparar convite de amigos (rodada atual {config?.rodada_aviso_convite ?? 1})
          </Button>
          <Button
            variant="outline"
            disabled={redisparar.isPending}
            onClick={() => redisparar.mutate("privacidade")}
          >
            Redisparar aviso de cookies (rodada atual {config?.rodada_aviso_privacidade ?? 1})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
