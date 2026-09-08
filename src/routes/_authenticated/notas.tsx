import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  Copy,
  ExternalLink,
  HardDrive,
  Image as ImageIcon,
  Plus,
  QrCode,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { LeitorNota } from "@/components/LeitorNota";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate, toISODate } from "@/lib/format";
import {
  PRAZOS_GARANTIA,
  calcularFimGarantia,
  chaveValida,
  dadosDaChave,
  diasRestantes,
  formatarChave,
  linkConsulta,
  statusGarantia,
} from "@/lib/nfe";
import {
  completeDriveConnection,
  disconnectDrive,
  driveStatus,
  getPastaDrive,
  setPastaDrive,
  startDriveConnect,
  uploadNotaArquivo,
} from "@/lib/drive.functions";
import { consultarNota } from "@/lib/nfe.functions";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Notas fiscais e garantias — Finanças do Casal" },
      {
        name: "description",
        content:
          "Guarde comprovantes por foto ou leitura do QR Code da nota, com chave de acesso, itens e alerta de fim da garantia.",
      },
      { property: "og:title", content: "Notas fiscais e garantias — Finanças do Casal" },
      {
        property: "og:description",
        content: "Comprovantes no Google Drive, chave de acesso e aviso antes da garantia expirar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotasPage,
});

const CATEGORIAS = [
  "eletronicos",
  "eletrodomesticos",
  "moveis",
  "vestuario",
  "servicos",
  "alimentacao",
  "outros",
];

type Filtro = "todas" | "ativa" | "expirando" | "expirada";

type NotaForm = {
  estabelecimento: string;
  descricao: string;
  data_compra: string;
  valor_total: string;
  categoria: string;
  garantia_meses: string;
  observacoes: string;
  chave_acesso: string;
  url_consulta: string;
  uf: string;
  status_captura: string;
};

const FORM_VAZIO: NotaForm = {
  estabelecimento: "",
  descricao: "",
  data_compra: toISODate(new Date()),
  valor_total: "",
  categoria: "outros",
  garantia_meses: "12",
  observacoes: "",
  chave_acesso: "",
  url_consulta: "",
  uf: "",
  status_captura: "manual",
};

function useNotas() {
  return useQuery({
    queryKey: ["notas-fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, nota_itens(*), nota_arquivos(*)")
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function SeloGarantia({ fim }: { fim: string | null }) {
  const status = statusGarantia(fim);
  const dias = diasRestantes(fim);
  if (status === "sem") return <Badge variant="secondary">Sem garantia</Badge>;
  if (status === "expirada")
    return <Badge variant="destructive">Garantia expirada em {formatDate(fim!)}</Badge>;
  const tom =
    status === "critica"
      ? "bg-destructive/10 text-destructive"
      : status === "atencao"
        ? "bg-warning/15 text-warning-foreground"
        : "bg-primary/10 text-primary";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tom}`}>
      Garantia até {formatDate(fim!)} · {dias} dia{dias === 1 ? "" : "s"}
    </span>
  );
}

function NotasPage() {
  const qc = useQueryClient();
  const { data: notas = [], isLoading } = useNotas();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [escolha, setEscolha] = useState(false);
  const [leitor, setLeitor] = useState(false);
  const [form, setForm] = useState<NotaForm | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [itensLidos, setItensLidos] = useState<
    { descricao: string; quantidade: number; valor_unitario: number; valor_total: number }[]
  >([]);
  const [fotosPendentes, setFotosPendentes] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const notaAlvoUpload = useRef<string | null>(null);

  const status = useServerFn(driveStatus);
  const iniciarConexao = useServerFn(startDriveConnect);
  const concluirConexao = useServerFn(completeDriveConnection);
  const desconectar = useServerFn(disconnectDrive);
  const enviarArquivo = useServerFn(uploadNotaArquivo);
  const consultar = useServerFn(consultarNota);

  const drive = useQuery({ queryKey: ["drive-status"], queryFn: () => status({}) });

  const lerPasta = useServerFn(getPastaDrive);
  const gravarPasta = useServerFn(setPastaDrive);
  const pasta = useQuery({ queryKey: ["drive-pasta"], queryFn: () => lerPasta({}) });
  const [pastaInput, setPastaInput] = useState("");
  useEffect(() => {
    if (pasta.data?.folderId) setPastaInput(pasta.data.folderId);
  }, [pasta.data?.folderId]);
  const salvarPasta = useMutation({
    mutationFn: () => gravarPasta({ data: { valor: pastaInput } }),
    onSuccess: () => {
      toast.success("Pasta compartilhada salva.");
      void qc.invalidateQueries({ queryKey: ["drive-pasta"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não consegui salvar a pasta."),
  });

  const conectar = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "lovable-oauth", "width=600,height=720");
      if (!popup) throw new Error("Permita pop-ups para conectar o Google Drive.");
      let code: string | null = null;
      try {
        const { authorizationUrl } = await iniciarConexao({});
        const completion = new Promise<string | null>((resolve, reject) => {
          let poll: number | undefined;
          const cleanup = () => {
            window.removeEventListener("message", onMessage);
            if (poll !== undefined) window.clearInterval(poll);
          };
          const onMessage = (event: MessageEvent) => {
            const tipo = (event.data as { type?: string })?.type;
            if (
              event.origin !== window.location.origin ||
              event.source !== popup ||
              (event.data as { connectorId?: string })?.connectorId !== "google_drive" ||
              (tipo !== "appUserConnectorOAuthComplete" && tipo !== "appUserConnectorOAuthFailed")
            )
              return;
            cleanup();
            if (tipo === "appUserConnectorOAuthComplete") {
              const c = (event.data as { code?: string | null })?.code;
              resolve(typeof c === "string" ? c : null);
              return;
            }
            popup.close();
            const detalhe = (event.data as { error?: string | null })?.error;
            reject(
              new Error(
                detalhe
                  ? `Google Drive: ${detalhe}`
                  : "Conexão com o Google Drive não concluída.",
              ),
            );
          };
          window.addEventListener("message", onMessage);
          poll = window.setInterval(() => {
            if (!popup.closed) return;
            cleanup();
            reject(
              new Error(
                "A janela do Google foi fechada antes de concluir. Se o Google mostrou um erro, verifique se a sua conta está liberada no app e tente novamente.",
              ),
            );
          }, 500);

        });
        popup.location.href = authorizationUrl;
        code = await completion;
      } catch (e) {
        popup.close();
        throw e;
      }
      if (code) await concluirConexao({ data: { code } });
    },
    onSuccess: () => {
      toast.success("Google Drive conectado.");
      void qc.invalidateQueries({ queryKey: ["drive-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvar = useMutation({
    mutationFn: async (dados: NotaForm) => {
      const meses = Number(dados.garantia_meses) || 0;
      const payload = {
        estabelecimento: dados.estabelecimento || null,
        descricao: dados.descricao || null,
        data_compra: dados.data_compra,
        valor_total: Number(dados.valor_total.replace(",", ".")) || 0,
        categoria: dados.categoria,
        garantia_meses: meses || null,
        garantia_fim: calcularFimGarantia(dados.data_compra, meses),
        observacoes: dados.observacoes || null,
        chave_acesso: dados.chave_acesso || null,
        url_consulta: dados.url_consulta || null,
        uf: dados.uf || null,
        status_captura: dados.status_captura,
      };

      let notaId = editandoId;
      if (notaId) {
        const { error } = await supabase.from("notas_fiscais").update(payload).eq("id", notaId);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("notas_fiscais")
          .insert({ ...payload, created_by: user.user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        notaId = data.id;
        if (itensLidos.length) {
          await supabase
            .from("nota_itens")
            .insert(itensLidos.map((i) => ({ ...i, nota_id: notaId! })));
        }
      }

      if (fotosPendentes.length) {
        if (!drive.data?.connected) {
          toast.warning("Conecte o Google Drive para guardar as fotos.");
        } else {
          const competencia = dados.data_compra.slice(0, 7);
          for (const file of fotosPendentes) {
            const base64 = await fileParaBase64(file);
            await enviarArquivo({
              data: {
                notaId: notaId!,
                nome: file.name || `nota-${Date.now()}.jpg`,
                mimeType: file.type || "image/jpeg",
                base64,
                competencia,
              },
            });
          }
        }
      }
      return notaId!;
    },
    onSuccess: () => {
      toast.success("Nota salva.");
      setForm(null);
      setEditandoId(null);
      setItensLidos([]);
      setFotosPendentes([]);
      void qc.invalidateQueries({ queryKey: ["notas-fiscais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota excluída.");
      setDetalhe(null);
      void qc.invalidateQueries({ queryKey: ["notas-fiscais"] });
    },
  });

  const anexar = useMutation({
    mutationFn: async ({ notaId, files }: { notaId: string; files: File[] }) => {
      const nota = notas.find((n) => n.id === notaId);
      const competencia = (nota?.data_compra ?? toISODate(new Date())).slice(0, 7);
      for (const file of files) {
        const base64 = await fileParaBase64(file);
        await enviarArquivo({
          data: {
            notaId,
            nome: file.name || `nota-${Date.now()}.jpg`,
            mimeType: file.type || "image/jpeg",
            base64,
            competencia,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Foto enviada para o seu Google Drive.");
      void qc.invalidateQueries({ queryKey: ["notas-fiscais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function aoLerCodigo({ chave, texto }: { chave: string; texto: string }) {
    setLeitor(false);
    if (!chaveValida(chave)) toast.warning("A chave lida não passou na validação; confira os dados.");
    const dados = dadosDaChave(chave);
    const base: NotaForm = {
      ...FORM_VAZIO,
      chave_acesso: chave,
      url_consulta: /^https?:/i.test(texto) ? texto : linkConsulta(chave),
      uf: dados?.uf ?? "",
      data_compra: dados?.emissao ?? FORM_VAZIO.data_compra,
    };
    setForm(base);
    setEditandoId(null);
    setItensLidos([]);

    try {
      const r = await consultar({ data: { url: base.url_consulta } });
      if (r.status === "auto") {
        setForm((f) =>
          f
            ? {
                ...f,
                estabelecimento: r.estabelecimento ?? f.estabelecimento,
                valor_total: r.valor_total !== null ? String(r.valor_total) : f.valor_total,
                data_compra: r.data_compra ?? f.data_compra,
                status_captura: "auto",
              }
            : f,
        );
        setItensLidos(r.itens);
        toast.success("Dados da nota obtidos automaticamente.");
      } else {
        toast.info(r.motivo ?? "Preencha os dados manualmente.");
      }
    } catch {
      toast.info("Não deu para consultar a nota agora; preencha manualmente.");
    }
  }

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return notas.filter((n) => {
      const st = statusGarantia(n.garantia_fim);
      if (filtro === "ativa" && (st === "expirada" || st === "sem")) return false;
      if (filtro === "expirada" && st !== "expirada") return false;
      if (filtro === "expirando" && st !== "critica" && st !== "atencao") return false;
      if (!termo) return true;
      return [n.estabelecimento, n.descricao, n.chave_acesso]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo));
    });
  }, [notas, filtro, busca]);

  const aVencer = notas.filter((n) => {
    const st = statusGarantia(n.garantia_fim);
    return st === "critica" || st === "atencao";
  });

  const notaDetalhe = notas.find((n) => n.id === detalhe) ?? null;

  return (
    <AppLayout
      title="Notas fiscais"
      description="Comprovantes, chave de acesso e controle de garantia"
      actions={
        <Button size="sm" className="gap-2" onClick={() => setEscolha(true)}>
          <Plus className="size-4" /> Nova nota
        </Button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          const alvo = notaAlvoUpload.current;
          notaAlvoUpload.current = null;
          if (alvo) anexar.mutate({ notaId: alvo, files });
          else {
            setFotosPendentes(files);
            setForm({ ...FORM_VAZIO });
            setEditandoId(null);
          }
        }}
      />

      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                <HardDrive className="size-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Google Drive</p>
                <p className="text-xs text-muted-foreground">
                  {drive.data?.connected
                    ? pasta.data?.folderId
                      ? "Conectado — comprovantes vão para a pasta compartilhada do casal"
                      : "Conectado — informe abaixo a pasta compartilhada do casal"
                    : "Conecte para guardar as fotos das notas na sua conta"}
                </p>
              </div>
            </div>
            {drive.data?.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  desconectar({}).then(() => {
                    toast.success("Google Drive desconectado.");
                    void qc.invalidateQueries({ queryKey: ["drive-status"] });
                  })
                }
              >
                Desconectar
              </Button>
            ) : (
              <Button size="sm" onClick={() => conectar.mutate()} disabled={conectar.isPending}>
                {conectar.isPending ? "Conectando…" : "Conectar Google Drive"}
              </Button>
            )}
          </CardContent>
        </Card>

        {aVencer.length > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="mt-0.5 size-4.5 text-warning" />
              <div className="text-sm">
                <p className="font-medium">
                  {aVencer.length} garantia{aVencer.length > 1 ? "s" : ""} vencendo em até 30 dias
                </p>
                <p className="text-xs text-muted-foreground">
                  {aVencer
                    .slice(0, 3)
                    .map((n) => `${n.estabelecimento ?? n.descricao ?? "Nota"} (${diasRestantes(n.garantia_fim)}d)`)
                    .join(" · ")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por loja, descrição ou chave"
            className="h-9 max-w-xs"
          />
          {(
            [
              ["todas", "Todas"],
              ["ativa", "Garantia ativa"],
              ["expirando", "Vencendo em 30 dias"],
              ["expirada", "Expiradas"],
            ] as [Filtro, string][]
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={filtro === id ? "default" : "outline"}
              onClick={() => setFiltro(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma nota por aqui ainda. Toque em “Nova nota” para começar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((n) => {
              const foto = (n.nota_arquivos ?? [])[0];
              return (
                <Card
                  key={n.id}
                  className="cursor-pointer transition-colors hover:border-primary/50"
                  onClick={() => setDetalhe(n.id)}
                >
                  <CardContent className="flex gap-3 py-4">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                      {foto?.thumbnail_link ? (
                        <img
                          src={foto.thumbnail_link}
                          alt={`Comprovante de ${n.estabelecimento ?? "nota fiscal"}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold">
                        {n.estabelecimento || n.descricao || "Nota fiscal"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(n.data_compra)} · {formatBRL(Number(n.valor_total))}
                      </p>
                      <SeloGarantia fim={n.garantia_fim} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Escolha foto x leitura */}
      <Dialog open={escolha} onOpenChange={setEscolha}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova nota</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 py-4"
              onClick={() => {
                setEscolha(false);
                notaAlvoUpload.current = null;
                fileRef.current?.click();
              }}
            >
              <Camera className="size-5 text-primary" />
              <span className="text-left">
                <span className="block text-sm font-semibold">Foto do comprovante</span>
                <span className="block text-xs text-muted-foreground">Câmera ou arquivo</span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 py-4"
              onClick={() => {
                setEscolha(false);
                setLeitor(true);
              }}
            >
              <QrCode className="size-5 text-primary" />
              <span className="text-left">
                <span className="block text-sm font-semibold">Ler nota (QR / código de barras)</span>
                <span className="block text-xs text-muted-foreground">Captura a chave de acesso</span>
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEscolha(false);
                setForm({ ...FORM_VAZIO });
                setEditandoId(null);
              }}
            >
              Preencher manualmente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LeitorNota open={leitor} onOpenChange={setLeitor} onLido={aoLerCodigo} />

      {/* Formulário */}
      <Dialog
        open={!!form}
        onOpenChange={(v) => {
          if (!v) {
            setForm(null);
            setEditandoId(null);
            setFotosPendentes([]);
            setItensLidos([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar nota" : "Nova nota"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              {form.chave_acesso && (
                <div className="rounded-xl border bg-muted/40 p-3 text-xs">
                  <p className="font-medium">Chave de acesso</p>
                  <p className="break-all text-muted-foreground">{formatarChave(form.chave_acesso)}</p>
                  <p className="mt-1 text-muted-foreground">
                    {form.status_captura === "auto"
                      ? "Dados obtidos automaticamente"
                      : "Preencher manualmente"}
                  </p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Estabelecimento</Label>
                  <Input
                    value={form.estabelecimento}
                    onChange={(e) => setForm({ ...form, estabelecimento: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data da compra</Label>
                  <Input
                    type="date"
                    value={form.data_compra}
                    onChange={(e) => setForm({ ...form, data_compra: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor</Label>
                  <Input
                    inputMode="decimal"
                    value={form.valor_total}
                    onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select
                    value={form.categoria}
                    onValueChange={(v) => setForm({ ...form, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Garantia</Label>
                  <Select
                    value={form.garantia_meses}
                    onValueChange={(v) => setForm({ ...form, garantia_meses: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRAZOS_GARANTIA.map((p) => (
                        <SelectItem key={p.meses} value={String(p.meses)}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fim da garantia</Label>
                  <Input
                    readOnly
                    value={
                      calcularFimGarantia(form.data_compra, Number(form.garantia_meses) || 0)
                        ? formatDate(
                            calcularFimGarantia(form.data_compra, Number(form.garantia_meses) || 0)!,
                          )
                        : "—"
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>

              {itensLidos.length > 0 && (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-medium">{itensLidos.length} itens lidos da nota</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {itensLidos.map((i, idx) => (
                      <li key={idx} className="flex justify-between gap-3">
                        <span className="truncate">
                          {i.quantidade}x {i.descricao}
                        </span>
                        <span>{formatBRL(i.valor_total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fotosPendentes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {fotosPendentes.length} arquivo(s) serão enviados ao seu Google Drive ao salvar.
                </p>
              )}

              <Button
                className="w-full"
                onClick={() => salvar.mutate(form)}
                disabled={salvar.isPending}
              >
                {salvar.isPending ? "Salvando…" : "Salvar nota"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!notaDetalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {notaDetalhe && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {notaDetalhe.estabelecimento || notaDetalhe.descricao || "Nota fiscal"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">{formatDate(notaDetalhe.data_compra)}</Badge>
                  <Badge variant="secondary">{formatBRL(Number(notaDetalhe.valor_total))}</Badge>
                  <SeloGarantia fim={notaDetalhe.garantia_fim} />
                </div>

                {notaDetalhe.chave_acesso && (
                  <div className="rounded-xl border p-3 text-xs">
                    <p className="mb-1 font-medium">Chave de acesso</p>
                    <p className="break-all text-muted-foreground">
                      {formatarChave(notaDetalhe.chave_acesso)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          void navigator.clipboard.writeText(notaDetalhe.chave_acesso!);
                          toast.success("Chave copiada.");
                        }}
                      >
                        <Copy className="size-3.5" /> Copiar
                      </Button>
                      <a
                        href={notaDetalhe.url_consulta ?? linkConsulta(notaDetalhe.chave_acesso)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="outline" className="gap-1">
                          <ExternalLink className="size-3.5" /> Consultar
                        </Button>
                      </a>
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-medium">Comprovantes</p>
                  <div className="flex flex-wrap gap-2">
                    {(notaDetalhe.nota_arquivos ?? []).map((a) => (
                      <a
                        key={a.id}
                        href={a.link ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="size-20 overflow-hidden rounded-xl border bg-muted"
                      >
                        {a.thumbnail_link ? (
                          <img
                            src={a.thumbnail_link}
                            alt={a.nome ?? "Comprovante"}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                            {a.nome ?? "arquivo"}
                          </span>
                        )}
                      </a>
                    ))}
                    <Button
                      variant="outline"
                      className="size-20 flex-col gap-1 text-[11px]"
                      disabled={anexar.isPending}
                      onClick={() => {
                        if (!drive.data?.connected) {
                          toast.warning("Conecte o Google Drive primeiro.");
                          return;
                        }
                        notaAlvoUpload.current = notaDetalhe.id;
                        fileRef.current?.click();
                      }}
                    >
                      <Upload className="size-4" /> Adicionar
                    </Button>
                  </div>
                </div>

                {(notaDetalhe.nota_itens ?? []).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium">Itens</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {(notaDetalhe.nota_itens ?? []).map((i) => (
                        <li key={i.id} className="flex justify-between gap-3">
                          <span className="truncate">
                            {Number(i.quantidade)}x {i.descricao}
                          </span>
                          <span>{formatBRL(Number(i.valor_total))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {notaDetalhe.observacoes && (
                  <p className="text-xs text-muted-foreground">{notaDetalhe.observacoes}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      setDetalhe(null);
                      setEditandoId(notaDetalhe.id);
                      setForm({
                        estabelecimento: notaDetalhe.estabelecimento ?? "",
                        descricao: notaDetalhe.descricao ?? "",
                        data_compra: notaDetalhe.data_compra,
                        valor_total: String(notaDetalhe.valor_total ?? ""),
                        categoria: notaDetalhe.categoria ?? "outros",
                        garantia_meses: String(notaDetalhe.garantia_meses ?? 0),
                        observacoes: notaDetalhe.observacoes ?? "",
                        chave_acesso: notaDetalhe.chave_acesso ?? "",
                        url_consulta: notaDetalhe.url_consulta ?? "",
                        uf: notaDetalhe.uf ?? "",
                        status_captura: notaDetalhe.status_captura ?? "manual",
                      });
                    }}
                  >
                    <ShieldCheck className="size-4" /> Editar
                  </Button>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => excluir.mutate(notaDetalhe.id)}
                  >
                    <Trash2 className="size-4" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function fileParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
