import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, Send, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { enviarChamadoSuporte } from "@/lib/central-solicitacoes.functions";

export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte — Control ALL" },
      { name: "description", content: "Central de suporte e acompanhamento de chamados." },
    ],
  }),
  component: SuportePage,
});

const STATUS_INFO: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  recebido: { label: "Recebido", color: "bg-blue-500/10 text-blue-700", icon: Clock },
  em_atendimento: { label: "Em Atendimento", color: "bg-orange-500/10 text-orange-700", icon: Clock },
  aguardando_usuario: { label: "Aguardando sua resposta", color: "bg-yellow-500/10 text-yellow-700", icon: AlertCircle },
  resolvido: { label: "Resolvido", color: "bg-emerald-500/10 text-emerald-700", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-gray-500/10 text-gray-600", icon: XCircle },
};

function SuportePage() {
  const qc = useQueryClient();
  const enviarFn = useServerFn(enviarChamadoSuporte);

  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"elogio" | "reclamacao" | "sugestao">("sugestao");
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const { data: meusChamados = [], isLoading } = useQuery({
    queryKey: ["meus-chamados"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];
      const { data, error } = await supabase
        .from("chamados_suporte" as any)
        .select("id,protocolo,assunto,descricao,status,prioridade,resposta_admin,criado_em,atualizado_em")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enviar = useMutation({
    mutationFn: () =>
      enviarFn({ data: { assunto: assunto.trim(), descricao: descricao.trim(), prioridade } }),
    onSuccess: (res) => {
      setProtocolo(res.protocolo);
      setAssunto("");
      setDescricao("");
      setPrioridade("sugestao");
      qc.invalidateQueries({ queryKey: ["meus-chamados"] });
      toast.success("Chamado enviado com sucesso!");
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível enviar o chamado."),
  });

  const podeEnviar = assunto.trim().length >= 5 && descricao.trim().length >= 10 && !enviar.isPending;

  return (
    <AppLayout
      title="Central de Suporte"
      description="Envie um chamado ou acompanhe os seus já enviados"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Headphones className="size-4 text-primary" />
              Novo chamado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {protocolo && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700">
                <p className="font-semibold">Chamado enviado!</p>
                <p className="mt-1 font-mono text-xs">{protocolo}</p>
                <p className="mt-1 text-xs">Guarde este protocolo para acompanhar seu chamado.</p>
                <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setProtocolo(null)}>
                  Novo chamado
                </Button>
              </div>
            )}
            {!protocolo && (
              <>
                <div className="space-y-1.5">
                  <Label>Assunto <span className="text-rose-500">*</span></Label>
                  <Input
                    placeholder="Descreva brevemente seu problema ou dúvida"
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">{assunto.length}/120 caracteres</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição detalhada <span className="text-rose-500">*</span></Label>
                  <Textarea
                    placeholder="Descreva com detalhes o que aconteceu, quando e como reproduzir o problema..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={6}
                    maxLength={3000}
                  />
                  <p className="text-xs text-muted-foreground">{descricao.length}/3000 caracteres</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <Select value={prioridade} onValueChange={(v) => setPrioridade(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elogio">Elogio</SelectItem>
                      <SelectItem value="reclamacao">Reclamação</SelectItem>
                      <SelectItem value="sugestao">Sugestão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!podeEnviar}
                  onClick={() => enviar.mutate()}
                >
                  <Send className="mr-2 size-4" />
                  {enviar.isPending ? "Enviando…" : "Enviar chamado"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Lista de chamados */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Meus chamados
          </h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : meusChamados.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Você ainda não abriu nenhum chamado.
              </CardContent>
            </Card>
          ) : (
            (meusChamados as any[]).map((c) => {
              const info = STATUS_INFO[c.status as keyof typeof STATUS_INFO] ?? STATUS_INFO["recebido"];
              const Icon = info?.icon ?? Clock;
              return (
                <Card key={c.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.assunto}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.protocolo?.substring(0, 8)}…</p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${info?.color ?? ""}`}>
                        <Icon className="size-3" />{info?.label ?? c.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.descricao}</p>
                    {c.resposta_admin && (
                      <div className="rounded bg-muted p-2 text-xs">
                        <span className="font-semibold">Resposta: </span>
                        {c.resposta_admin}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Aberto em {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                      {c.atualizado_em && c.atualizado_em !== c.criado_em &&
                        ` · Atualizado em ${new Date(c.atualizado_em).toLocaleDateString("pt-BR")}`}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
