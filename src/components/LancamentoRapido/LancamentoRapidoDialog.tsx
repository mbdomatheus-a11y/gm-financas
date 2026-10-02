import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mic, Sparkles, Square } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/routes/_authenticated/receitas";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuthData";
import {
  RESPONSAVEIS_EXTRA,
  useBancos,
  useCartoes,
  useCategorias,
  useProfilesList,
} from "@/hooks/useFinance";
import { useResumoFinanceiroMes } from "@/hooks/useResumoFinanceiroMes";
import { classificar } from "@/lib/categorizacao";
import { addMonths, dividirParcelas, toISODate } from "@/lib/format";
import {
  interpretarLancamentoIA,
  transcreverAudioIA,
  resumoFinanceiroIA,
} from "@/lib/lancamento-ia.functions";
import {
  RASCUNHO_VAZIO,
  LIMITE_CARACTERES_TEXTO_IA,
  type ContextoLancamentoIA,
  type RascunhoIA,
} from "@/lib/lancamento-ia";

/** Grava no máximo 60s de áudio — mantém "1 áudio" como unidade de custo
 * previsível pra IA, em vez de deixar a pessoa gravar minutos à toa. Ver
 * `claude/plano-fase2-lancamento-2026-10-02.md` (Frente 1). */
const LIMITE_GRAVACAO_MS = 60_000;

type FormaPagamento = "nenhum" | `cartao:${string}` | `banco:${string}`;

type FormConfirma = {
  tipo: "despesa" | "receita";
  descricao: string;
  valor: string;
  data: string;
  categoria: string;
  responsavel: string;
  pagamento: FormaPagamento;
  parcelas: string;
};

function formVazio(hoje: string, responsavelPadrao: string): FormConfirma {
  return {
    tipo: "despesa",
    descricao: "",
    valor: "",
    data: hoje,
    categoria: "",
    responsavel: responsavelPadrao,
    pagamento: "nenhum",
    parcelas: "1",
  };
}

/** Acha, por nome aproximado (case-insensitive, sem acento), o item de uma
 * lista — usado pra casar o texto livre da IA com cadastros reais (cartão,
 * banco, categoria, pessoa). Nunca inventa: sem correspondência, null. */
function acharPorNome<T>(lista: T[], nome: string | null, nomeDe: (item: T) => string): T | null {
  if (!nome) return null;
  const chave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const alvo = chave(nome);
  return lista.find((item) => chave(nomeDe(item)) === alvo) ?? null;
}

export function LancamentoRapidoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: perfis = [] } = useProfilesList();
  const { data: categoriasDespesa = [] } = useCategorias("despesa");
  const { data: categoriasReceita = [] } = useCategorias("receita");
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();

  const interpretarFn = useServerFn(interpretarLancamentoIA);
  const transcreverFn = useServerFn(transcreverAudioIA);
  const resumirFn = useServerFn(resumoFinanceiroIA);
  const { resumo } = useResumoFinanceiroMes();

  const hoje = toISODate(new Date());
  const nomeUsuarioAtual = profile?.nome ?? null;

  const [modo, setModo] = useState<"lancar" | "resumo">("lancar");

  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [interpretando, setInterpretando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoIA | null>(null);
  const [form, setForm] = useState<FormConfirma>(
    formVazio(hoje, nomeUsuarioAtual ?? RESPONSAVEIS_EXTRA),
  );

  const [perguntaResumo, setPerguntaResumo] = useState("");
  const [respostaResumo, setRespostaResumo] = useState<string | null>(null);
  const [resumindo, setResumindo] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const limiteGravacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetarTudo() {
    setModo("lancar");
    setTexto("");
    setRascunho(null);
    setForm(formVazio(hoje, nomeUsuarioAtual ?? RESPONSAVEIS_EXTRA));
    setPerguntaResumo("");
    setRespostaResumo(null);
  }

  function fechar() {
    if (gravando) pararGravacao();
    resetarTudo();
    onOpenChange(false);
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported(t) : false,
      );
      const recorder = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void processarAudioGravado(recorder.mimeType || "audio/webm");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      limiteGravacaoRef.current = setTimeout(() => {
        toast.info("Gravação limitada a 60 segundos — parando automaticamente.");
        pararGravacao();
      }, LIMITE_GRAVACAO_MS);
    } catch {
      toast.error("Não consegui acessar o microfone — verifique a permissão do navegador.");
    }
  }

  function pararGravacao() {
    if (limiteGravacaoRef.current) {
      clearTimeout(limiteGravacaoRef.current);
      limiteGravacaoRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setGravando(false);
  }

  async function processarAudioGravado(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size === 0) return;
    setTranscrevendo(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultado = String(reader.result ?? "");
          resolve(resultado.slice(resultado.indexOf(",") + 1));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const resultado = await transcreverFn({ data: { audioBase64: base64, mimeType } });
      if (resultado.erro && !resultado.texto) {
        toast.error(resultado.erro);
        return;
      }
      setTexto((atual) => (atual ? `${atual} ${resultado.texto}` : resultado.texto));
    } catch {
      toast.error("Falha ao transcrever o áudio. Você pode digitar em vez disso.");
    } finally {
      setTranscrevendo(false);
    }
  }

  async function interpretar() {
    if (!texto.trim()) {
      toast.error("Digite ou grave algo primeiro.");
      return;
    }
    setInterpretando(true);
    try {
      const contexto: ContextoLancamentoIA = {
        hoje,
        perfis: [...perfis.map((p: any) => p.nome as string), RESPONSAVEIS_EXTRA],
        categoriasDespesa: categoriasDespesa.map((c: any) => c.nome as string),
        categoriasReceita: categoriasReceita.map((c: any) => c.nome as string),
        formasPagamento: [
          ...cartoes.map((c: any) => c.apelido || `Cartão${c.final ? ` •${c.final}` : ""}`),
          ...bancos.map((b: any) => b.nome as string),
        ],
        usuarioAtual: nomeUsuarioAtual,
      };
      const draft = await interpretarFn({ data: { texto, contexto } });
      setRascunho(draft);
      aplicarRascunhoNoForm(draft);
      if (draft.observacao_ia) toast.info(draft.observacao_ia);
    } catch {
      toast.error("IA indisponível agora — preencha manualmente abaixo.");
      setRascunho(RASCUNHO_VAZIO);
    } finally {
      setInterpretando(false);
    }
  }

  async function resumir() {
    setResumindo(true);
    setRespostaResumo(null);
    try {
      const r = await resumirFn({ data: { pergunta: perguntaResumo.trim(), resumo } });
      if (r.erro && !r.texto) {
        toast.error(r.erro);
        return;
      }
      setRespostaResumo(r.texto);
    } catch {
      toast.error("IA indisponível agora — tente de novo em instantes.");
    } finally {
      setResumindo(false);
    }
  }

  function aplicarRascunhoNoForm(draft: RascunhoIA) {
    const tipo = draft.tipo ?? "despesa";
    const categoriasDoTipo = tipo === "despesa" ? categoriasDespesa : categoriasReceita;
    const categoriaAchada = acharPorNome(categoriasDoTipo, draft.categoria, (c: any) => c.nome);
    const categoriaFallback =
      !draft.categoria && draft.descricao && tipo === "despesa"
        ? classificar(draft.descricao, { valor: draft.valor ?? 0 }).categoria
        : null;

    const cartaoAchado = acharPorNome(
      cartoes,
      draft.forma_pagamento,
      (c: any) => c.apelido || `Cartão${c.final ? ` •${c.final}` : ""}`,
    );
    const bancoAchado = cartaoAchado
      ? null
      : acharPorNome(bancos, draft.forma_pagamento, (b: any) => b.nome);

    const perfilAchado = acharPorNome(perfis, draft.responsavel, (p: any) => p.nome);
    const responsavel =
      perfilAchado?.nome ??
      (draft.responsavel === RESPONSAVEIS_EXTRA ? RESPONSAVEIS_EXTRA : null) ??
      nomeUsuarioAtual ??
      RESPONSAVEIS_EXTRA;

    setForm({
      tipo,
      descricao: draft.descricao ?? "",
      valor: draft.valor != null ? String(draft.valor) : "",
      data: draft.data ?? hoje,
      categoria: (categoriaAchada as any)?.nome ?? categoriaFallback ?? "",
      responsavel,
      pagamento: cartaoAchado
        ? (`cartao:${(cartaoAchado as any).id}` as FormaPagamento)
        : bancoAchado
          ? (`banco:${(bancoAchado as any).id}` as FormaPagamento)
          : "nenhum",
      parcelas: draft.parcelas ? String(draft.parcelas) : "1",
    });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const valorNum = Number(form.valor.replace(",", "."));
      if (!form.descricao.trim()) throw new Error("Informe a descrição.");
      if (!Number.isFinite(valorNum) || valorNum <= 0) throw new Error("Informe um valor válido.");
      if (!form.data) throw new Error("Informe a data.");

      const [tipoPg, idPg] = form.pagamento.split(":");
      const cartao_id = tipoPg === "cartao" ? (idPg ?? null) : null;
      const banco_id = tipoPg === "banco" ? (idPg ?? null) : null;

      if (form.tipo === "despesa") {
        const totalParcelas = Math.max(1, Number(form.parcelas) || 1);
        const { data: despesa, error } = await supabase
          .from("despesas")
          .insert({
            descricao: form.descricao.trim(),
            valor_total: valorNum,
            moeda: "BRL",
            categoria: form.categoria || "Categoria a confirmar",
            tipo: "variavel",
            data_compra: form.data,
            total_parcelas: totalParcelas,
            data_primeira_parcela: form.data,
            responsavel: form.responsavel,
            cartao_id,
            banco_id,
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        if (error) throw error;

        const base = new Date(`${form.data}T12:00:00`);
        const parcelas = dividirParcelas(valorNum, totalParcelas).map((valor, i) => ({
          despesa_id: despesa.id,
          numero: i + 1,
          total: totalParcelas,
          valor,
          moeda: "BRL",
          vencimento: toISODate(addMonths(base, i)),
          paga: false,
        }));
        const { error: e2 } = await supabase.from("parcelas").insert(parcelas);
        if (e2) throw e2;
      } else {
        const { error } = await supabase.from("receitas").insert({
          descricao: form.descricao.trim(),
          valor: valorNum,
          moeda: "BRL",
          categoria: form.categoria || "Outros",
          data_recebimento: form.data,
          recorrente: false,
          responsavel: form.responsavel,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.tipo === "despesa" ? "Despesa lançada" : "Receita lançada");
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["receitas"] });
      fechar();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Não foi possível salvar o lançamento.");
    },
  });

  const mostrarFormulario = rascunho !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : fechar())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4.5 text-primary" /> Lançar ou resumir com IA
          </DialogTitle>
          <DialogDescription>
            Fale ou digite o que aconteceu pra lançar na hora, ou peça um resumo rápido de como
            estão suas finanças no mês — a IA sempre te mostra antes de salvar qualquer coisa.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={modo} onValueChange={(v) => setModo(v as "lancar" | "resumo")}>
          <TabsList className="w-full">
            <TabsTrigger value="lancar" className="flex-1">
              Lançar
            </TabsTrigger>
            <TabsTrigger value="resumo" className="flex-1">
              Resumo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pergunte algo específico (ex.: "quanto ainda posso gastar esse mês?") ou deixe em
              branco pra um resumo geral.
            </p>
            <Textarea
              value={perguntaResumo}
              onChange={(e) =>
                setPerguntaResumo(e.target.value.slice(0, LIMITE_CARACTERES_TEXTO_IA))
              }
              placeholder='Ex.: "como estão minhas finanças esse mês?" (opcional)'
              rows={2}
              disabled={resumindo}
            />
            <Button type="button" size="sm" onClick={resumir} disabled={resumindo}>
              {resumindo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {perguntaResumo.trim() ? "Perguntar à IA" : "Resumir meu mês"}
            </Button>
            {respostaResumo && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {respostaResumo}
              </div>
            )}
          </TabsContent>

          <TabsContent value="lancar" className="space-y-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_CARACTERES_TEXTO_IA))}
              placeholder="Ex.: gastei 45 reais de uber hoje, no cartão nubank"
              rows={3}
              disabled={gravando || transcrevendo}
            />
            <div className="flex items-center gap-2">
              {!gravando ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={iniciarGravacao}
                  disabled={transcrevendo}
                >
                  <Mic className="size-4" /> Gravar áudio
                </Button>
              ) : (
                <Button type="button" variant="destructive" size="sm" onClick={pararGravacao}>
                  <Square className="size-4" /> Parar gravação
                </Button>
              )}
              {transcrevendo && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Transcrevendo áudio…
                </span>
              )}
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                onClick={interpretar}
                disabled={interpretando || gravando || transcrevendo || !texto.trim()}
              >
                {interpretando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Interpretar com IA
              </Button>
            </div>

            {!mostrarFormulario && (
              <p className="text-xs text-muted-foreground">
                Também dá pra pular a IA: escreva a descrição e clique em "Interpretar" — se ela não
                conseguir, o formulário abaixo abre em branco pra você preencher na mão.
              </p>
            )}

            {mostrarFormulario && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo">
                    <Select
                      value={form.tipo}
                      onValueChange={(v) =>
                        setForm({ ...form, tipo: v as "despesa" | "receita", categoria: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="despesa">Despesa</SelectItem>
                        <SelectItem value="receita">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Data">
                    <Input
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm({ ...form, data: e.target.value })}
                    />
                  </Field>
                </div>

                <Field label="Descrição">
                  <Input
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Ex.: Mercado"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor (R$)">
                    <Input
                      inputMode="decimal"
                      value={form.valor}
                      onChange={(e) => setForm({ ...form, valor: e.target.value })}
                      placeholder="0,00"
                    />
                  </Field>
                  <Field label={form.tipo === "despesa" ? "Parcelas" : "Responsável"}>
                    {form.tipo === "despesa" ? (
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={form.parcelas}
                        onChange={(e) => setForm({ ...form, parcelas: e.target.value })}
                      />
                    ) : (
                      <Select
                        value={form.responsavel}
                        onValueChange={(v) => setForm({ ...form, responsavel: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {perfis.map((p: any) => (
                            <SelectItem key={p.id} value={p.nome}>
                              {p.nome}
                            </SelectItem>
                          ))}
                          <SelectItem value={RESPONSAVEIS_EXTRA}>{RESPONSAVEIS_EXTRA}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                </div>

                {form.tipo === "despesa" && (
                  <Field label="Responsável">
                    <Select
                      value={form.responsavel}
                      onValueChange={(v) => setForm({ ...form, responsavel: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {perfis.map((p: any) => (
                          <SelectItem key={p.id} value={p.nome}>
                            {p.nome}
                          </SelectItem>
                        ))}
                        <SelectItem value={RESPONSAVEIS_EXTRA}>{RESPONSAVEIS_EXTRA}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                <Field label="Categoria">
                  <Select
                    value={form.categoria}
                    onValueChange={(v) => setForm({ ...form, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(form.tipo === "despesa" ? categoriasDespesa : categoriasReceita).map(
                        (c: any) => (
                          <SelectItem key={c.id} value={c.nome}>
                            {c.nome}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </Field>

                {form.tipo === "despesa" && (
                  <Field label="Forma de pagamento (opcional)">
                    <Select
                      value={form.pagamento}
                      onValueChange={(v) => setForm({ ...form, pagamento: v as FormaPagamento })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Pix / dinheiro / não informado</SelectItem>
                        {cartoes.map((c: any) => (
                          <SelectItem key={c.id} value={`cartao:${c.id}`}>
                            {c.apelido || "Cartão"} {c.final ? `•${c.final}` : ""}
                          </SelectItem>
                        ))}
                        {bancos.map((b: any) => (
                          <SelectItem key={b.id} value={`banco:${b.id}`}>
                            {b.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          {modo === "lancar" && mostrarFormulario && (
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar lançamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
