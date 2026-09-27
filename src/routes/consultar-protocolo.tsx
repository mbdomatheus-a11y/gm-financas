import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { consultarProtocolo } from "@/lib/central-solicitacoes.functions";

// Item 8 do backlog 2026-09-27: página pública de acompanhamento por
// protocolo, linkada nos e-mails de confirmação enviados ao usuário
// (privacidade, chamados de suporte e faturas enviadas para modelagem).
// Aceita `?p=<protocolo>` (link direto do e-mail) e também uma busca manual
// por protocolo ou CPF, reaproveitando a mesma server fn `consultarProtocolo`
// já usada antes (mas que até esta sessão não tinha nenhuma tela).
export const Route = createFileRoute("/consultar-protocolo")({
  validateSearch: (search: Record<string, unknown>) => ({
    p: typeof search.p === "string" ? search.p : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Consultar Protocolo — Control ALL" },
      { name: "description", content: "Acompanhe o status de uma solicitação pelo número de protocolo." },
    ],
  }),
  component: ConsultarProtocoloPage,
});

const STATUS_LABEL: Record<string, string> = {
  recebida: "Recebida",
  em_analise: "Em Análise",
  concluida: "Concluída",
  indeferida: "Indeferida",
  em_atendimento: "Em Atendimento",
  aguardando_ti: "Aguardando TI",
  planejado: "Planejado",
  programado: "Programado",
  recebido: "Recebido",
  aguardando_usuario: "Aguardando sua resposta",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
  corrigida: "Concluída / Tratada",
  descartada: "Descartada",
  em_modelagem: "Em análise",
};

const TIPO_LABEL: Record<string, string> = {
  privacidade: "Solicitação de Privacidade",
  suporte: "Chamado de Suporte",
  layout: "Fatura Enviada para Modelagem",
};

function ConsultarProtocoloPage() {
  const { p } = Route.useSearch();
  const consultarFn = useServerFn(consultarProtocolo);

  const [protocoloInput, setProtocoloInput] = useState(p || "");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<any>(undefined);
  const [jaBuscou, setJaBuscou] = useState(false);

  async function buscar(protocolo: string) {
    if (!protocolo.trim()) return;
    setBuscando(true);
    setJaBuscou(true);
    try {
      const r = await consultarFn({ data: { protocolo: protocolo.trim() } });
      setResultado(Array.isArray(r) ? r[0] ?? null : r);
    } catch (e: any) {
      toast.error(e?.message || "Protocolo inválido.");
      setResultado(null);
    } finally {
      setBuscando(false);
    }
  }

  // Busca automática quando chega via link do e-mail (?p=...).
  useEffect(() => {
    if (p) buscar(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <Link to="/entrar" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <Card>
        <CardContent className="space-y-5 p-6 text-sm">
          <div>
            <h1 className="text-2xl font-bold">Consultar Protocolo</h1>
            <p className="text-muted-foreground">
              Acompanhe o status de uma solicitação de privacidade, chamado de suporte ou fatura
              enviada para modelagem usando o protocolo recebido por e-mail.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Número de protocolo</Label>
              <Input
                value={protocoloInput}
                onChange={(e) => setProtocoloInput(e.target.value)}
                placeholder="ex.: 3f2a9c10-..."
              />
            </div>
            <Button disabled={buscando} onClick={() => buscar(protocoloInput)}>
              <Search className="mr-2 size-4" /> {buscando ? "Buscando…" : "Consultar"}
            </Button>
          </div>

          {jaBuscou && !buscando && (
            <div className="border-t pt-4">
              {resultado ? (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <b>{TIPO_LABEL[resultado.tipo] ?? resultado.tipo}</b>
                    <Badge variant="outline">{STATUS_LABEL[resultado.status] ?? resultado.status}</Badge>
                  </div>
                  {resultado.tipo_solicitacao && (
                    <p className="text-xs text-muted-foreground">Assunto: {resultado.tipo_solicitacao}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Aberto há {resultado.dias_aberto} dia(s).</p>
                  {resultado.resposta && (
                    <div className="rounded bg-background p-2 text-xs">
                      <span className="font-semibold">Resposta: </span>
                      {resultado.resposta}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma solicitação encontrada para esse protocolo. Confira se copiou o código
                  completo recebido por e-mail.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
