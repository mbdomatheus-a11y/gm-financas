import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { criarConvite, listarMeusConvites } from "@/lib/convites.functions";
import { formatDate } from "@/lib/format";

const COTA_CONVITES = 3;

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Código copiado");
  } catch {
    toast.error("Não foi possível copiar — copie manualmente");
  }
}

/**
 * Card de convites em cascata: mostra a cota (até 3 por pessoa), gera novos
 * códigos e lista os já criados. Cada código é digitado manualmente pela
 * pessoa convidada direto na tela de cadastro do site (não depende mais de
 * um link com domínio específico, que podia apontar pro domínio de preview
 * errado). Usado em `/conta` (qualquer usuário) e em `/usuarios` (admin).
 */
export function ConvitesCard() {
  const qc = useQueryClient();
  const listar = useServerFn(listarMeusConvites);
  const criar = useServerFn(criarConvite);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const { data: convites = [], isLoading } = useQuery({
    queryKey: ["meus-convites"],
    queryFn: async () => listar(),
  });

  const gerar = useMutation({
    mutationFn: async () => criar(),
    onSuccess: () => {
      toast.success("Convite gerado");
      qc.invalidateQueries({ queryKey: ["meus-convites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível gerar o convite"),
  });

  const agora = Date.now();
  const usados = convites.filter((c) => c.usado || new Date(c.expira_em).getTime() >= agora).length;
  const restantes = Math.max(0, COTA_CONVITES - usados);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserPlus className="size-4" /> Convidar pessoas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cada pessoa pode convidar até {COTA_CONVITES}. Quem você convidar também poderá convidar
          mais {COTA_CONVITES}, e assim por diante. Gere um código abaixo e envie diretamente pra
          pessoa (WhatsApp, mensagem, etc.) — ela acessa o site e digita o código na tela de
          cadastro pra criar a própria conta, num grupo separado, com os próprios dados.
        </p>
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Convites usados</span>
          <span className="font-semibold tabular-nums">
            {usados} / {COTA_CONVITES}
          </span>
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={gerar.isPending || restantes === 0}
          onClick={() => gerar.mutate()}
        >
          {gerar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {restantes === 0 ? "Limite de convites atingido" : "Gerar código de convite"}
        </Button>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : convites.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum convite gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {convites.map((c) => {
              const expirado = !c.usado && new Date(c.expira_em).getTime() < agora;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono">{c.token}</p>
                    <p className="text-muted-foreground">
                      Criado em {formatDate(c.criado_em)}
                      {!c.usado && !expirado && ` · expira em ${formatDate(c.expira_em)}`}
                    </p>
                  </div>
                  <Badge
                    variant={c.usado ? "default" : expirado ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {c.usado ? "usado" : expirado ? "expirado" : "pendente"}
                  </Badge>
                  {!c.usado && !expirado && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      onClick={() => {
                        setCopiadoId(c.id);
                        copiar(c.token);
                      }}
                      aria-label="Copiar código do convite"
                    >
                      <Copy className={c.id === copiadoId ? "size-3.5 text-success" : "size-3.5"} />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
