import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import { useBancos, useCartoes, useCategorias, useProfilesList } from "@/hooks/useFinance";
import { formatBRL, formatDate } from "@/lib/format";
import {
  BANCO_LABEL,
  dedupKey,
  processarFatura,
  vencimentoParcela,
  type BancoFatura,
  type FaturaExtraida,
  type LancamentoExtraido,
} from "@/lib/faturas";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar Faturas — Finanças do Casal" },
      {
        name: "description",
        content:
          "Importe faturas em PDF de Itaú, Nubank, Pernambucanas e Santander, revise os lançamentos e confirme para lançar nas despesas.",
      },
      { property: "og:title", content: "Importar Faturas — Finanças do Casal" },
      {
        property: "og:description",
        content: "Leitura de faturas em PDF com prévia editável, parcelamento e deduplicação.",
      },
    ],
  }),
  component: ImportarPage,
});

const BANCOS: BancoFatura[] = ["itau", "nubank", "pernambucanas", "santander", "desconhecido"];

type FaturaItem = FaturaExtraida & { arquivo: File; duplicada?: boolean; destino?: string };

/** Normaliza nomes para comparar "Itaú" com "itau", "Banco Santander" com "santander" etc. */
function chaveNome(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function ImportarPage() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profiles = [] } = useProfilesList();
  const { data: categorias = [] } = useCategorias("despesa");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const inputRef = useRef<HTMLInputElement>(null);

  const [lendo, setLendo] = useState(false);
  const [faturas, setFaturas] = useState<FaturaItem[]>([]);

  /** Cartão cadastrado com o final informado (preferindo o mesmo banco da fatura). */
  function acharCartao(banco: BancoFatura, final: string | null) {
    if (!final) return null;
    const doBanco = (cartoes as any[]).filter(
      (c) =>
        c.final === final &&
        (!c.bancos?.nome || chaveNome(c.bancos.nome) === chaveNome(BANCO_LABEL[banco])),
    );
    const qualquer = (cartoes as any[]).filter((c) => c.final === final);
    return doBanco[0] ?? qualquer[0] ?? null;
  }

  /** Destino padrão da fatura: cartão do banco (por final) ou conta bancária de mesmo nome. */
  function destinoPadrao(f: FaturaExtraida): string {
    const nome = chaveNome(BANCO_LABEL[f.banco]);
    for (const final of f.finais) {
      const c = acharCartao(f.banco, final);
      if (c) return `cartao:${c.id}`;
    }
    const cartaoBanco = (cartoes as any[]).find(
      (c) => c.bancos?.nome && chaveNome(c.bancos.nome) === nome,
    );
    if (cartaoBanco) return `cartao:${cartaoBanco.id}`;
    const banco = (bancos as any[]).find((b) => chaveNome(b.nome) === nome);
    return banco ? `banco:${banco.id}` : "";
  }


  const totais = useMemo(() => {
    const lanc = faturas.flatMap((f) => f.lancamentos.filter((l) => l.incluir));
    return {
      arquivos: faturas.length,
      linhas: lanc.length,
      valor: lanc.reduce((s, l) => s + (l.direcao === "credito" ? -l.valor : l.valor), 0),
    };
  }, [faturas]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setLendo(true);
    try {
      const novos: FaturaItem[] = [];
      for (const file of Array.from(files)) {
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
          toast.error(`${file.name}: apenas PDF é aceito.`);
          continue;
        }
        try {
          const extraida = await processarFatura(file);
          const { data: jaExiste } = await supabase
            .from("import_faturas")
            .select("id")
            .eq("arquivo_hash", extraida.arquivo_hash)
            .maybeSingle();
          novos.push({
            ...extraida,
            arquivo: file,
            duplicada: !!jaExiste,
            destino: destinoPadrao(extraida),
          });

        } catch {
          toast.error(`${file.name}: não consegui ler o PDF (pode ser digitalizado).`);
        }
      }
      setFaturas((prev) => [...prev, ...novos]);
      if (novos.length) toast.success(`${novos.length} fatura(s) lida(s).`);
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function atualizarFatura(idx: number, patch: Partial<FaturaItem>) {
    setFaturas((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function atualizarLancamento(idx: number, id: string, patch: Partial<LancamentoExtraido>) {
    setFaturas((prev) =>
      prev.map((f, i) =>
        i === idx
          ? { ...f, lancamentos: f.lancamentos.map((l) => (l.id === id ? { ...l, ...patch } : l)) }
          : f,
      ),
    );
  }

  const confirmar = useMutation({
    mutationFn: async () => {
      const { data: lote, error: loteErr } = await supabase
        .from("import_lotes")
        .insert({ created_by: user?.id ?? null, status: "confirmado" })
        .select("id")
        .single();
      if (loteErr) throw loteErr;

      let inseridos = 0;
      let ignorados = 0;

      for (const f of faturas) {
        const path = `${lote.id}/${f.arquivo_hash}.pdf`;
        const up = await supabase.storage.from("faturas").upload(path, f.arquivo, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (up.error) throw up.error;

        const { data: fatura, error: fatErr } = await supabase
          .from("import_faturas")
          .upsert(
            {
              lote_id: lote.id,
              banco: f.banco,
              arquivo_nome: f.arquivo_nome,
              arquivo_hash: f.arquivo_hash,
              storage_path: path,
              vencimento: f.vencimento,
              competencia: f.competencia,
              total_declarado: f.total_declarado,
              limite_total: f.limite_total,
              limite_utilizado: f.limite_utilizado,
              limite_disponivel: f.limite_disponivel,
              total_extraido: f.lancamentos
                .filter((l) => l.incluir)
                .reduce((s, l) => s + (l.direcao === "credito" ? -l.valor : l.valor), 0),
              paginas: f.paginas,
              status: "importada",
            },
            { onConflict: "arquivo_hash" },
          )
          .select("id")
          .single();
        if (fatErr) throw fatErr;


        for (const l of f.lancamentos.filter((x) => x.incluir)) {
          const chave = dedupKey(l);
          const { data: existente } = await supabase
            .from("despesas")
            .select("id")
            .eq("dedup_key", chave)
            .maybeSingle();
          if (existente) {
            ignorados++;
            continue;
          }

          const venc = f.vencimento ?? l.data_compra;
          const primeira = vencimentoParcela(venc, l.parcela_numero, 1);

          // Vincula ao cartão pelo final; senão usa o destino escolhido para a fatura.
          const cartaoLinha = acharCartao(f.banco, l.cartao_final);
          const [tipoDestino, idDestino] = String(f.destino ?? "").split(":");
          const cartaoId = cartaoLinha?.id ?? (tipoDestino === "cartao" ? (idDestino ?? null) : null);
          const bancoId = cartaoId ? null : tipoDestino === "banco" ? (idDestino ?? null) : null;
          const cartaoDestino = cartaoId
            ? ((cartoes as any[]).find((c) => c.id === cartaoId) ?? null)
            : null;

          const { data: despesa, error: despErr } = await supabase
            .from("despesas")
            .insert({
              descricao: l.descricao,
              descricao_normalizada: l.descricao_normalizada,
              valor_total: Number((l.valor * l.parcela_total).toFixed(2)),
              moeda: l.moeda,
              categoria: l.categoria,
              tipo: l.parcela_total > 1 ? "variavel" : "variavel",
              data_compra: l.data_compra,
              total_parcelas: l.parcela_total,
              data_primeira_parcela: primeira,
              responsavel: l.responsavel,
              cartao_id: cartaoId,
              banco_id: bancoId,
              banco_nome: cartaoDestino?.bancos?.nome ?? BANCO_LABEL[f.banco],
              cartao_final: l.cartao_final ?? cartaoDestino?.final ?? null,

              direcao: l.direcao,
              origem: "importacao",
              fatura_id: fatura.id,
              dedup_key: chave,
              created_by: user?.id ?? null,
            })
            .select("id")
            .single();
          if (despErr) throw despErr;

          const parcelas = Array.from({ length: l.parcela_total }, (_, i) => {
            const numero = i + 1;
            return {
              despesa_id: despesa.id,
              numero,
              total: l.parcela_total,
              valor: l.valor,
              moeda: l.moeda,
              vencimento: vencimentoParcela(venc, l.parcela_numero, numero),
              paga: numero < l.parcela_numero,
              situacao_temporal:
                numero < l.parcela_numero
                  ? "passada"
                  : numero === l.parcela_numero
                    ? "atual"
                    : "futura",
              origem: "importacao",
              valor_estimado: numero !== l.parcela_numero,
              confianca_data: l.confianca_data,
              fatura_id: fatura.id,
              dedup_key: `${chave}#${numero}`,
            };
          });
          const { error: parcErr } = await supabase.from("parcelas").insert(parcelas);
          if (parcErr) throw parcErr;
          inseridos++;
        }
      }
      return { inseridos, ignorados };
    },
    onSuccess: ({ inseridos, ignorados }) => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      setFaturas([]);
      toast.success(`${inseridos} lançamento(s) importado(s). ${ignorados} duplicado(s) ignorado(s).`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao importar."),
  });

  return (
    <AppLayout
      title="Importar Faturas"
      description="Envie os PDFs das faturas, revise a prévia e confirme o lançamento."
      actions={
        faturas.length > 0 ? (
          <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>
            {confirmar.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 size-4" />
            )}
            Confirmar importação
          </Button>
        ) : undefined
      }
    >
      <Card>
        <CardContent className="p-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/50"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFiles(e.dataTransfer.files);
            }}
          >
            {lendo ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-6 text-muted-foreground" />
            )}
            <p className="text-sm font-medium">Arraste os PDFs ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground">
              Itaú, Nubank, Pernambucanas e Santander · vários arquivos por vez
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </div>

          {faturas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{totais.arquivos} arquivo(s)</span>
              <span>{totais.linhas} lançamento(s) selecionado(s)</span>
              <span className="font-medium text-foreground">{formatBRL(totais.valor)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {faturas.map((f, idx) => (
        <Card key={f.arquivo_hash} className="mt-4">
          <CardHeader className="gap-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                <span className="truncate">{f.arquivo_nome}</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {f.duplicada && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" /> Arquivo já importado
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFaturas((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Cartão / conta de destino</Label>
                <Select
                  value={f.destino || "nenhum"}
                  onValueChange={(v) => atualizarFatura(idx, { destino: v === "nenhum" ? "" : v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Não vincular</SelectItem>
                    {(cartoes as any[]).map((c) => (
                      <SelectItem key={c.id} value={`cartao:${c.id}`}>
                        {c.apelido ?? c.titular} · {c.bancos?.nome ?? c.bandeira} •{c.final}
                      </SelectItem>
                    ))}
                    {(bancos as any[]).map((b) => (
                      <SelectItem key={b.id} value={`banco:${b.id}`}>
                        {b.nome} (conta)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">

                <Label className="text-xs">Banco</Label>
                <Select
                  value={f.banco}
                  onValueChange={(v) => atualizarFatura(idx, { banco: v as BancoFatura })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {BANCO_LABEL[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento da fatura</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={f.vencimento ?? ""}
                  onChange={(e) =>
                    atualizarFatura(idx, {
                      vencimento: e.target.value || null,
                      competencia: e.target.value ? e.target.value.slice(0, 7) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total declarado</Label>
                <Input
                  className="h-9"
                  value={f.total_declarado ?? ""}
                  onChange={(e) =>
                    atualizarFatura(idx, { total_declarado: Number(e.target.value) || null })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Finais detectados</Label>
                <p className="flex h-9 items-center text-sm text-muted-foreground">
                  {f.finais.length ? f.finais.join(", ") : "nenhum"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Limite total", valor: f.limite_total },
                { label: "Limite utilizado", valor: f.limite_utilizado },
                { label: "Limite disponível", valor: f.limite_disponivel },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {k.valor != null ? formatBRL(k.valor) : "não identificado"}
                  </p>
                </div>
              ))}
            </div>
          </CardHeader>


          <CardContent className="p-0">
            {f.lancamentos.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Não consegui identificar lançamentos neste layout. O leitor específico deste banco
                será calibrado com o PDF de referência.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 p-2"></th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-left">Parcela</th>
                      <th className="p-2 text-left">Responsável</th>
                      <th className="p-2 text-left">Categoria</th>
                      <th className="p-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.lancamentos.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={l.incluir}
                            onCheckedChange={(v) =>
                              atualizarLancamento(idx, l.id, { incluir: !!v })
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap p-2 text-xs">
                          {formatDate(l.data_compra)}
                        </td>
                        <td className="min-w-[220px] p-2">
                          <Input
                            className="h-8"
                            value={l.descricao}
                            onChange={(e) =>
                              atualizarLancamento(idx, l.id, { descricao: e.target.value })
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap p-2 text-xs">
                          {l.parcela_numero}/{l.parcela_total}
                        </td>
                        <td className="p-2">
                          <Select
                            value={l.responsavel ?? "none"}
                            onValueChange={(v) =>
                              atualizarLancamento(idx, l.id, {
                                responsavel: v === "none" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {profiles.map((p: any) => (
                                <SelectItem key={p.id} value={p.nome}>
                                  {p.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select
                            value={l.categoria}
                            onValueChange={(v) => atualizarLancamento(idx, l.id, { categoria: v })}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="outros">Outros</SelectItem>
                              {categorias.map((c: any) => (
                                <SelectItem key={c.id} value={c.nome}>
                                  {c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="whitespace-nowrap p-2 text-right font-medium">
                          {l.direcao === "credito" ? "-" : ""}
                          {formatBRL(l.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </AppLayout>
  );
}
