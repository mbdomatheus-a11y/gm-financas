import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Headphones,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Ban,
  Paperclip,
  MessageSquarePlus,
  X,
} from "lucide-react";
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
import {
  enviarChamadoSuporte,
  cancelarChamadoSuporte,
  criarUploadAnexoChamado,
  complementarChamadoSuporte,
  listarMensagensChamado,
  obterUrlAnexoChamado,
} from "@/lib/central-solicitacoes.functions";

// Item 12: mesma lista/limite validados no server (ver
// central-solicitacoes.functions.ts) — checagem aqui é só pra dar feedback
// imediato, o server nunca confia só no client.
const ANEXO_TIPOS_PERMITIDOS = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const ANEXO_TAMANHO_MAXIMO = 20 * 1024 * 1024; // 20MB

function validarArquivoAnexo(file: File): string | null {
  if (!ANEXO_TIPOS_PERMITIDOS.has(file.type)) {
    return "Tipo de arquivo não permitido. Envie apenas imagem (JPG, PNG, WEBP) ou PDF.";
  }
  if (file.size > ANEXO_TAMANHO_MAXIMO) {
    return "Arquivo muito grande. O limite é 20MB.";
  }
  return null;
}

async function enviarArquivoParaAnexos(file: File, criarUploadFn: (args: any) => Promise<any>) {
  const { path, token, nome, tipo } = await criarUploadFn({
    data: { nomeArquivo: file.name, tipoMime: file.type, tamanhoBytes: file.size },
  });
  const { error } = await supabase.storage.from("anexos").uploadToSignedUrl(path, token, file);
  if (error) throw error;
  return { path, nome, tipo };
}

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
  const cancelarFn = useServerFn(cancelarChamadoSuporte);
  const criarUploadFn = useServerFn(criarUploadAnexoChamado);
  const complementarFn = useServerFn(complementarChamadoSuporte);
  const mensagensFn = useServerFn(listarMensagensChamado);
  const urlAnexoFn = useServerFn(obterUrlAnexoChamado);

  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"elogio" | "reclamacao" | "sugestao">("sugestao");
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [arquivoNovo, setArquivoNovo] = useState<File | null>(null);
  const arquivoNovoRef = useRef<HTMLInputElement>(null);

  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [complemento, setComplemento] = useState("");
  const [arquivoComplemento, setArquivoComplemento] = useState<File | null>(null);
  const arquivoComplementoRef = useRef<HTMLInputElement>(null);

  const { data: meusChamados = [], isLoading } = useQuery({
    queryKey: ["meus-chamados"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];
      const { data, error } = await supabase
        .from("chamados_suporte" as any)
        .select(
          "id,protocolo,assunto,descricao,status,prioridade,resposta_admin,anexo_path,anexo_nome,anexo_tipo,criado_em,atualizado_em",
        )
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ["mensagens-chamado", expandidoId],
    enabled: !!expandidoId,
    queryFn: () => mensagensFn({ data: { chamadoId: expandidoId as string } }),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const anexo = arquivoNovo ? await enviarArquivoParaAnexos(arquivoNovo, criarUploadFn) : undefined;
      return enviarFn({ data: { assunto: assunto.trim(), descricao: descricao.trim(), prioridade, anexo } });
    },
    onSuccess: (res) => {
      setProtocolo(res.protocolo);
      setAssunto("");
      setDescricao("");
      setPrioridade("sugestao");
      setArquivoNovo(null);
      if (arquivoNovoRef.current) arquivoNovoRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["meus-chamados"] });
      toast.success("Chamado enviado com sucesso!");
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível enviar o chamado."),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Chamado cancelado.");
      qc.invalidateQueries({ queryKey: ["meus-chamados"] });
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível cancelar o chamado."),
  });

  const complementar = useMutation({
    mutationFn: async (chamadoId: string) => {
      const anexo = arquivoComplemento
        ? await enviarArquivoParaAnexos(arquivoComplemento, criarUploadFn)
        : undefined;
      return complementarFn({ data: { chamadoId, mensagem: complemento.trim() || undefined, anexo } });
    },
    onSuccess: (_res, chamadoId) => {
      toast.success("Complemento enviado.");
      setComplemento("");
      setArquivoComplemento(null);
      if (arquivoComplementoRef.current) arquivoComplementoRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["meus-chamados"] });
      qc.invalidateQueries({ queryKey: ["mensagens-chamado", chamadoId] });
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível enviar o complemento."),
  });

  async function abrirAnexo(chamadoId: string, path: string) {
    try {
      const { url } = await urlAnexoFn({ data: { chamadoId, path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível abrir o anexo.");
    }
  }

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
              Solicitações ao Suporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {protocolo && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700">
                <p className="font-semibold">Chamado enviado!</p>
                <p className="mt-1 font-mono text-xs">{protocolo}</p>
                <p className="mt-1 text-xs">Guarde este protocolo para acompanhar seu chamado.</p>
                <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setProtocolo(null)}>
                  Enviar nova solicitação
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
                <div className="space-y-1.5">
                  <Label>Anexo (opcional)</Label>
                  <input
                    ref={arquivoNovoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) return;
                      const erro = validarArquivoAnexo(file);
                      if (erro) {
                        toast.error(erro);
                        e.target.value = "";
                        return;
                      }
                      setArquivoNovo(file);
                    }}
                  />
                  {arquivoNovo ? (
                    <div className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{arquivoNovo.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-rose-600"
                        onClick={() => {
                          setArquivoNovo(null);
                          if (arquivoNovoRef.current) arquivoNovoRef.current.value = "";
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => arquivoNovoRef.current?.click()}
                    >
                      <Paperclip className="mr-1 size-3.5" /> Anexar imagem ou PDF
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Imagem (JPG, PNG, WEBP) ou PDF, até 20MB.
                  </p>
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
                    {c.anexo_path && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        onClick={() => abrirAnexo(c.id, c.anexo_path)}
                      >
                        <Paperclip className="size-3" /> {c.anexo_nome || "Anexo enviado"}
                      </button>
                    )}
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          const abrindo = expandidoId !== c.id;
                          setExpandidoId(abrindo ? c.id : null);
                          setComplemento("");
                          setArquivoComplemento(null);
                          if (arquivoComplementoRef.current) arquivoComplementoRef.current.value = "";
                        }}
                      >
                        <MessageSquarePlus className="mr-1 size-3.5" />
                        {expandidoId === c.id ? "Ocultar conversa" : "Ver conversa / complementar"}
                      </Button>
                      {c.status !== "cancelado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-rose-600 hover:text-rose-700"
                          disabled={cancelar.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Cancelar este chamado? Ele deixa de receber respostas, mas continua no seu histórico.",
                              )
                            ) {
                              cancelar.mutate(c.id);
                            }
                          }}
                        >
                          <Ban className="mr-1 size-3.5" /> Cancelar chamado
                        </Button>
                      )}
                    </div>

                    {expandidoId === c.id && (
                      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                        {(mensagens as any[]).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum complemento ainda.</p>
                        ) : (
                          <div className="max-h-56 space-y-2 overflow-y-auto">
                            {(mensagens as any[]).map((m) => (
                              <div key={m.id} className="rounded-lg border bg-background p-2 text-xs">
                                <p className="font-semibold">
                                  {m.autor_tipo === "admin" ? "Suporte" : "Você"} ·{" "}
                                  <span className="font-normal text-muted-foreground">
                                    {new Date(m.criado_em).toLocaleString("pt-BR")}
                                  </span>
                                </p>
                                {m.mensagem && <p className="mt-0.5">{m.mensagem}</p>}
                                {m.anexo_path && (
                                  <button
                                    type="button"
                                    className="mt-1 flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                                    onClick={() => abrirAnexo(c.id, m.anexo_path)}
                                  >
                                    <Paperclip className="size-3" /> {m.anexo_nome || "Anexo"}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {c.status === "cancelado" ? (
                          <p className="text-xs text-muted-foreground">
                            Chamado cancelado — não é possível complementar.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Escreva um complemento (opcional se for só anexar um arquivo)"
                              value={complemento}
                              onChange={(e) => setComplemento(e.target.value)}
                              rows={3}
                              maxLength={2000}
                              className="text-xs"
                            />
                            <input
                              ref={arquivoComplementoRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                if (!file) return;
                                const erro = validarArquivoAnexo(file);
                                if (erro) {
                                  toast.error(erro);
                                  e.target.value = "";
                                  return;
                                }
                                setArquivoComplemento(file);
                              }}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              {arquivoComplemento ? (
                                <div className="flex items-center gap-1 rounded border px-2 py-1 text-xs">
                                  <Paperclip className="size-3" />
                                  <span className="max-w-32 truncate">{arquivoComplemento.name}</span>
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-rose-600"
                                    onClick={() => {
                                      setArquivoComplemento(null);
                                      if (arquivoComplementoRef.current) arquivoComplementoRef.current.value = "";
                                    }}
                                  >
                                    <X className="size-3" />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => arquivoComplementoRef.current?.click()}
                                >
                                  <Paperclip className="mr-1 size-3.5" /> Anexar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={
                                  complementar.isPending || (!complemento.trim() && !arquivoComplemento)
                                }
                                onClick={() => complementar.mutate(c.id)}
                              >
                                <Send className="mr-1 size-3.5" />
                                {complementar.isPending ? "Enviando…" : "Enviar complemento"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
