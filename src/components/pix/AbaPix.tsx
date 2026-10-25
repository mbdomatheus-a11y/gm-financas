import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownLeft, ArrowUpRight, Check, EyeOff, Landmark, Sparkles, Trash2, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectBusca } from "@/components/SelectBusca";
import { supabase } from "@/integrations/supabase/client";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { formatDate, monthLabelLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IconeBanco } from "@/components/IconeBanco";
import { receitasPorCompetencias } from "@/lib/recorrencia";
import {
  competenciaAnterior,
  competenciaDaData,
  descricaoLimpa,
  diasEntre,
  sugerirParaPix,
  type Candidato,
  type Sugestao,
} from "@/lib/pix-sugestao";
import {
  excluirRegraPix,
  ignorarPix,
  lancarPixComoDespesa,
  lancarPixComoReceita,
  listarPix,
  listarRegrasPix,
  type PixListado,
} from "@/lib/pix.functions";

/**
 * Abas PIX de Receitas e Despesas (pedido de 24/10/2026).
 * Os PIX da conta corrente vindos do Open Finance ficam aqui até a pessoa decidir: lançar como
 * receita/despesa nova, substituir um lançamento daquele mês (com sugestão automática) ou ignorar.
 */

type Direcao = "entrada" | "saida";

export function usePix(direcao: Direcao) {
  const listar = useServerFn(listarPix);
  return useQuery({
    queryKey: ["pix", direcao],
    queryFn: () => listar({ data: { direcao } }),
    staleTime: 60_000,
    retry: false,
  });
}

type CandidatoReceita = Candidato & {
  receitaId: string;
  competencia: string;
  tipo: "fixa" | "variavel";
  projetada: boolean;
};

/** Receitas (previstas e lançadas à mão) do mês do PIX e do mês anterior, que podem ser substituídas. */
export function candidatosReceita(receitas: any[], pixData: string): CandidatoReceita[] {
  const comp = competenciaDaData(pixData);
  return receitasPorCompetencias(receitas, [competenciaAnterior(comp), comp])
    .filter((r) => (r.receitaOriginal as any)?.origem !== "pluggy" && (r.moeda ?? "BRL") === "BRL")
    .map((r) => ({
      id: r.id,
      receitaId: r.receita_id,
      competencia: r.competencia,
      descricao: r.descricao,
      valor: Number(r.valor),
      data: String(r.data_recebimento).slice(0, 10),
      responsavel: r.responsavel,
      tipo: r.tipo,
      projetada: r.projetada,
    }));
}

type CandidatoDespesa = Candidato & { categoria: string };

/** Despesas à vista lançadas à mão até 10 dias antes ou depois do PIX. */
export function candidatosDespesa(despesas: any[], pixData: string): CandidatoDespesa[] {
  return despesas
    .filter(
      (d) =>
        d.tipo !== "fixa" &&
        Number(d.total_parcelas) === 1 &&
        d.origem !== "pluggy" &&
        !d.pluggy_transaction_id &&
        (d.moeda ?? "BRL") === "BRL" &&
        diasEntre(String(d.data_compra), pixData) <= 10,
    )
    .map((d) => ({
      id: String(d.id),
      descricao: String(d.descricao ?? ""),
      valor: Number(d.valor_total),
      data: String(d.data_compra).slice(0, 10),
      responsavel: d.responsavel ?? null,
      categoria: String(d.categoria ?? ""),
    }))
    .sort((a, b) => diasEntre(a.data, pixData) - diasEntre(b.data, pixData));
}

/** Quantos PIX recebidos pendentes parecem com uma receita prevista (para o aviso no topo de Receitas). */
export function contarSugestoesReceita(
  itens: PixListado[] | undefined,
  receitas: any[],
  mes: string | null = null,
): number {
  const lista = filtrarMes(itens, mes);
  if (!lista.length) return 0;
  return lista.filter(
    (p) => p.situacao === "pendente" && sugerirParaPix(p, candidatosReceita(receitas, p.data)),
  ).length;
}

function useCriarCategoria(tipo: "receita" | "despesa") {
  const qc = useQueryClient();
  return async (nome: string) => {
    const limpo = nome.replace(/\s+/g, " ").trim();
    if (limpo.length < 2) return null;
    const { error } = await supabase.from("categorias").insert({ nome: limpo, tipo } as any);
    if (error && !String(error.message).includes("duplicate")) {
      toast.error("Não foi possível criar a categoria.");
      return null;
    }
    qc.invalidateQueries({ queryKey: ["categorias", tipo] });
    return limpo;
  };
}

/** Mês da tela (AAAA-MM) ou null para todos os meses. */
function filtrarMes(itens: PixListado[] | undefined, mes: string | null): PixListado[] {
  if (!itens) return [];
  return mes ? itens.filter((p) => p.data.slice(0, 7) === mes) : itens;
}

// ─── Lista ───────────────────────────────────────────────────────────────────

function ListaPix({
  direcao,
  itens,
  mes,
  sugestaoDe,
  onLancar,
}: {
  direcao: Direcao;
  itens: PixListado[];
  mes: string | null;
  sugestaoDe: (p: PixListado) => Sugestao<Candidato> | null;
  onLancar: (p: PixListado) => void;
}) {
  const qc = useQueryClient();
  const { formatar } = usePrivacidadeValores();
  const [mostrar, setMostrar] = useState<"pendente" | "todos">("pendente");
  const ignorar = useServerFn(ignorarPix);
  const mIgnorar = useMutation({
    mutationFn: (v: { id: string; desfazer?: boolean }) =>
      ignorar({ data: { transactionId: v.id, desfazer: v.desfazer } }),
    onSuccess: (_r, v) => {
      toast.success(v.desfazer ? "PIX voltou para os pendentes." : "PIX ignorado.");
      qc.invalidateQueries({ queryKey: ["pix", direcao] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar o PIX."),
  });

  const visiveis = mostrar === "pendente" ? itens.filter((p) => p.situacao === "pendente") : itens;
  const pendentes = itens.filter((p) => p.situacao === "pendente").length;
  const somaPendentes = itens.filter((p) => p.situacao === "pendente").reduce((s, p) => s + p.valor, 0);
  const somaLancados = itens.filter((p) => p.situacao === "lancado").reduce((s, p) => s + p.valor, 0);
  const somaVisiveis = visiveis.reduce((s, p) => s + p.valor, 0);
  const Icone = direcao === "entrada" ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="space-y-3">
      {/* Soma no topo (25/10/2026). O que está "a decidir" NÃO entra nos totais de receitas/despesas. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">A decidir</p>
            <p className="text-lg font-bold tabular-nums">{formatar(somaPendentes)}</p>
            <p className="text-[11px] text-muted-foreground">
              {pendentes} {direcao === "entrada" ? "entrada(s)" : "PIX"} · fora da soma
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Já lançados</p>
            <p className="text-lg font-bold tabular-nums">{formatar(somaLancados)}</p>
            <p className="text-[11px] text-muted-foreground">
              entram em {direcao === "entrada" ? "Receitas" : "Despesas"}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Nesta lista</p>
            <p className="text-lg font-bold tabular-nums">{formatar(somaVisiveis)}</p>
            <p className="text-[11px] text-muted-foreground">
              {visiveis.length} item(ns) · {mes ? monthLabelLong(mes) : "últimos 12 meses"}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={mostrar === "pendente" ? "default" : "outline"}
          className="h-9 rounded-full"
          onClick={() => setMostrar("pendente")}
        >
          A decidir ({pendentes})
        </Button>
        <Button
          size="sm"
          variant={mostrar === "todos" ? "default" : "outline"}
          className="h-9 rounded-full"
          onClick={() => setMostrar("todos")}
        >
          Todos ({itens.length})
        </Button>
      </div>

      {visiveis.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {mostrar === "pendente"
              ? `Nada esperando decisão${mes ? ` em ${monthLabelLong(mes)}` : ""}.`
              : `Nenhum lançamento${mes ? ` em ${monthLabelLong(mes)}` : " nos últimos 12 meses"}.`}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {visiveis.map((p) => {
              const sug = p.situacao === "pendente" ? sugestaoDe(p) : null;
              return (
                <div key={p.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="relative mt-0.5 shrink-0">
                      <IconeBanco nome={p.banco} logo={p.bancoLogo} />
                      <span
                        className={cn(
                          "absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border-2 border-background",
                          direcao === "entrada" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white",
                        )}
                      >
                        <Icone className="size-2.5" />
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="truncate text-sm font-medium">{p.descricao || "PIX"}</p>
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            direcao === "entrada" ? "text-emerald-600" : "text-rose-600",
                          )}
                        >
                          {formatar(p.valor)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.data)} · {p.banco}
                        {p.situacao === "lancado" && " · já lançado"}
                        {p.situacao === "ignorado" && " · ignorado"}
                      </p>
                      {sug && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                          <Sparkles className="size-3.5 shrink-0" />
                          <span className="truncate">
                            Parece ser {sug.item.descricao} de {formatDate(sug.item.data)} ({formatar(sug.item.valor)}):{" "}
                            {sug.motivo}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:justify-end">
                    {p.situacao === "pendente" && (
                      <>
                        <Button size="sm" className="h-9" onClick={() => onLancar(p)}>
                          {sug ? "Revisar" : "Lançar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9"
                          disabled={mIgnorar.isPending}
                          onClick={() => mIgnorar.mutate({ id: p.id })}
                        >
                          <EyeOff className="size-4" /> Ignorar
                        </Button>
                      </>
                    )}
                    {p.situacao === "ignorado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9"
                        disabled={mIgnorar.isPending}
                        onClick={() => mIgnorar.mutate({ id: p.id, desfazer: true })}
                      >
                        <Undo2 className="size-4" /> Desfazer
                      </Button>
                    )}
                    {p.situacao === "lancado" && (
                      <Badge variant="secondary" className="gap-1">
                        <Check className="size-3" /> Lançado
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Explicacao({ direcao }: { direcao: Direcao }) {
  return (
    <div className="flex gap-3 rounded-xl border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
      <Landmark className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>
        {direcao === "entrada"
          ? "PIX, TED e outras entradas das contas conectadas pelo Open Finance. Elas não entram na soma das receitas até você decidir: lançar como receita nova ou trocar uma receita prevista do mês pelo valor que caiu de verdade. Transferências entre suas próprias contas e resgates de investimento não aparecem aqui."
          : "PIX enviados das contas conectadas pelo Open Finance. Eles só entram nas despesas quando você decide: lançar como despesa nova ou trocar uma despesa lançada à mão pelo valor do banco."}
      </p>
    </div>
  );
}

/** Opção clicável (estilo rádio). */
function Opcao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
        ativo ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
          ativo ? "border-primary bg-primary" : "border-muted-foreground/40",
        )}
      >
        {ativo && <span className="size-1.5 rounded-full bg-primary-foreground" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

// ─── Receitas ────────────────────────────────────────────────────────────────

export function PixReceitas({
  receitas,
  categorias,
  mes = null,
}: {
  receitas: any[];
  categorias: any[];
  /** Mês escolhido na tela (AAAA-MM); null mostra todos. */
  mes?: string | null;
}) {
  const { data, isLoading } = usePix("entrada");
  const [aberto, setAberto] = useState<PixListado | null>(null);

  const sugestaoDe = (p: PixListado) => sugerirParaPix(p, candidatosReceita(receitas, p.data));

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando PIX…</p>;
  if (!data?.disponivel)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Conecte uma conta corrente pelo Open Finance para ver os PIX recebidos aqui.
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Explicacao direcao="entrada" />
      <ListaPix direcao="entrada" itens={filtrarMes(data.itens, mes)} mes={mes} sugestaoDe={sugestaoDe} onLancar={setAberto} />
      <RegrasPix />
      {aberto && (
        <DialogPixReceita
          pix={aberto}
          receitas={receitas}
          categorias={categorias}
          onFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}

function DialogPixReceita({
  pix,
  receitas,
  categorias,
  onFechar,
}: {
  pix: PixListado;
  receitas: any[];
  categorias: any[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { formatar } = usePrivacidadeValores();
  const lancar = useServerFn(lancarPixComoReceita);
  const criarCategoria = useCriarCategoria("receita");
  const candidatos = useMemo(() => candidatosReceita(receitas, pix.data), [receitas, pix.data]);
  const sugestao = useMemo(() => sugerirParaPix(pix, candidatos), [pix, candidatos]);

  const [escolha, setEscolha] = useState<string>(sugestao ? sugestao.item.id : "nova");
  const [tipoNova, setTipoNova] = useState<"variavel" | "fixa">("variavel");
  const [descricao, setDescricao] = useState(descricaoLimpa(pix.descricao));
  const [categoria, setCategoria] = useState<string>("");
  const [criarRegra, setCriarRegra] = useState(false);

  const escolhido = candidatos.find((c) => c.id === escolha) ?? null;
  const podeRegra = escolhido ? escolhido.tipo === "fixa" : tipoNova === "fixa";

  const meses = useMemo(() => {
    const comp = competenciaDaData(pix.data);
    return [comp, competenciaAnterior(comp)];
  }, [pix.data]);

  const m = useMutation({
    mutationFn: () =>
      lancar({
        data: escolhido
          ? {
              transactionId: pix.id,
              modo: "substituir",
              receitaId: escolhido.receitaId,
              competencia: escolhido.competencia,
              criarRegra: podeRegra && criarRegra,
            }
          : {
              transactionId: pix.id,
              modo: tipoNova === "fixa" ? "nova_fixa" : "nova_variavel",
              descricao: descricao.trim() || "PIX recebido",
              categoria: categoria || undefined,
              criarRegra: podeRegra && criarRegra,
            },
      }),
    onSuccess: () => {
      toast.success(escolhido ? "Receita substituída pelo valor do PIX." : "Receita lançada.");
      qc.invalidateQueries({ queryKey: ["receitas"] });
      qc.invalidateQueries({ queryKey: ["pix", "entrada"] });
      onFechar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível lançar o PIX."),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !m.isPending && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PIX recebido de {formatar(pix.valor)}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <IconeBanco nome={pix.banco} logo={pix.bancoLogo} className="size-6 rounded-md text-[9px]" />
            {formatDate(pix.data)} · {pix.banco} · {pix.descricao || "PIX"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sugestao && (
            <div className="flex gap-2 rounded-xl bg-primary/5 p-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                Importei este valor do Open Finance. Ele parece ser <strong>{sugestao.item.descricao}</strong> de{" "}
                {formatDate(sugestao.item.data)} ({formatar(sugestao.item.valor)}). Deseja substituir?
              </p>
            </div>
          )}

          <div className="space-y-2" role="radiogroup" aria-label="Receita a substituir">
            {meses.map((mes) => {
              const doMes = candidatos.filter((c) => c.competencia === mes);
              if (!doMes.length) return null;
              return (
                <div key={mes} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Substituir uma receita de {monthLabelLong(mes)}
                  </p>
                  {doMes.map((c) => (
                    <Opcao key={c.id} ativo={escolha === c.id} onClick={() => setEscolha(c.id)}>
                      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="font-medium">{c.descricao}</span>
                        <span className="tabular-nums">{formatar(c.valor)}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {formatDate(c.data)} · {c.tipo === "fixa" ? "Fixa" : "Variável"}
                        {c.projetada && " (prevista)"}
                        {sugestao?.item.id === c.id && (
                          <Badge className="h-5 gap-1 px-1.5 text-[10px]">
                            <Sparkles className="size-3" /> Sugestão
                          </Badge>
                        )}
                      </span>
                    </Opcao>
                  ))}
                </div>
              );
            })}
            <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ou</p>
            <Opcao ativo={escolha === "nova"} onClick={() => setEscolha("nova")}>
              <span className="font-medium">Não substituir: lançar como receita nova</span>
            </Opcao>
          </div>

          {escolha === "nova" && (
            <div className="space-y-3 rounded-xl border p-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={tipoNova === "variavel" ? "default" : "outline"}
                  onClick={() => setTipoNova("variavel")}
                >
                  Receita variável
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={tipoNova === "fixa" ? "default" : "outline"}
                  onClick={() => setTipoNova("fixa")}
                >
                  Receita fixa (todo mês)
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pix-descricao">Descrição</Label>
                <Input id="pix-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <SelectBusca
                  ariaLabel="Categoria da receita"
                  placeholder="Escolha ou crie uma categoria"
                  valor={categoria || null}
                  opcoes={categorias.map((c: any) => ({ valor: String(c.nome), rotulo: String(c.nome) }))}
                  onEscolher={setCategoria}
                  onCriar={async (texto) => {
                    const nome = await criarCategoria(texto);
                    if (nome) setCategoria(nome);
                  }}
                  rotuloCriar="Criar categoria"
                />
              </div>
              {tipoNova === "fixa" && (
                <p className="text-xs text-muted-foreground">
                  A receita repete todo mês a partir de {formatDate(pix.data)}, com {formatar(pix.valor)}.
                </p>
              )}
            </div>
          )}

          {podeRegra && (
            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
              <Switch checked={criarRegra} onCheckedChange={setCriarRegra} className="mt-0.5" />
              <span>
                <span className="flex items-center gap-1 font-medium">
                  <Zap className="size-3.5 text-primary" /> Fazer isso sozinho nos próximos meses
                </span>
                <span className="block text-xs text-muted-foreground">
                  Quando cair um PIX de {formatar(pix.valor * 0.8)} a {formatar(pix.valor * 1.2)} perto do dia previsto, a
                  receita fixa daquele mês é trocada pelo valor recebido. Dá para apagar a regra depois.
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar} disabled={m.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Salvando..." : escolhido ? "Substituir" : "Lançar receita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegrasPix() {
  const qc = useQueryClient();
  const { formatar } = usePrivacidadeValores();
  const listar = useServerFn(listarRegrasPix);
  const excluir = useServerFn(excluirRegraPix);
  const { data: regras = [] } = useQuery({ queryKey: ["regras-pix-minhas"], queryFn: () => listar(), retry: false });
  const m = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra apagada.");
      qc.invalidateQueries({ queryKey: ["regras-pix-minhas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível apagar a regra."),
  });
  if (!regras.length) return null;
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Zap className="size-4 text-primary" /> Regras automáticas de PIX
        </p>
        <p className="text-xs text-muted-foreground">
          Na sincronização, PIX dentro da faixa e perto do dia previsto substitui a receita fixa daquele mês sozinho.
        </p>
        <ul className="divide-y text-sm">
          {regras.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.receita_descricao}</span>
                <span className="text-xs text-muted-foreground">
                  {formatar(Number(r.valor_minimo))} a {formatar(Number(r.valor_maximo))} · até {r.dias_tolerancia} dias
                  {!r.ativo && " · desativada"}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Apagar regra"
                disabled={m.isPending}
                onClick={() => m.mutate(r.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Despesas ────────────────────────────────────────────────────────────────

export function PixDespesas({
  despesas,
  categorias,
  mes = null,
}: {
  despesas: any[];
  categorias: any[];
  mes?: string | null;
}) {
  const { data, isLoading } = usePix("saida");
  const [aberto, setAberto] = useState<PixListado | null>(null);
  const sugestaoDe = (p: PixListado) => sugerirParaPix(p, candidatosDespesa(despesas, p.data));

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando PIX…</p>;
  if (!data?.disponivel)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Conecte uma conta corrente pelo Open Finance para ver os PIX enviados aqui.
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Explicacao direcao="saida" />
      <ListaPix direcao="saida" itens={filtrarMes(data.itens, mes)} mes={mes} sugestaoDe={sugestaoDe} onLancar={setAberto} />
      {aberto && (
        <DialogPixDespesa pix={aberto} despesas={despesas} categorias={categorias} onFechar={() => setAberto(null)} />
      )}
    </div>
  );
}

function DialogPixDespesa({
  pix,
  despesas,
  categorias,
  onFechar,
}: {
  pix: PixListado;
  despesas: any[];
  categorias: any[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { formatar } = usePrivacidadeValores();
  const lancar = useServerFn(lancarPixComoDespesa);
  const criarCategoria = useCriarCategoria("despesa");
  const candidatos = useMemo(() => candidatosDespesa(despesas, pix.data), [despesas, pix.data]);
  const sugestao = useMemo(() => sugerirParaPix(pix, candidatos), [pix, candidatos]);
  const [escolha, setEscolha] = useState<string>(sugestao ? sugestao.item.id : "nova");
  const [descricao, setDescricao] = useState(descricaoLimpa(pix.descricao));
  const [categoria, setCategoria] = useState<string>("");

  const m = useMutation({
    mutationFn: () =>
      lancar({
        data:
          escolha === "nova"
            ? {
                transactionId: pix.id,
                modo: "nova",
                descricao: descricao.trim() || "PIX enviado",
                categoria: categoria || undefined,
              }
            : { transactionId: pix.id, modo: "substituir", despesaId: escolha },
      }),
    onSuccess: () => {
      toast.success(escolha === "nova" ? "Despesa lançada." : "Despesa substituída pelo valor do PIX.");
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["pix", "saida"] });
      onFechar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível lançar o PIX."),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !m.isPending && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PIX enviado de {formatar(pix.valor)}</DialogTitle>
          <DialogDescription>
            {formatDate(pix.data)} · {pix.banco} · {pix.descricao || "PIX"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sugestao && (
            <div className="flex gap-2 rounded-xl bg-primary/5 p-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                Este PIX parece ser <strong>{sugestao.item.descricao}</strong>, lançada à mão em{" "}
                {formatDate(sugestao.item.data)} ({formatar(sugestao.item.valor)}). Deseja substituir pelo valor do banco?
              </p>
            </div>
          )}
          <div className="space-y-2" role="radiogroup" aria-label="Despesa a substituir">
            {candidatos.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Substituir uma despesa lançada à mão
              </p>
            )}
            {candidatos.slice(0, 12).map((c) => (
              <Opcao key={c.id} ativo={escolha === c.id} onClick={() => setEscolha(c.id)}>
                <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-medium">{c.descricao}</span>
                  <span className="tabular-nums">{formatar(c.valor)}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {formatDate(c.data)} · {c.categoria}
                  {sugestao?.item.id === c.id && (
                    <Badge className="h-5 gap-1 px-1.5 text-[10px]">
                      <Sparkles className="size-3" /> Sugestão
                    </Badge>
                  )}
                </span>
              </Opcao>
            ))}
            {candidatos.length > 0 && (
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ou</p>
            )}
            <Opcao ativo={escolha === "nova"} onClick={() => setEscolha("nova")}>
              <span className="font-medium">Lançar como despesa nova (paga, à vista)</span>
            </Opcao>
          </div>
          {escolha === "nova" && (
            <div className="space-y-3 rounded-xl border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="pix-desc-despesa">Descrição</Label>
                <Input
                  id="pix-desc-despesa"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <SelectBusca
                  ariaLabel="Categoria da despesa"
                  placeholder="Escolha ou crie uma categoria"
                  valor={categoria || null}
                  opcoes={categorias.map((c: any) => ({ valor: String(c.nome), rotulo: String(c.nome) }))}
                  onEscolher={setCategoria}
                  onCriar={async (texto) => {
                    const nome = await criarCategoria(texto);
                    if (nome) setCategoria(nome);
                  }}
                  rotuloCriar="Criar categoria"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar} disabled={m.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Salvando..." : escolha === "nova" ? "Lançar despesa" : "Substituir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
