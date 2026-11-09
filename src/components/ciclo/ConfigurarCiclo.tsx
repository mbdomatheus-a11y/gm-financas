import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCartoes, useReceitas } from "@/hooks/useFinance";
import { useDadosCiclo } from "@/hooks/useNumerosCiclo";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { useRegraCiclo, useSalvarRegraCiclo } from "@/hooks/useRegraCiclo";
import { LogoBanco } from "@/components/LogoBanco";
import { cartaoSchema, salvarCartao } from "@/lib/cartao-salvar";
import { formatBRL } from "@/lib/format";
import { calcularNumerosCiclo, mesDoCicloEm, textoVaiSobrar } from "@/lib/numeros-ciclo";
import { metaDoMes } from "@/lib/poupar";
import {
  EVENTO_ABRIR_CICLO,
  abrirConfigurarCiclo,
  cartaoPrecisaRevisao,
  fraseCartaoNoCiclo,
  marcarCartaoRevisado,
  nomeCartao,
  textoFaturaNoCiclo,
} from "@/lib/regra-ciclo";

/**
 * Assistente do ciclo do mês (08/11/2026, docs/regra-ciclo-2026-11-08.md).
 * Obrigatório quando o grupo ainda não tem regra: não fecha sem salvar.
 * Passos: (a) dia de pagamento, (b) prévia com os números reais, (c) cartões e em que ciclo cada fatura cai.
 */

export const FRASE_REGRA = (d: number) =>
  `Ciclo do dia ${d + 1} ao dia ${d}: receitas e contas que vencem nesse período, mais as faturas de cartão que fecham no mês em que o ciclo termina. O que sobrar é economia.`;

/** Dia da maior receita fixa cadastrada (1 a 28), ou null. */
export function diaSugerido(receitas: any[]): number | null {
  let melhor: { valor: number; dia: number } | null = null;
  for (const r of receitas ?? []) {
    if (!r?.recorrente) continue;
    const data = String(r.recorrencia_inicio ?? r.data_recebimento ?? "");
    const dia = Number(data.slice(8, 10));
    const valor = Number(r.valor) || 0;
    if (!dia) continue;
    if (!melhor || valor > melhor.valor) melhor = { valor, dia: Math.min(28, dia) };
  }
  return melhor?.dia ?? null;
}

const DIAS = Array.from({ length: 28 }, (_, i) => i + 1);

const DIAS31 = Array.from({ length: 31 }, (_, i) => i + 1);

function fraseLinhaCartao(venc: number, dia: number, fech?: number | null): string {
  return `${textoFaturaNoCiclo(venc, dia, new Date(), fech)} (faturas entram pelo mês de fechamento)`;
}

/** Uma linha por cartão: fechamento e vencimento editáveis, salva ao mudar. */
function LinhaCartao({ c, dia }: { c: any; dia: number }) {
  const qc = useQueryClient();
  const [fech, setFech] = useState<number>(Number(c.dia_fechamento) || 0);
  const [venc, setVenc] = useState<number>(Number(c.dia_vencimento) || 0);
  const [estado, setEstado] = useState<"" | "salvando" | "salvo">("");

  async function gravar(f: number, v: number) {
    if (!f || !v) return;
    setEstado("salvando");
    try {
      const dados = cartaoSchema.parse({
        apelido: c.apelido ?? nomeCartao(c),
        bandeira: c.bandeira ?? "Outra",
        final: String(c.final ?? ""),
        limite: c.limite == null ? null : Number(c.limite),
        dia_fechamento: f,
        dia_vencimento: v,
        banco_id: c.banco_id ?? null,
        cor: c.cor ?? "",
        titular: c.titular ?? "",
        tipo: c.tipo ?? "credito",
      });
      await salvarCartao(dados, String(c.id));
      await marcarCartaoRevisado(String(c.id), v);
      await Promise.all([qc.invalidateQueries({ queryKey: ["cartoes"] }), qc.invalidateQueries({ queryKey: ["despesas"] })]);
      setEstado("salvo");
    } catch (e: any) {
      setEstado("");
      toast.error(e?.errors?.[0]?.message ?? e?.message ?? "Não foi possível salvar o cartão.");
    }
  }

  const sel = "h-8 rounded-md border bg-background px-1.5 text-sm";
  return (
    <div className="rounded-xl border p-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <LogoBanco nome={c.bancos?.nome ?? c.apelido} className="size-6" />
        <p className="min-w-0 flex-1 truncate font-medium">{nomeCartao(c)}</p>
        {estado === "salvo" && (
          <span className="flex items-center gap-1 text-xs text-success">
            <Check className="size-3" /> Salvo
          </span>
        )}
        {estado === "salvando" && <span className="text-xs text-muted-foreground">Salvando...</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <label className="flex items-center gap-1">
          Fecha dia
          <select
            className={sel}
            value={fech || ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              setFech(n);
              gravar(n, venc);
            }}
          >
            {!fech && <option value="">?</option>}
            {DIAS31.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <span>·</span>
        <label className="flex items-center gap-1">
          Vence dia
          <select
            className={sel}
            value={venc || ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              setVenc(n);
              gravar(fech, n);
            }}
          >
            {!venc && <option value="">?</option>}
            {DIAS31.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{venc ? fraseLinhaCartao(venc, dia, fech || null) : "Informe o dia de vencimento."}</p>
    </div>
  );
}

/** Lista compacta por cartão; os já revisados ficam recolhidos. A divisão é fixada na abertura. */
function ListaCartoes({ cartoes, dia }: { cartoes: any[]; dia: number }) {
  const [pendentes] = useState(() => new Set(cartoes.filter(cartaoPrecisaRevisao).map((c) => String(c.id))));
  const novos = cartoes.filter((c) => pendentes.has(String(c.id)));
  const revisados = cartoes.filter((c) => !pendentes.has(String(c.id)));
  return (
    <div className="space-y-2 text-sm">
      {novos.map((c) => (
        <LinhaCartao key={c.id} c={c} dia={dia} />
      ))}
      {revisados.length > 0 && (
        <details className="rounded-xl border p-2.5">
          <summary className="cursor-pointer text-muted-foreground">Já revisados ({revisados.length})</summary>
          <div className="mt-2 space-y-2">
            {revisados.map((c) => (
              <LinhaCartao key={c.id} c={c} dia={dia} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ConfigurarCicloDialog({
  open,
  obrigatorio,
  diaAtual,
  onClose,
}: {
  open: boolean;
  obrigatorio: boolean;
  diaAtual: number | null;
  onClose: () => void;
}) {
  const { data: receitas = [] } = useReceitas();
  const { data: cartoes = [] } = useCartoes();
  const { dados, caixinhas } = useDadosCiclo();
  const salvar = useSalvarRegraCiclo();
  const qc = useQueryClient();
  const sugerido = useMemo(() => diaSugerido(receitas as any[]), [receitas]);
  const [passo, setPasso] = useState<"a" | "b" | "c">("a");
  const [dia, setDia] = useState<number>(diaAtual ?? sugerido ?? 5);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setPasso("a");
      setDia(diaAtual ?? sugerido ?? 5);
    }
  }, [open, diaAtual, sugerido]);

  const numeros = useMemo(() => {
    const mes = mesDoCicloEm(new Date(), dia);
    return calcularNumerosCiclo(dados, mes, metaDoMes(caixinhas as any[], mes), dia);
  }, [dados, caixinhas, dia]);

  const credito = (cartoes as any[]).filter((c) => !c.tipo || c.tipo === "credito");

  async function concluir() {
    setSalvando(true);
    try {
      await salvar(dia);
      await Promise.all(credito.map((c) => marcarCartaoRevisado(String(c.id), c.dia_vencimento)));
      await qc.invalidateQueries({ queryKey: ["cartoes"] });
      toast.success(`Ciclo do mês: virada no dia ${dia}.`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o ciclo.");
    } finally {
      setSalvando(false);
    }
  }

  const bloquear = (e: Event) => {
    if (obrigatorio) e.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !obrigatorio && onClose()}>
      <DialogContent
        hideCloseButton={obrigatorio}
        onEscapeKeyDown={bloquear}
        onInteractOutside={bloquear}
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5" /> Ciclo do mês
          </DialogTitle>
          <DialogDescription>
            {passo === "a" ? `Passo 1 de ${credito.length ? 3 : 2}` : passo === "b" ? `Passo 2 de ${credito.length ? 3 : 2}: prévia com os seus números` : "Passo 3 de 3: seus cartões"}
          </DialogDescription>
        </DialogHeader>

        {passo === "a" && (
          <div className="space-y-4">
            <p className="text-lg font-semibold">Qual é o seu principal dia de pagamento?</p>
            {sugerido && (
              <p className="text-sm text-muted-foreground">
                Sugestão: dia {sugerido}, o dia da sua maior receita fixa cadastrada.
              </p>
            )}
            <label className="flex items-center gap-3 text-sm">
              Dia
              <select
                className="h-10 rounded-md border bg-background px-3 text-base"
                value={dia}
                onChange={(e) => setDia(Number(e.target.value))}
              >
                {DIAS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-xl bg-muted p-3 text-sm">{FRASE_REGRA(dia)}</p>
          </div>
        )}

        {passo === "b" && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Ciclo {numeros.textoCiclo}</p>
            <p className="text-xs text-muted-foreground">{numeros.janelas.descricao}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Receitas que entram</p>
                <p className="font-semibold tabular-nums">{formatBRL(numeros.previsto.receitas)}</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Contas que vencem</p>
                <p className="font-semibold tabular-nums">{formatBRL(numeros.previsto.despesas)}</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Em conta agora</p>
                <p className={`font-semibold tabular-nums ${numeros.real.sobra < 0 ? "text-destructive" : "text-success"}`}>
                  {formatBRL(numeros.real.sobra)}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">{textoVaiSobrar(numeros)}</p>
                <p className={`font-semibold tabular-nums ${numeros.previsto.sobra < 0 ? "text-destructive" : ""}`}>
                  {formatBRL(numeros.previsto.sobra)}
                </p>
              </div>
            </div>
            <p className="rounded-xl border p-3">
              Receitas contam pela data prevista, de {numeros.janelas.receitas.inicio.slice(8, 10)}/{numeros.janelas.receitas.inicio.slice(5, 7)} a{" "}
              {numeros.janelas.receitas.fim.slice(8, 10)}/{numeros.janelas.receitas.fim.slice(5, 7)}. Contas contam pelo vencimento, de{" "}
              {numeros.janelas.despesas.inicio.slice(8, 10)}/{numeros.janelas.despesas.inicio.slice(5, 7)} a{" "}
              {numeros.janelas.despesas.fim.slice(8, 10)}/{numeros.janelas.despesas.fim.slice(5, 7)}. Faturas de cartão pelo fechamento, de{" "}
              {numeros.janelas.faturas.inicio.slice(8, 10)}/{numeros.janelas.faturas.inicio.slice(5, 7)} a{" "}
              {numeros.janelas.faturas.fim.slice(8, 10)}/{numeros.janelas.faturas.fim.slice(5, 7)}. {FRASE_REGRA(dia)}
            </p>
          </div>
        )}

        {passo === "c" && (
          <>
            {credito.length === 0 && <p className="text-sm text-muted-foreground">Você ainda não tem cartão de crédito cadastrado.</p>}
            {credito.length > 0 && <ListaCartoes cartoes={credito} dia={dia} />}
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {passo === "a" && (
            <>
              {!obrigatorio && (
                <Button variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
              )}
              {sugerido && sugerido !== dia && (
                <Button variant="outline" onClick={() => setDia(sugerido)}>
                  Usar dia sugerido
                </Button>
              )}
              <Button onClick={() => setPasso("b")}>Continuar</Button>
            </>
          )}
          {passo === "b" && (
            <>
              <Button variant="outline" onClick={() => setPasso("a")}>
                Voltar
              </Button>
              <Button onClick={() => (credito.length ? setPasso("c") : concluir())} disabled={salvando}>{credito.length ? "Continuar" : "Salvar"}</Button>
            </>
          )}
          {passo === "c" && (
            <>
              <Button variant="outline" onClick={() => setPasso("b")} disabled={salvando}>
                Voltar
              </Button>
              <Button onClick={concluir} disabled={salvando}>
                {salvando ? "Salvando..." : "Está tudo certo"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmação obrigatória de um toque ao salvar cartão novo ou mudar o vencimento.
 * Sem regra do grupo (ou migration pendente), não aparece: chama onClose na hora.
 */
export function ConfirmarCartaoCiclo({
  cartao,
  onClose,
}: {
  cartao: { id?: string | null; nome: string; dia_vencimento: number } | null;
  onClose: () => void;
}) {
  const { regra, disponivel } = useRegraCiclo();
  const { data: lista = [] } = useCartoes();
  const qc = useQueryClient();
  const aberto = !!cartao && disponivel && !!regra;
  useEffect(() => {
    if (cartao && !(disponivel && regra)) onClose();
  }, [cartao, disponivel, regra, onClose]);
  if (!aberto || !cartao || !regra) return null;
  const todos = lista as any[];
  const achado =
    todos.find((c) => cartao.id && String(c.id) === String(cartao.id)) ??
    todos.slice().reverse().find((c) => nomeCartao(c) === cartao.nome) ??
    null;
  const confirmar = async () => {
    const id = achado?.id ?? cartao.id ?? null;
    if (id) await marcarCartaoRevisado(String(id), achado?.dia_vencimento ?? cartao.dia_vencimento).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ["cartoes"] });
    onClose();
  };
  const bloquear = (e: Event) => e.preventDefault();
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent hideCloseButton onEscapeKeyDown={bloquear} onInteractOutside={bloquear} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Em que ciclo as faturas caem</DialogTitle>
          <DialogDescription>Confira os dias do cartão. Se algo estiver errado, corrija aqui mesmo.</DialogDescription>
        </DialogHeader>
        {achado ? (
          <LinhaCartao c={achado} dia={regra.dia_virada} />
        ) : (
          <p className="rounded-xl border p-3 text-sm">{fraseCartaoNoCiclo(cartao.nome, cartao.dia_vencimento, regra.dia_virada, new Date(), (cartao as any).dia_fechamento ?? null)}</p>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await confirmar();
              abrirConfigurarCiclo();
            }}
          >
            Mudar a virada
          </Button>
          <Button onClick={confirmar}>Está tudo certo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevisarCartoesDialog({ cartoes, todosCartoes, dia, onClose }: { cartoes: any[]; todosCartoes: any[]; dia: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const bloquear = (e: Event) => e.preventDefault();
  async function confirmar() {
    setSalvando(true);
    await Promise.all(
      cartoes.filter(cartaoPrecisaRevisao).map((c) => marcarCartaoRevisado(String(c.id), c.dia_vencimento).catch(() => undefined)),
    );
    await qc.invalidateQueries({ queryKey: ["cartoes"] });
    setSalvando(false);
    onClose();
  }
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent hideCloseButton onEscapeKeyDown={bloquear} onInteractOutside={bloquear} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revise seus cartões</DialogTitle>
          <DialogDescription>Ajuste o fechamento e o vencimento se precisar. Virada no dia {dia}.</DialogDescription>
        </DialogHeader>
        <ListaCartoes cartoes={todosCartoes} dia={dia} />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={salvando}
            onClick={async () => {
              await confirmar();
              abrirConfigurarCiclo();
            }}
          >
            Mudar a virada
          </Button>
          <Button onClick={confirmar} disabled={salvando}>
            Está tudo certo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CHAVE_REVISAO_SESSAO = "controlall.ciclo.revisao-cartoes";

/** Abre o assistente quando o grupo não tem regra, atende "Alterar"/"Mudar a virada" e pede a revisão dos cartões. */
export function ConfigurarCicloGate({ bloqueado = false }: { bloqueado?: boolean }) {
  const { disponivel, regra, carregado } = useRegraCiclo();
  const prontas = useFinancasProntas();
  const { data: cartoes = [] } = useCartoes();
  const [aberto, setAberto] = useState(false);
  const [revisar, setRevisar] = useState(false);
  const revisou = useRef(false);

  const obrigatorio = disponivel && carregado && !regra;

  useEffect(() => {
    if (!bloqueado && obrigatorio && prontas) setAberto(true);
  }, [bloqueado, obrigatorio, prontas]);

  useEffect(() => {
    const abrir = () => {
      if (disponivel) setAberto(true);
      else toast.info("A configuração do ciclo ainda não está disponível. Tente mais tarde.");
    };
    window.addEventListener(EVENTO_ABRIR_CICLO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_CICLO, abrir);
  }, [disponivel]);

  const pendentes = useMemo(() => (cartoes as any[]).filter(cartaoPrecisaRevisao), [cartoes]);
  useEffect(() => {
    if (bloqueado || aberto || !regra || !pendentes.length || revisou.current) return;
    try {
      if (sessionStorage.getItem(CHAVE_REVISAO_SESSAO)) return;
    } catch {
      /* sem sessionStorage: segue */
    }
    setRevisar(true);
  }, [bloqueado, aberto, regra, pendentes.length]);

  const fecharRevisao = () => {
    revisou.current = true;
    try {
      sessionStorage.setItem(CHAVE_REVISAO_SESSAO, "1");
    } catch {
      /* ignora */
    }
    setRevisar(false);
  };

  return (
    <>
      <ConfigurarCicloDialog
        open={aberto}
        obrigatorio={obrigatorio}
        diaAtual={regra?.dia_virada ?? null}
        onClose={() => setAberto(false)}
      />
      {revisar && !aberto && regra && <RevisarCartoesDialog cartoes={pendentes} todosCartoes={(cartoes as any[]).filter((c) => !c.tipo || c.tipo === "credito")} dia={regra.dia_virada} onClose={fecharRevisao} />}
    </>
  );
}
