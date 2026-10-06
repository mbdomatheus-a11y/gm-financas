import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Copy,
  Check,
  Send,
  Sparkles,
  ChevronRight,
  Loader2,
  Share2,
  KeyRound,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  cancelarConvite,
  criarConvite,
  listarMeusConvites,
} from "@/lib/convites.functions";
import { obterConfiguracaoAcesso } from "@/lib/configuracoes-site.functions";
import { usePermissoes, useProfile } from "@/hooks/useAuthData";
import { formatDate } from "@/lib/format";

const COTA_CONVITES_PADRAO = 3;

function linkConvite(token: string) {
  if (typeof window === "undefined") return token;
  return `${window.location.origin}/entrar?convite=${encodeURIComponent(token)}`;
}

/** Dados e ações de convites compartilhados por banner, botão do cabeçalho e Compartilhar. */
export function useConvitesAmigos() {
  const qc = useQueryClient();
  const { isSiteAdmin } = usePermissoes();
  const listar = useServerFn(listarMeusConvites);
  const criar = useServerFn(criarConvite);
  const cancelar = useServerFn(cancelarConvite);
  const obterConfig = useServerFn(obterConfiguracaoAcesso);

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
      toast.success("Novo convite criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["meus-convites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível gerar o convite"),
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
  const restantes = isSiteAdmin ? 99 : Math.max(0, cotaConvites - usados);
  const pendentes = convites.filter(
    (c) => !c.usado && new Date(c.expira_em).getTime() >= agora,
  );

  return {
    convites,
    isLoading,
    cotaConvites,
    gerar,
    cancelarConviteMutation,
    usados,
    restantes,
    pendentes,
    isSiteAdmin,
    /** Há convite a oferecer (admin do site tem ilimitados). */
    temConviteDisponivel: isSiteAdmin || restantes > 0,
  };
}

export function ConviteAmigosDialog({
  open: modalAberto,
  onOpenChange: setModalAberto,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const { convites, isLoading, cotaConvites, gerar, usados, restantes, pendentes, isSiteAdmin } =
    useConvitesAmigos();

  async function copiarTexto(texto: string, id: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      toast.success("Link de convite copiado!");
      setTimeout(() => setCopiadoId(null), 2500);
    } catch {
      toast.error("Erro ao copiar link");
    }
  }

  function compartilharWhatsApp(token: string) {
    const link = linkConvite(token);
    const mensagem = encodeURIComponent(
      `Oi! Estou usando o Control ALL para controlar minhas finanças e notas fiscais com IA. Use meu convite exclusivo para criar sua conta:\n\n${link}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${mensagem}`, "_blank");
  }

  return (
    <>
      {/* Modal de Compartilhamento */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Share2 className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              Convidar amigos para o Control ALL
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Compartilhe seu link exclusivo. Cada amigo convidado cria sua própria conta com
              privacidade total.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status da cota */}
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3 text-xs">
              <span className="text-muted-foreground">Sua cota de convites:</span>
              <span className="font-semibold text-foreground">
                {isSiteAdmin ? "Ilimitado (Admin)" : `${usados} de ${cotaConvites} usados`}
              </span>
            </div>

            {/* Gerar convite se puder */}
            {(restantes > 0 || isSiteAdmin) && (
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-10"
                disabled={gerar.isPending}
                onClick={() => gerar.mutate()}
              >
                {gerar.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                Gerar novo link de convite
              </Button>
            )}

            {/* Lista de convites gerados */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Seus convites disponíveis:
              </p>

              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : pendentes.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
                  Nenhum convite ativo no momento. Clique no botão acima para gerar um!
                </div>
              ) : (
                pendentes.map((c) => {
                  const link = linkConvite(c.token);
                  const copiou = copiadoId === c.id;

                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border bg-card p-3 space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <KeyRound className="size-3.5 text-cyan-600 shrink-0" />
                          <span className="font-mono text-xs font-semibold truncate">
                            {c.token}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          Expira em {formatDate(c.expira_em)}
                        </Badge>
                      </div>

                      {/* Botões de Ação Direta */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => copiarTexto(link, c.id)}
                        >
                          {copiou ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          {copiou ? "Copiado!" : "Copiar link"}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs gap-1.5 bg-[#25D366] hover:bg-[#1ebd5a] text-white"
                          onClick={() => compartilharWhatsApp(c.token)}
                        >
                          <Send className="size-3.5" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Convites já aceitos */}
            {convites.some((c) => c.usado) && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                  Amigos que já entraram 🎉
                </p>
                <div className="space-y-1">
                  {convites
                    .filter((c) => c.usado)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-300"
                      >
                        <span className="font-mono">{c.token}</span>
                        <span className="font-medium text-[11px]">Conta criada ✅</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Banner "Convide seus amigos" com visual premium turquesa/ciano.
 */
export function ConviteAmigosBanner({ className = "" }: { className?: string }) {
  const [modalAberto, setModalAberto] = useState(false);
  const { restantes, isSiteAdmin } = useConvitesAmigos();

  return (
    <>
      {/* Banner Principal com Visual Cyan/Aqua */}
      <div
        onClick={() => setModalAberto(true)}
        className={`group relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 p-5 text-slate-950 shadow-md transition-all hover:scale-[1.01] hover:shadow-lg cursor-pointer ${className}`}
      >
        {/* Padrão decorativo no fundo */}
        <div className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full bg-white/20 blur-xl transition-transform group-hover:scale-125" />
        <div className="pointer-events-none absolute bottom-0 right-20 size-24 rounded-full bg-cyan-200/30 blur-lg" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950/10 backdrop-blur-sm">
              <Users className="size-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-slate-950">
                  Convide seus amigos
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/15 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
                  <Sparkles className="size-2.5" />
                  {isSiteAdmin ? "Ilimitado" : `${restantes} disponível${restantes === 1 ? "" : "is"}`}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-900/80">
                E ajude sua galera a controlar a vida financeira também :)
              </p>
            </div>
          </div>

          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-950/10 text-slate-950 transition-transform group-hover:translate-x-1">
            <ChevronRight className="size-5" />
          </div>
        </div>
      </div>

      <ConviteAmigosDialog open={modalAberto} onOpenChange={setModalAberto} />
    </>
  );
}

/** Botão ao lado do sino: só aparece enquanto houver convites disponíveis. */
export function ConviteRapidoBotao({ comTexto = false }: { comTexto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const { temConviteDisponivel, isLoading } = useConvitesAmigos();
  if (isLoading || !temConviteDisponivel) return null;
  if (comTexto) {
    return (
      <>
        <Button className="w-full sm:w-auto" onClick={() => setAberto(true)}>
          <UserPlus className="size-4" /> Convidar amigos
        </Button>
        <ConviteAmigosDialog open={aberto} onOpenChange={setAberto} />
      </>
    );
  }
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setAberto(true)}
        aria-label="Convidar amigos"
        title="Convidar amigos"
      >
        <UserPlus className="size-4.5" />
      </Button>
      <ConviteAmigosDialog open={aberto} onOpenChange={setAberto} />
    </>
  );
}

const CHAVE_CONVITE_ADIADO = "control-all-convite-adiado-ate";
const DIAS_PARA_PEDIR_CONVITE = 3;
const DIAS_ADIAR_CONVITE = 7;

/**
 * Depois de 3 dias de uso, mostra uma vez na abertura um pedido para convidar
 * amigos (enquanto houver convites). "Agora não" adia por 7 dias.
 */
export function ConviteAposTresDias({ bloqueado = false }: { bloqueado?: boolean }) {
  const { data: perfil } = useProfile();
  const { temConviteDisponivel, isLoading } = useConvitesAmigos();
  const [aberto, setAberto] = useState(false);
  const [dialogo, setDialogo] = useState(false);

  const criadoEm = (perfil as { created_at?: string } | null | undefined)?.created_at;
  const elegivel =
    !!criadoEm &&
    Date.now() - new Date(criadoEm).getTime() >= DIAS_PARA_PEDIR_CONVITE * 86_400_000;

  useEffect(() => {
    if (bloqueado || !elegivel || isLoading || !temConviteDisponivel) return;
    try {
      if (sessionStorage.getItem("control-all-convite-visto-sessao")) return;
      const ate = Number(localStorage.getItem(CHAVE_CONVITE_ADIADO) ?? 0);
      if (ate > Date.now()) return;
      sessionStorage.setItem("control-all-convite-visto-sessao", "1");
    } catch {
      // Sem armazenamento: mostra mesmo assim.
    }
    setAberto(true);
  }, [bloqueado, elegivel, isLoading, temConviteDisponivel]);

  function adiar() {
    try {
      localStorage.setItem(
        CHAVE_CONVITE_ADIADO,
        String(Date.now() + DIAS_ADIAR_CONVITE * 86_400_000),
      );
    } catch {
      // ignorado
    }
    setAberto(false);
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : adiar())}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600">
              <Users className="size-6" />
            </div>
            <DialogTitle>Gostando do Control ALL?</DialogTitle>
            <DialogDescription>
              Você já usa o site há alguns dias. Convide amigos e família para controlarem as finanças
              também. Cada pessoa cria sua própria conta, com total privacidade.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setAberto(false);
                setDialogo(true);
              }}
            >
              <Share2 className="mr-2 size-4" /> Convidar amigos
            </Button>
            <Button variant="ghost" onClick={adiar}>
              Agora não
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConviteAmigosDialog open={dialogo} onOpenChange={setDialogo} />
    </>
  );
}
