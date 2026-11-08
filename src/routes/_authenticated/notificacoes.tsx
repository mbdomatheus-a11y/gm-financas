import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePreferenciasNotificacao,
  type LembreteChave,
  type ModoHorario,
  type PreferenciasNotificacao,
} from "@/hooks/usePreferenciasNotificacao";
import { cn } from "@/lib/utils";
import { CaixaAvisos } from "@/components/notificacoes/CaixaAvisos";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações | Control ALL" },
      { name: "description", content: "Escolha quais avisos receber, por qual canal e em que horário." },
    ],
  }),
  component: NotificacoesPage,
});

/** 08/11/2026: mesmas opções do app (src/app/mais/notificacoes.tsx). */
const MODOS_HORARIO: { id: ModoHorario; titulo: string; detalhe: string }[] = [
  { id: "sempre", titulo: "Sempre que acontecer", detalhe: "O aviso chega na hora" },
  { id: "janela", titulo: "Só num horário", detalhe: "Fora dele, guarda e entrega no início" },
  { id: "desligado", titulo: "Desligadas", detalhe: "Nenhum aviso no celular" },
];

const LEMBRETES: { chave: LembreteChave; titulo: string; detalhe: string }[] = [
  { chave: "despesa_perto_vencer", titulo: "Despesa perto de vencer", detalhe: "Um dia antes do vencimento" },
  { chave: "revisar_faturas", titulo: "Revisar faturas", detalhe: "No dia do fechamento de cada cartão" },
  { chave: "receita_a_receber", titulo: "Receita a receber", detalhe: "No dia previsto para entrar" },
  { chave: "limite_perto", titulo: "Limite perto do fim", detalhe: "Quando um limite de gastos estiver quase no teto" },
  { chave: "meta_sem_aporte", titulo: "Caixinha sem aporte", detalhe: "Quando o mês avança sem guardar o valor combinado" },
  { chave: "revisar_transacoes", titulo: "Revisar lançamentos", detalhe: "Um lembrete por dia para conferir o que entrou" },
  { chave: "dicas_economia", titulo: "Dicas de economia", detalhe: "Sugestões a partir dos seus gastos" },
  { chave: "garantia_vencendo", titulo: "Garantia perto do fim", detalhe: "Antes de a garantia de uma nota fiscal acabar" },
  { chave: "veiculo_manutencao", titulo: "Manutenção do veículo", detalhe: "Revisões, documentos e eventos do veículo" },
  { chave: "lista_compras", titulo: "Lista de compras", detalhe: "Itens aprovados e lembretes da lista" },
  { chave: "habito_lancar", titulo: "Lembrete para lançar gastos", detalhe: "Quando ficar sem lançar e o resumo da semana" },
];

function Grupo({ titulo, rodape, children }: { titulo?: string; rodape?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      {titulo && <h2 className="mb-2 px-4 text-sm font-semibold text-muted-foreground">{titulo}</h2>}
      <div className="divide-y overflow-hidden rounded-3xl border bg-card">{children}</div>
      {rodape && <p className="mt-2 px-4 text-xs text-muted-foreground">{rodape}</p>}
    </section>
  );
}

function Linha({
  titulo,
  detalhe,
  children,
  desativada,
  id,
}: {
  titulo: string;
  detalhe?: string;
  children: ReactNode;
  desativada?: boolean;
  id?: string;
}) {
  return (
    <div className={cn("flex min-h-14 items-center gap-4 px-5 py-3", desativada && "opacity-50")}>
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titulo}</span>
        {detalhe && <span className="block text-xs text-muted-foreground">{detalhe}</span>}
      </label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NotificacoesPage() {
  const { prefs, salvar, tabelaPendente, carregando } = usePreferenciasNotificacao();
  const [local, setLocal] = useState<PreferenciasNotificacao>(prefs);
  const editando = useRef(false);

  // Segue o servidor enquanto o usuário não estiver mexendo num horário.
  useEffect(() => {
    if (!editando.current) setLocal(prefs);
  }, [prefs]);

  async function aplicar(parcial: Partial<PreferenciasNotificacao>) {
    const proximas = { ...local, ...parcial };
    setLocal(proximas);
    try {
      await salvar(proximas);
      toast.success("Salvo", { id: "pref-notif", duration: 1200 });
    } catch (e) {
      setLocal(prefs);
      toast.error(e instanceof Error ? e.message : "Não consegui salvar. Tente de novo.", { id: "pref-notif" });
    }
  }

  function alternarLembrete(chave: LembreteChave, valor: boolean) {
    void aplicar({ lembretes: { ...local.lembretes, [chave]: valor } });
  }

  const desligado = !local.receber_todas;
  const bloqueado = tabelaPendente || carregando;

  return (
    <AppLayout title="Notificações" description="O que avisar, por onde e quando">
      <div className="mx-auto max-w-xl">
        {tabelaPendente && (
          <div className="mb-6 flex items-start gap-3 rounded-3xl border bg-muted px-5 py-4 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              As preferências de notificação estão sendo preparadas. Por enquanto, todos os avisos seguem ligados.
            </p>
          </div>
        )}

        <Tabs defaultValue="avisos">
          <TabsList className="mb-6 grid w-full grid-cols-4 rounded-full">
            <TabsTrigger value="avisos" className="rounded-full">Avisos</TabsTrigger>
            <TabsTrigger value="geral" className="rounded-full">Geral</TabsTrigger>
            <TabsTrigger value="canais" className="rounded-full">Canais</TabsTrigger>
            <TabsTrigger value="lembretes" className="rounded-full">Lembretes</TabsTrigger>
          </TabsList>

          <TabsContent value="avisos">
            <CaixaAvisos />
          </TabsContent>

          <TabsContent value="geral">
            <Grupo rodape="Desligado, você não recebe nenhum aviso. Os alertas continuam no sino dentro do app.">
              <Linha id="receber-todas" titulo="Receber notificações" detalhe="Liga ou desliga todos os avisos">
                <Switch
                  id="receber-todas"
                  checked={local.receber_todas}
                  disabled={bloqueado}
                  onCheckedChange={(v) => void aplicar({ receber_todas: v })}
                />
              </Linha>
            </Grupo>

            <Grupo
              titulo="Quando avisar"
              rodape={
                local.modo_horario === "janela"
                  ? "Fora desse horário os avisos ficam guardados e chegam no início do intervalo."
                  : local.modo_horario === "desligado"
                    ? "Nenhum aviso no celular. Eles continuam aparecendo na aba Avisos e no sino."
                    : "O aviso chega na hora em que acontece: lançamento, limite, banco, convite ou vencimento."
              }
            >
              {MODOS_HORARIO.map((m) => (
                <Linha
                  key={m.id}
                  id={`modo-${m.id}`}
                  titulo={m.id === "janela" ? `Só entre ${local.janela_inicio} e ${local.janela_fim}` : m.titulo} detalhe={m.detalhe} desativada={desligado}>
                  <input
                    type="radio"
                    id={`modo-${m.id}`}
                    name="modo-horario"
                    checked={local.modo_horario === m.id}
                    disabled={bloqueado || desligado}
                    onChange={() => void aplicar({ modo_horario: m.id })}
                    className="size-5 accent-[hsl(var(--primary))]"
                  />
                </Linha>
              ))}
              {local.modo_horario === "janela" && (
                <>
                  <Linha id="janela-inicio" titulo="Das" desativada={desligado}>
                    <input
                      id="janela-inicio"
                      type="time"
                      value={local.janela_inicio}
                      disabled={bloqueado || desligado}
                      onFocus={() => (editando.current = true)}
                      onChange={(e) => setLocal((l) => ({ ...l, janela_inicio: e.target.value }))}
                      onBlur={(e) => {
                        editando.current = false;
                        if (e.target.value && e.target.value !== prefs.janela_inicio)
                          void aplicar({ janela_inicio: e.target.value });
                      }}
                      className="h-9 rounded-xl bg-muted px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                  </Linha>
                  <Linha id="janela-fim" titulo="Até" desativada={desligado}>
                    <input
                      id="janela-fim"
                      type="time"
                      value={local.janela_fim}
                      disabled={bloqueado || desligado}
                      onFocus={() => (editando.current = true)}
                      onChange={(e) => setLocal((l) => ({ ...l, janela_fim: e.target.value }))}
                      onBlur={(e) => {
                        editando.current = false;
                        if (e.target.value && e.target.value !== prefs.janela_fim)
                          void aplicar({ janela_fim: e.target.value });
                      }}
                      className="h-9 rounded-xl bg-muted px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                  </Linha>
                </>
              )}
            </Grupo>
          </TabsContent>

          <TabsContent value="canais">
            <Grupo
              titulo="Por onde avisar"
              rodape="As notificações no celular dependem de permitir avisos do Control ALL nos ajustes do aparelho."
            >
              <Linha id="canal-push" titulo="No celular" detalhe="Avisos no iPhone e no Android" desativada={desligado}>
                <Switch
                  id="canal-push"
                  checked={local.canal_push}
                  disabled={bloqueado || desligado}
                  onCheckedChange={(v) => void aplicar({ canal_push: v })}
                />
              </Linha>
              <Linha id="canal-email" titulo="Por e-mail" detalhe="Resumo enviado para o e-mail da conta" desativada={desligado}>
                <Switch
                  id="canal-email"
                  checked={local.canal_email}
                  disabled={bloqueado || desligado}
                  onCheckedChange={(v) => void aplicar({ canal_email: v })}
                />
              </Linha>
            </Grupo>
          </TabsContent>

          <TabsContent value="lembretes">
            <Grupo titulo="Lembretes" rodape="Escolha quais lembretes quer receber. Os alertas do sino continuam aparecendo.">
              {LEMBRETES.map((l) => (
                <Linha key={l.chave} id={`lembrete-${l.chave}`} titulo={l.titulo} detalhe={l.detalhe} desativada={desligado}>
                  <Switch
                    id={`lembrete-${l.chave}`}
                    checked={local.lembretes[l.chave]}
                    disabled={bloqueado || desligado}
                    onCheckedChange={(v) => alternarLembrete(l.chave, v)}
                  />
                </Linha>
              ))}
            </Grupo>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
