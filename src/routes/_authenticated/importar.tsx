import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuthData";
import {
  RESPONSAVEIS_EXTRA,
  useBancos,
  useCartoes,
  useCategorias,
  useProfilesList,
} from "@/hooks/useFinance";
import { formatBRL } from "@/lib/format";
import {
  CONFIANCA_LABEL,
  chaveEstabelecimento,
  classificar,
  subcategoriasDe,
  type RegraUsuario,
} from "@/lib/categorizacao";
import { interpretarBloco } from "@/lib/lancamento-texto";
import { lancamentosDeOcr, ocrImagem, hashTexto as hashTextoOcr } from "@/lib/ocr";
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
      { title: "Importar Lançamentos — Finanças do Casal" },
      {
        name: "description",
        content:
          "Importe faturas em PDF ou cole lançamentos de texto, revise tudo linha a linha com categorização automática e confirme para lançar nas despesas.",
      },
      { property: "og:title", content: "Importar Lançamentos — Finanças do Casal" },
      {
        property: "og:description",
        content: "Faturas em PDF e texto colado com prévia totalmente editável e de-para de categorias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportarPage,
});

const BANCOS: BancoFatura[] = ["itau", "nubank", "pernambucanas", "santander", "desconhecido"];

type FaturaItem = FaturaExtraida & { arquivo: File | null; duplicada?: boolean; destino?: string };

/** Normaliza nomes para comparar "Itaú" com "itau", "Banco Santander" com "santander" etc. */
function chaveNome(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function hashTexto(texto: string) {
  const buf = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ImportarPage() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profiles = [] } = useProfilesList();
  const { data: categorias = [] } = useCategorias("despesa");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const inputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [lendo, setLendo] = useState(false);
  const [lendoImagens, setLendoImagens] = useState(false);
  const [faturas, setFaturas] = useState<FaturaItem[]>([]);
  const [colado, setColado] = useState("");

  const { data: regras = [] } = useQuery({
    queryKey: ["categoria-regras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categoria_regras").select("*");
      if (error) throw error;
      return (data ?? []) as RegraUsuario[];
    },
  });

  const responsaveis = useMemo(
    () => [...(profiles as any[]).map((p) => p.nome as string), RESPONSAVEIS_EXTRA],
    [profiles],
  );

  const listaCategorias = useMemo(() => {
    const nomes = new Set<string>((categorias as any[]).map((c) => c.nome as string));
    faturas.forEach((f) => f.lancamentos.forEach((l) => l.categoria && nomes.add(l.categoria)));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categorias, faturas]);

  /** Aplica o de-para e as palavras-chave em cada lançamento lido. */
  function categorizar(lancamentos: LancamentoExtraido[]): LancamentoExtraido[] {
    return lancamentos.map((l) => {
      const c = classificar(l.descricao, { regras, valor: l.valor });
      return {
        ...l,
        categoria: c.categoria,
        subcategoria: c.subcategoria,
        categoria_sugerida: c.categoria,
        confianca_categoria: c.confianca,
        tipo: l.tipo ?? "variavel",
      };
    });
  }

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
            lancamentos: categorizar(extraida.lancamentos),
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

  /** Interpreta o bloco colado (extrato, planilha, mensagens) e cria um lote editável. */
  async function importarColado() {
    const linhas = interpretarBloco(colado, {
      perfis: (profiles as any[]).map((p) => p.nome),
      cartoes: (cartoes as any[]).map((c) => ({ final: c.final, banco: c.bancos?.nome ?? null })),
    });
    if (!linhas.length) {
      toast.error("Não encontrei linhas com data, descrição e valor.");
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const lancamentos: LancamentoExtraido[] = linhas.map((l, i) => ({
      id: `colado-${i}-${Math.random().toString(36).slice(2, 8)}`,
      data_compra: l.data ?? hoje,
      descricao: l.descricao,
      descricao_normalizada: chaveEstabelecimento(l.descricao),
      valor: l.valor,
      moeda: "BRL",
      direcao: "debito",
      parcela_numero: 1,
      parcela_total: 1,
      cartao_final: null,
      responsavel: null,
      categoria: "Outros",
      confianca_data: l.data ? "alta" : "baixa",
      valor_estimado: false,
      incluir: true,
    }));
    const hash = await hashTexto(colado);
    const item: FaturaItem = {
      banco: "desconhecido",
      arquivo_nome: `Colado em ${new Date().toLocaleString("pt-BR")}`,
      arquivo_hash: hash,
      paginas: 0,
      vencimento: null,
      competencia: null,
      total_declarado: null,
      limite_total: null,
      limite_utilizado: null,
      limite_disponivel: null,
      finais: [],
      lancamentos: categorizar(lancamentos),
      texto: colado,
      arquivo: null,
      destino: "",
    };
    setFaturas((prev) => [...prev, item]);
    setColado("");
    toast.success(`${linhas.length} lançamento(s) interpretado(s).`);
  }

  /** Processa prints (JPG/PNG/WEBP) por OCR no navegador e cria um lote editável por imagem. */
  async function onImages(files: FileList | null) {
    if (!files?.length) return;
    const imgs = Array.from(files).filter((f) => /image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name));
    if (!imgs.length) {
      toast.error("Selecione imagens (PNG, JPG ou WEBP).");
      return;
    }
    const lote = imgs.slice(0, 10);
    if (imgs.length > 10) toast.info(`Limite de 10 imagens por lote. ${lote.length} processadas.`);
    setLendoImagens(true);
    try {
      const novos: FaturaItem[] = [];
      for (const [i, file] of lote.entries()) {
        try {
          const texto = await ocrImagem(file);
          const { lancamentos, banco, finais } = lancamentosDeOcr(texto);
          const arquivo_hash = await hashTextoOcr(`${file.name}-${texto}`);
          const { data: jaExiste } = await supabase
            .from("import_faturas")
            .select("id")
            .eq("arquivo_hash", arquivo_hash)
            .maybeSingle();
          const extraida = {
            banco,
            arquivo_nome: file.name,
            arquivo_hash,
            paginas: 1,
            vencimento: null,
            competencia: null,
            total_declarado: null,
            limite_total: null,
            limite_utilizado: null,
            limite_disponivel: null,
            finais,
            lancamentos: categorizar(lancamentos),
            texto,
          };
          novos.push({
            ...extraida,
            arquivo: null,
            duplicada: !!jaExiste,
            destino: destinoPadrao(extraida),
          });
          toast.success(`${file.name}: ${lancamentos.length} linha(s) reconhecida(s).`);
        } catch {
          toast.error(`${file.name}: não consegui ler a imagem.`);
        }
      }
      if (novos.length) setFaturas((prev) => [...prev, ...novos]);
    } finally {
      setLendoImagens(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
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

  const salvarRegra = useMutation({
    mutationFn: async (l: LancamentoExtraido) => {
      const chave = chaveEstabelecimento(l.descricao);
      const item = {
        texto_original: l.descricao,
        estabelecimento_normalizado: chave,
        tipo_regra: "de_para",
        categoria: l.categoria,
        subcategoria: l.subcategoria ?? null,
        prioridade: 300,
        ativo: true,
        created_by: user?.id ?? null,
      };
      const { data: existente } = await supabase
        .from("categoria_regras")
        .select("id")
        .eq("estabelecimento_normalizado", chave)
        .maybeSingle();
      if (existente) {
        const { error } = await supabase.from("categoria_regras").update(item).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categoria_regras").insert(item);
        if (error) throw error;
      }
      const existeCategoria = (categorias as any[]).some(
        (c) => String(c.nome).toLowerCase() === l.categoria.toLowerCase(),
      );
      if (!existeCategoria) {
        await supabase.from("categorias").insert({ nome: l.categoria, tipo: "despesa" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categoria-regras"] });
      qc.invalidateQueries({ queryKey: ["categorias", "despesa"] });
      toast.success("Regra de de-para salva.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar a regra."),
  });

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
        let path: string | null = null;
        if (f.arquivo) {
          path = `${lote.id}/${f.arquivo_hash}.pdf`;
          const up = await supabase.storage.from("faturas").upload(path, f.arquivo, {
            contentType: "application/pdf",
            upsert: true,
          });
          if (up.error) throw up.error;
        }

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
              subcategoria: l.subcategoria ?? null,
              categoria_sugerida: l.categoria_sugerida ?? null,
              confianca_categoria: l.confianca_categoria ?? null,
              categoria_confirmada: true,
              estabelecimento_normalizado: chaveEstabelecimento(l.descricao),
              tipo: l.tipo ?? "variavel",
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
      title="Importar Lançamentos"
      description="Envie PDFs de fatura ou cole os lançamentos, revise linha a linha e confirme."
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
          <Tabs defaultValue="pdf">
            <TabsList className="mb-3">
              <TabsTrigger value="pdf">
                <FileText className="mr-2 size-4" /> Fatura em PDF
              </TabsTrigger>
              <TabsTrigger value="texto">
                <ClipboardPaste className="mr-2 size-4" /> Colar lançamentos
              </TabsTrigger>
              <TabsTrigger value="prints">
                <ImageIcon className="mr-2 size-4" /> Prints
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf">
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
            </TabsContent>

            <TabsContent value="texto" className="space-y-3">
              <Textarea
                rows={8}
                placeholder={
                  "Cole aqui uma linha por lançamento, contendo data, descrição e valor.\n\n12/08 iFood 54,90\n15/08 Uber 23,40\nNetflix 55,90 dia 20"
                }
                value={colado}
                onChange={(e) => setColado(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  As categorias são sugeridas pelo de-para e pelas palavras-chave; tudo continua
                  editável na prévia.
                </p>
                <Button onClick={() => void importarColado()} disabled={!colado.trim()}>
                  <ClipboardPaste className="mr-2 size-4" /> Interpretar
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {faturas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{totais.arquivos} lote(s)</span>
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
                  onValueChange={(v) =>
                    atualizarFatura(idx, {
                      banco: v as BancoFatura,
                      destino: destinoPadrao({ ...f, banco: v as BancoFatura }),
                    })
                  }
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
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Responsável de todas as linhas</Label>
                <Select
                  value="manter"
                  onValueChange={(v) =>
                    setFaturas((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              lancamentos: x.lancamentos.map((l) => ({
                                ...l,
                                responsavel: v === "nenhum" ? null : v,
                              })),
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Aplicar a todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manter">Aplicar a todos…</SelectItem>
                    <SelectItem value="nenhum">—</SelectItem>
                    {responsaveis.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-left">Final</th>
                      <th className="p-2 text-left">Responsável</th>
                      <th className="p-2 text-left">Categoria</th>
                      <th className="p-2 text-left">Subcategoria</th>
                      <th className="p-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.lancamentos.map((l) => (
                      <tr key={l.id} className="border-t align-top">
                        <td className="p-2">
                          <Checkbox
                            checked={l.incluir}
                            onCheckedChange={(v) => atualizarLancamento(idx, l.id, { incluir: !!v })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            className="h-8 w-[140px] text-xs"
                            value={l.data_compra}
                            onChange={(e) =>
                              atualizarLancamento(idx, l.id, { data_compra: e.target.value })
                            }
                          />
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
                        <td className="whitespace-nowrap p-2">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              className="h-8 w-14 text-xs"
                              value={l.parcela_numero}
                              onChange={(e) =>
                                atualizarLancamento(idx, l.id, {
                                  parcela_numero: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground">/</span>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 w-14 text-xs"
                              value={l.parcela_total}
                              onChange={(e) =>
                                atualizarLancamento(idx, l.id, {
                                  parcela_total: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <Select
                            value={l.tipo ?? "variavel"}
                            onValueChange={(v) =>
                              atualizarLancamento(idx, l.id, { tipo: v as "fixa" | "variavel" })
                            }
                          >
                            <SelectTrigger className="h-8 w-[110px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="variavel">Variável</SelectItem>
                              <SelectItem value="fixa">Fixa</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8 w-[80px] text-xs"
                            placeholder="0000"
                            maxLength={4}
                            value={l.cartao_final ?? ""}
                            onChange={(e) =>
                              atualizarLancamento(idx, l.id, {
                                cartao_final: e.target.value.replace(/\D/g, "").slice(0, 4) || null,
                              })
                            }
                          />
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
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {responsaveis.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <Select
                              value={l.categoria}
                              onValueChange={(v) =>
                                atualizarLancamento(idx, l.id, { categoria: v, subcategoria: null })
                              }
                            >
                              <SelectTrigger className="h-8 w-[170px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {listaCategorias.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Salvar como regra de de-para"
                              onClick={() => salvarRegra.mutate(l)}
                            >
                              <BookmarkPlus className="size-4" />
                            </Button>
                          </div>
                          {l.confianca_categoria && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Confiança: {CONFIANCA_LABEL[l.confianca_categoria]}
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <Select
                            value={l.subcategoria ?? "none"}
                            onValueChange={(v) =>
                              atualizarLancamento(idx, l.id, {
                                subcategoria: v === "none" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {subcategoriasDe(l.categoria).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-[110px] text-right text-xs"
                            value={l.valor}
                            onChange={(e) =>
                              atualizarLancamento(idx, l.id, { valor: Number(e.target.value) || 0 })
                            }
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {l.direcao === "credito" ? "crédito" : "débito"} ·{" "}
                            {formatBRL(l.valor * l.parcela_total)}
                          </p>
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
