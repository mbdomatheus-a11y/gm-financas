import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, Mail, Send, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  cancelarConvite,
  criarConvite,
  enviarConvitePorEmail,
  listarMeusConvites,
} from "@/lib/convites.functions";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { usePermissoes } from "@/hooks/useAuthData";
import { formatDate } from "@/lib/format";

const COTA_CONVITES_PADRAO = 3;

async function copiar(texto: string, mensagem = "Copiado") {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(mensagem);
  } catch {
    toast.error("Não foi possível copiar — copie manualmente");
  }
}

/** Monta o link de convite clicável a partir do domínio que a pessoa está
 * usando agora (evita apontar pro domínio de preview errado). Ao abrir, a
 * tela de login já pré-preenche o código e pula direto pra "Criar conta". */
function linkConvite(token: string) {
  if (typeof window === "undefined") return token;
  return `${window.location.origin}/entrar?convite=${encodeURIComponent(token)}`;
}

/**
 * Card de convites em cascata: mostra a cota configurável, gera novos
 * códigos e lista os já criados. Cada código pode ser copiado como link
 * clicável (abre direto na criação de conta) ou como texto puro, e digitado
 * manualmente se preferir. Usado em `/conta` (qualquer usuário) e em
 * `/usuarios` (admin).
 */
export function ConvitesCard() {
  const qc = useQueryClient();
  const { isSiteAdmin } = usePermissoes();
  const listar = useServerFn(listarMeusConvites);
  const criar = useServerFn(criarConvite);
  const enviarEmail = useServerFn(enviarConvitePorEmail);
  const cancelar = useServerFn(cancelarConvite);
  const obterConfig = useServerFn(obterConfiguracaoAcesso);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [emailAbertoId, setEmailAbertoId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");

  const { data: convites = [], isLoading } = useQuery({
    queryKey: ["meus-convites"],
    queryFn: async () => listar(),
  });

  const { data: config } = useQuery({
    queryKey: ["configuracao-acesso-publica"],
    queryFn: () => obterConfig(),
    staleTime: 60_000,
  });
  const cotaConvites = config?.cota_convites ?? COTA_CONVITES_PADRAO;

  const gerar = useMutation({
    mutationFn: async () => criar(),
    onSuccess: () => {
      toast.success("Convite gerado");
      qc.invalidateQueries({ queryKey: ["meus-convites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível gerar o convite"),
  });

  const enviar = useMutation({
    mutationFn: (params: { conviteId: string; email: string }) =>
      enviarEmail({ data: params }),
    onSuccess: () => {
      toast.success("Convite enviado por e-mail");
      setEmailAbertoId(null);
      setEmailInput("");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível enviar o e-mail"),
  });

  const cancelarConviteMutation = useMutation({
    mutationFn: (conviteId: string) => cancelar({ data: { conviteId } }),
    onSuccess: () => {
      toast.success("Convite cancelado");
      qc.invalidateQueries({ queryKey: ["meus-convites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível cancelar o convite"),
  });

  const agora = Date.now();
  const usados = convites.filter((c) => c.usado || new Date(c.expira_em).getTime() >= agora).length;
  const restantes = isSiteAdmin ? Infinity : Math.max(0, cotaConvites - usados);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserPlus className="size-4" /> Convidar pessoas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {isSiteAdmin
            ? "Como admin do site, você pode gerar convites sem limite."
            : `Você pode convidar até ${cotaConvites} pessoas. Quem você convidar também poderá convidar mais gente, e assim por diante.`}{" "}
          Gere um código abaixo e envie pra pessoa (WhatsApp, mensagem, ou pelo botão de e-mail) —
          ela acessa o site e digita o código na tela de cadastro pra criar a própria conta, num
          grupo separado, com os próprios dados.
        </p>
        {!isSiteAdmin && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Convites usados</span>
            <span className="font-semibold tabular-nums">
              {usados} / {cotaConvites}
            </span>
          </div>
        )}
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
              const podeAgir = !c.usado && !expirado;
              return (
                <div key={c.id} className="rounded-lg border px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono">{c.token}</p>
                      <p className="text-muted-foreground">
                        Criado em {formatDate(c.criado_em)}
                        {podeAgir && ` · expira em ${formatDate(c.expira_em)}`}
                      </p>
                    </div>
                    <Badge
                      variant={c.usado ? "default" : expirado ? "destructive" : "secondary"}
                      className="shrink-0 text-[10px]"
                    >
                      {c.usado ? "usado" : expirado ? "expirado" : "pendente"}
                    </Badge>
                    {podeAgir && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0"
                          onClick={() => {
                            setCopiadoId(c.id);
                            copiar(linkConvite(c.token), "Link de convite copiado");
                          }}
                          aria-label="Copiar link de convite (abre direto na criação de conta)"
                          title="Copiar link de convite"
                        >
                          <Copy
                            className={c.id === copiadoId ? "size-3.5 text-success" : "size-3.5"}
                          />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0"
                          onClick={() => {
                            setEmailAbertoId(emailAbertoId === c.id ? null : c.id);
                            setEmailInput("");
                          }}
                          aria-label="Enviar convite por e-mail"
                        >
                          <Mail className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0 text-destructive hover:text-destructive"
                          disabled={cancelarConviteMutation.isPending}
                          onClick={() => cancelarConviteMutation.mutate(c.id)}
                          aria-label="Cancelar convite"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  {emailAbertoId === c.id && (
                    <div className="mt-2 flex items-center gap-1.5 border-t pt-2">
                      <Input
                        type="email"
                        placeholder="email@daPessoa.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="icon"
                        className="size-8 shrink-0"
                        disabled={enviar.isPending || !emailInput.includes("@")}
                        onClick={() => enviar.mutate({ conviteId: c.id, email: emailInput.trim() })}
                        aria-label="Confirmar envio do convite por e-mail"
                      >
                        {enviar.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                      </Button>
                    </div>
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
