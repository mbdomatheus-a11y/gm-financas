import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Car,
  ChevronDown,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { appSupabase } from "@/integrations/supabase/app-types";
import { useSession, usePermissoes } from "@/hooks/useAuthData";
import { useVeiculos } from "@/hooks/useFinance";
import { cn } from "@/lib/utils";
import { formatBRL, formatDate, toISODate } from "@/lib/format";
import { alertasDoVeiculo, type AlertaVeiculo } from "@/lib/veiculo-alertas";
import {
  labelTipoEvento,
  TIPOS_EVENTO_VEICULO,
  type TipoEventoVeiculo,
} from "@/lib/veiculo-eventos";

export const Route = createFileRoute("/_authenticated/veiculos")({
  head: () => ({
    meta: [
      { title: "Meu Veículo — Control ALL" },
      {
        name: "description",
        content:
          "Cadastro de veículos com alertas de troca de óleo, IPVA e seguro, e anexo de orçamentos.",
      },
      { property: "og:title", content: "Meu Veículo — Control ALL" },
      {
        property: "og:description",
        content: "Controle de veículos: documentos, KM, IPVA, seguro e revisões.",
      },
    ],
  }),
  component: VeiculosPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe um apelido para o veículo").max(80),
  placa: z.string().max(10).nullable(),
  chassi: z.string().max(40).nullable(),
  renavam: z.string().max(20).nullable(),
  marca: z.string().max(40).nullable(),
  modelo: z.string().max(60).nullable(),
  ano: z.number().int().nullable(),
  data_compra: z.string().nullable(),
  km_atual: z.number().int().nonnegative().nullable(),
  km_proxima_troca_oleo: z.number().int().nonnegative().nullable(),
  data_proxima_troca_oleo: z.string().nullable(),
  data_vencimento_ipva: z.string().nullable(),
  data_vencimento_seguro: z.string().nullable(),
  motorista_principal: z.string().max(80).nullable(),
  observacoes: z.string().max(500).nullable(),
});

const emptyForm = {
  nome: "",
  placa: "",
  chassi: "",
  renavam: "",
  marca: "",
  modelo: "",
  ano: "",
  data_compra: "",
  km_atual: "",
  km_proxima_troca_oleo: "",
  data_proxima_troca_oleo: "",
  data_vencimento_ipva: "",
  data_vencimento_seguro: "",
  motorista_principal: "",
  observacoes: "",
};

function urgenciaCor(a: AlertaVeiculo) {
  return a.urgencia === "critica" ? "text-destructive" : "text-warning";
}

const eventoSchema = z.object({
  tipo: z.string().min(1, "Selecione o tipo"),
  data: z.string().min(10, "Informe a data"),
  km: z.number().int().nonnegative().nullable(),
  custo: z.number().nonnegative().nullable(),
  descricao: z.string().max(300).nullable(),
});

const eventoFormVazio = {
  tipo: "troca_oleo" as TipoEventoVeiculo,
  data: toISODate(new Date()),
  km: "",
  custo: "",
  descricao: "",
};

function VeiculosPage() {
  const qc = useQueryClient();
  const { can } = usePermissoes();
  const { user } = useSession();
  const { data: veiculos = [] } = useVeiculos();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [enviandoDoc, setEnviandoDoc] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const [historicoAberto, setHistoricoAberto] = useState<Record<string, boolean>>({});
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<Record<string, string>>({});
  const [eventoVeiculoId, setEventoVeiculoId] = useState<string | null>(null);
  const [eventoForm, setEventoForm] = useState<any>(eventoFormVazio);

  function abrirNovo() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function abrirEdicao(v: any) {
    if (!can("veiculos", "editar")) return;
    setEditId(v.id);
    setForm({
      nome: v.nome ?? "",
      placa: v.placa ?? "",
      chassi: v.chassi ?? "",
      renavam: v.renavam ?? "",
      marca: v.marca ?? "",
      modelo: v.modelo ?? "",
      ano: v.ano != null ? String(v.ano) : "",
      data_compra: v.data_compra ?? "",
      km_atual: v.km_atual != null ? String(v.km_atual) : "",
      km_proxima_troca_oleo: v.km_proxima_troca_oleo != null ? String(v.km_proxima_troca_oleo) : "",
      data_proxima_troca_oleo: v.data_proxima_troca_oleo ?? "",
      data_vencimento_ipva: v.data_vencimento_ipva ?? "",
      data_vencimento_seguro: v.data_vencimento_seguro ?? "",
      motorista_principal: v.motorista_principal ?? "",
      observacoes: v.observacoes ?? "",
    });
    setOpen(true);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        nome: form.nome,
        placa: form.placa || null,
        chassi: form.chassi || null,
        renavam: form.renavam || null,
        marca: form.marca || null,
        modelo: form.modelo || null,
        ano: form.ano ? Number(form.ano) : null,
        data_compra: form.data_compra || null,
        km_atual: form.km_atual !== "" ? Number(form.km_atual) : null,
        km_proxima_troca_oleo:
          form.km_proxima_troca_oleo !== "" ? Number(form.km_proxima_troca_oleo) : null,
        data_proxima_troca_oleo: form.data_proxima_troca_oleo || null,
        data_vencimento_ipva: form.data_vencimento_ipva || null,
        data_vencimento_seguro: form.data_vencimento_seguro || null,
        motorista_principal: form.motorista_principal || null,
        observacoes: form.observacoes || null,
      });
      if (editId) {
        const { error } = await appSupabase.from("veiculos").update(parsed).eq("id", editId);
        if (error) throw error;
        return;
      }
      const { error } = await appSupabase
        .from("veiculos")
        .insert({ ...parsed, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Veículo atualizado" : "Veículo cadastrado");
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["veiculos"] });
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await appSupabase.from("veiculos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Veículo excluído");
      qc.invalidateQueries({ queryKey: ["veiculos"] });
    },
  });

  const excluirDocumento = useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      await supabase.storage.from("anexos").remove([doc.storage_path]);
      const { error } = await appSupabase.from("veiculo_documentos").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["veiculos"] });
    },
  });

  const salvarEvento = useMutation({
    mutationFn: async () => {
      if (!eventoVeiculoId) return;
      const parsed = eventoSchema.parse({
        tipo: eventoForm.tipo,
        data: eventoForm.data,
        km: eventoForm.km !== "" ? Number(eventoForm.km) : null,
        custo: eventoForm.custo !== "" ? Number(String(eventoForm.custo).replace(",", ".")) : null,
        descricao: eventoForm.descricao || null,
      });
      const { error } = await appSupabase.from("veiculo_eventos").insert({
        veiculo_id: eventoVeiculoId,
        ...parsed,
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      setEventoVeiculoId(null);
      setEventoForm(eventoFormVazio);
      qc.invalidateQueries({ queryKey: ["veiculos"] });
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message ?? "Erro ao salvar"),
  });

  const excluirEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await appSupabase.from("veiculo_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["veiculos"] });
    },
  });

  async function enviarDocumento(veiculoId: string, eventoId: string, file: File) {
    setEnviandoDoc(eventoId);
    try {
      if (
        file.size > 10 * 1024 * 1024 ||
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)
      ) {
        throw new Error("Envie PDF ou imagem de até 10 MB.");
      }
      const path = `veiculos/${veiculoId}/eventos/${eventoId}/${crypto.randomUUID()}-${file.name.replace(/[\\/\r\n]/g, "_")}`;
      const up = await supabase.storage.from("anexos").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await appSupabase.from("veiculo_documentos").insert({
        veiculo_id: veiculoId,
        evento_id: eventoId,
        nome: file.name,
        storage_path: path,
        tipo: "orcamento",
        criado_por: user?.id ?? null,
      });
      if (error) {
        await supabase.storage.from("anexos").remove([path]);
        throw error;
      }
      toast.success("Orçamento anexado");
      qc.invalidateQueries({ queryKey: ["veiculos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível anexar o arquivo");
    } finally {
      setEnviandoDoc(null);
    }
  }

  async function abrirDocumento(storagePath: string) {
    const { data, error } = await supabase.storage
      .from("anexos")
      .createSignedUrl(storagePath, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o documento");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <AppLayout
      title="Meu Veículo"
      description="Documentos, quilometragem e alertas de IPVA, seguro e revisão"
      actions={
        can("veiculos", "editar") && (
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="size-4" /> Novo veículo
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {veiculos.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Car className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>
            </CardContent>
          </Card>
        )}
        {veiculos.map((v: any) => {
          const alertas = alertasDoVeiculo(v);
          const documentos = (v.veiculo_documentos ?? []) as any[];
          return (
            <Card key={v.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Car className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[v.marca, v.modelo, v.ano].filter(Boolean).join(" ")}
                      {v.placa ? ` · placa ${v.placa}` : ""}
                      {v.motorista_principal ? ` · ${v.motorista_principal}` : ""}
                    </p>
                    {v.km_atual != null && (
                      <p className="text-xs text-muted-foreground">
                        {Number(v.km_atual).toLocaleString("pt-BR")} km
                      </p>
                    )}
                  </div>
                  {can("veiculos", "editar") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => abrirEdicao(v)}
                      aria-label="Editar veículo"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {can("veiculos", "excluir") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => excluir.mutate(v.id)}
                      aria-label="Excluir veículo"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>

                {alertas.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/5 p-2">
                    {alertas.map((a, i) => (
                      <p key={i} className={`flex items-center gap-1.5 text-xs ${urgenciaCor(a)}`}>
                        <AlertTriangle className="size-3.5 shrink-0" /> {a.mensagem}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {v.data_vencimento_ipva && (
                    <Badge variant="secondary">IPVA {formatDate(v.data_vencimento_ipva)}</Badge>
                  )}
                  {v.data_vencimento_seguro && (
                    <Badge variant="secondary">Seguro {formatDate(v.data_vencimento_seguro)}</Badge>
                  )}
                  {documentos
                    .filter((d) => !d.evento_id)
                    .map((d) => (
                      <Badge
                        key={d.id}
                        variant="outline"
                        className="cursor-pointer gap-1"
                        onClick={() => abrirDocumento(d.storage_path)}
                      >
                        <FileText className="size-3" /> {d.nome}
                        {can("veiculos", "excluir") && (
                          <Trash2
                            className="size-3 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              excluirDocumento.mutate(d);
                            }}
                          />
                        )}
                      </Badge>
                    ))}
                </div>

                {(() => {
                  const eventos = ((v.veiculo_eventos ?? []) as any[]).sort((a, b) =>
                    a.data < b.data ? 1 : -1,
                  );
                  const filtro = filtroTipoEvento[v.id] ?? "todos";
                  const eventosFiltrados =
                    filtro === "todos" ? eventos : eventos.filter((e) => e.tipo === filtro);
                  const aberto = !!historicoAberto[v.id];
                  return (
                    <div className="border-t pt-3">
                      <button
                        type="button"
                        onClick={() => setHistoricoAberto((s) => ({ ...s, [v.id]: !aberto }))}
                        className="flex w-full items-center gap-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <Wrench className="size-3.5" />
                        Histórico de manutenção ({eventos.length})
                        <ChevronDown
                          className={cn(
                            "ml-auto size-3.5 transition-transform",
                            aberto && "rotate-180",
                          )}
                        />
                      </button>
                      {aberto && (
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={filtro}
                              onValueChange={(val) =>
                                setFiltroTipoEvento((s) => ({ ...s, [v.id]: val }))
                              }
                            >
                              <SelectTrigger className="h-8 w-auto text-xs">
                                <SelectValue placeholder="Filtrar por tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todos">Todos os tipos</SelectItem>
                                {TIPOS_EVENTO_VEICULO.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {can("veiculos", "editar") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setEventoVeiculoId(v.id);
                                  setEventoForm(eventoFormVazio);
                                }}
                              >
                                <Plus className="size-3.5" /> Novo evento
                              </Button>
                            )}
                          </div>
                          {eventosFiltrados.length === 0 ? (
                            <p className="px-1 text-xs text-muted-foreground">
                              Nenhum evento{filtro !== "todos" ? " desse tipo" : ""} registrado.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {eventosFiltrados.map((e: any) => (
                                <div
                                  key={e.id}
                                  className="flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                      {labelTipoEvento(e.tipo)}{" "}
                                      <span className="font-normal text-muted-foreground">
                                        · {formatDate(e.data)}
                                        {e.km != null
                                          ? ` · ${Number(e.km).toLocaleString("pt-BR")} km`
                                          : ""}
                                        {e.custo != null ? ` · ${formatBRL(Number(e.custo))}` : ""}
                                      </span>
                                    </p>
                                    {e.descricao && (
                                      <p className="text-muted-foreground">{e.descricao}</p>
                                    )}
                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                      {documentos
                                        .filter((doc) => doc.evento_id === e.id)
                                        .map((doc) => (
                                          <Badge
                                            key={doc.id}
                                            variant="outline"
                                            className="cursor-pointer gap-1"
                                            onClick={() => abrirDocumento(doc.storage_path)}
                                          >
                                            <FileText className="size-3" /> {doc.nome}
                                            {can("veiculos", "excluir") && (
                                              <Trash2
                                                className="size-3"
                                                onClick={(click) => {
                                                  click.stopPropagation();
                                                  excluirDocumento.mutate(doc);
                                                }}
                                              />
                                            )}
                                          </Badge>
                                        ))}
                                      {can("veiculos", "editar") && (
                                        <>
                                          <input
                                            ref={(el) => {
                                              fileInputs.current[e.id] = el;
                                            }}
                                            type="file"
                                            accept=".pdf,image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            onChange={(change) => {
                                              const file = change.target.files?.[0];
                                              if (file) void enviarDocumento(v.id, e.id, file);
                                              change.target.value = "";
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-xs"
                                            disabled={enviandoDoc === e.id}
                                            onClick={() => fileInputs.current[e.id]?.click()}
                                          >
                                            {enviandoDoc === e.id ? (
                                              <Loader2 className="size-3 animate-spin" />
                                            ) : (
                                              <Paperclip className="size-3" />
                                            )}{" "}
                                            Anexar orçamento
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {can("veiculos", "excluir") && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => excluirEvento.mutate(e.id)}
                                      aria-label="Excluir evento"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditId(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar veículo" : "Novo veículo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Apelido do veículo" className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Carro do Guilherme"
              />
            </Field>
            <Field label="Marca">
              <Input
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
              />
            </Field>
            <Field label="Modelo">
              <Input
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              />
            </Field>
            <Field label="Ano">
              <Input
                inputMode="numeric"
                value={form.ano}
                onChange={(e) => setForm({ ...form, ano: e.target.value })}
              />
            </Field>
            <Field label="Placa">
              <Input
                value={form.placa}
                onChange={(e) => setForm({ ...form, placa: e.target.value })}
              />
            </Field>
            <Field label="Chassi (opcional)">
              <Input
                value={form.chassi}
                onChange={(e) => setForm({ ...form, chassi: e.target.value })}
              />
            </Field>
            <Field label="Renavam">
              <Input
                value={form.renavam}
                onChange={(e) => setForm({ ...form, renavam: e.target.value })}
              />
            </Field>
            <Field label="Data da compra">
              <Input
                type="date"
                value={form.data_compra}
                onChange={(e) => setForm({ ...form, data_compra: e.target.value })}
              />
            </Field>
            <Field label="Motorista principal">
              <Input
                value={form.motorista_principal}
                onChange={(e) => setForm({ ...form, motorista_principal: e.target.value })}
              />
            </Field>
            <Field label="KM atual">
              <Input
                inputMode="numeric"
                value={form.km_atual}
                onChange={(e) => setForm({ ...form, km_atual: e.target.value })}
              />
            </Field>
            <Field label="KM da próxima troca de óleo">
              <Input
                inputMode="numeric"
                value={form.km_proxima_troca_oleo}
                onChange={(e) => setForm({ ...form, km_proxima_troca_oleo: e.target.value })}
              />
            </Field>
            <Field label="Data da próxima troca de óleo">
              <Input
                type="date"
                value={form.data_proxima_troca_oleo}
                onChange={(e) => setForm({ ...form, data_proxima_troca_oleo: e.target.value })}
              />
            </Field>
            <Field label="Vencimento do IPVA">
              <Input
                type="date"
                value={form.data_vencimento_ipva}
                onChange={(e) => setForm({ ...form, data_vencimento_ipva: e.target.value })}
              />
            </Field>
            <Field label="Vencimento do seguro">
              <Input
                type="date"
                value={form.data_vencimento_seguro}
                onChange={(e) => setForm({ ...form, data_vencimento_seguro: e.target.value })}
              />
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {editId ? "Salvar alterações" : "Salvar veículo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!eventoVeiculoId}
        onOpenChange={(o) => {
          if (!o) {
            setEventoVeiculoId(null);
            setEventoForm(eventoFormVazio);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo evento de manutenção</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" className="sm:col-span-2">
              <Select
                value={eventoForm.tipo}
                onValueChange={(v) => setEventoForm({ ...eventoForm, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EVENTO_VEICULO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <Input
                type="date"
                value={eventoForm.data}
                onChange={(e) => setEventoForm({ ...eventoForm, data: e.target.value })}
              />
            </Field>
            <Field label="KM (opcional)">
              <Input
                inputMode="numeric"
                value={eventoForm.km}
                onChange={(e) => setEventoForm({ ...eventoForm, km: e.target.value })}
              />
            </Field>
            <Field label="Custo (opcional)" className="sm:col-span-2">
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={eventoForm.custo}
                onChange={(e) => setEventoForm({ ...eventoForm, custo: e.target.value })}
              />
            </Field>
            <Field label="Descrição (opcional)" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={eventoForm.descricao}
                onChange={(e) => setEventoForm({ ...eventoForm, descricao: e.target.value })}
                placeholder="Ex.: Óleo 5W30 + filtro, oficina do Zé"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => salvarEvento.mutate()} disabled={salvarEvento.isPending}>
              Salvar evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
