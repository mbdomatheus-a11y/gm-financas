import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCartoes, useReceitas } from "@/hooks/useFinance";
import { useDadosCiclo } from "@/hooks/useNumerosCiclo";
import { useFinancasProntas } from "@/hooks/useFinancasProntas";
import { useRegraCiclo, useSalvarRegraCiclo } from "@/hooks/useRegraCiclo";
import { formatBRL } from "@/lib/format";
import { calcularNumerosCiclo, mesDoCicloEm, rotuloPrevisto, textoDisponivel } from "@/lib/numeros-ciclo";
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
  `O salário do dia ${d} paga as contas que vencem até o próximo dia ${d}. O que sobrar no dia ${d} é economia.`;

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
            {passo === "a" ? "Passo 1 de 3" : passo === "b" ? "Passo 2 de 3: prévia com os seus números" : "Passo 3 de 3: seus cartões"}
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
                <p className="text-xs text-muted-foreground">{textoDisponivel(numeros)}</p>
                <p className={`font-semibold tabular-nums ${numeros.real.sobra < 0 ? "text-destructive" : "text-success"}`}>
                  {formatBRL(numeros.real.sobra)}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">{rotuloPrevisto(numeros)}</p>
                <p className={`font-semibold tabular-nums ${numeros.previsto.sobra < 0 ? "text-destructive" : ""}`}>
                  {formatBRL(numeros.previsto.sobra)}
                </p>
              </div>
            </div>
            <p className="rounded-xl border p-3">
              Receitas contam pela data prevista, de {numeros.janelas.receitas.inicio.slice(8, 10)}/{numeros.janelas.receitas.inicio.slice(5, 7)} a{" "}
              {numeros.janelas.receitas.fim.slice(8, 10)}/{numeros.janelas.receitas.fim.slice(5, 7)}. Contas contam pelo vencimento, de{" "}
              {numeros.janelas.despesas.inicio.slice(8, 10)}/{numeros.janelas.despesas.inicio.slice(5, 7)} a{" "}
              {numeros.janelas.despesas.fim.slice(8, 10)}/{numeros.janelas.despesas.fim.slice(5, 7)}. {FRASE_REGRA(dia)}
            </p>
          </div>
        )}

        {passo === "c" && (
          <div className="space-y-2 text-sm">
            {credito.length === 0 && <p className="text-muted-foreground">Você ainda não tem cartão de crédito cadastrado.</p>}
            {credito.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl border p-3">
                <CreditCard className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {nomeCartao(c)} · fecha dia {c.dia_fechamento ?? "?"}, vence dia {c.dia_vencimento ?? "?"}
                  </p>
                  {c.dia_vencimento ? (
                    <p className="text-muted-foreground">{textoFaturaNoCiclo(Number(c.dia_vencimento), dia)}</p>
                  ) : (
                    <p className="text-muted-foreground">Sem dia de vencimento cadastrado.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
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
              <Button onClick={() => setPasso("c")}>Continuar</Button>
            </>
          )}
          {passo === "c" && (
            <>
              <Button variant="outline" onClick={() => setPasso("b")} disabled={salvando}>
                Voltar
              </Button>
              <Button onClick={concluir} disabled={salvando}>
                {salvando ? "Salvando..." : credito.length ? "Confirmar e salvar" : "Salvar"}
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
  const qc = useQueryClient();
  const aberto = !!cartao && disponivel && !!regra;
  useEffect(() => {
    if (cartao && !(disponivel && regra)) onClose();
  }, [cartao, disponivel, regra, onClose]);
  if (!aberto || !cartao || !regra) return null;
  const confirmar = async () => {
    let id = cartao.id ?? null;
    if (!id) {
      const lista = (await qc.fetchQuery({ queryKey: ["cartoes"] }).catch(() => [])) as any[];
      id = lista.slice().reverse().find((c) => nomeCartao(c) === cartao.nome)?.id ?? null;
    }
    if (id) await marcarCartaoRevisado(String(id), cartao.dia_vencimento).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ["cartoes"] });
    onClose();
  };
  const bloquear = (e: Event) => e.preventDefault();
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent hideCloseButton onEscapeKeyDown={bloquear} onInteractOutside={bloquear} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Em que ciclo as faturas caem</DialogTitle>
          <DialogDescription>{fraseCartaoNoCiclo(cartao.nome, cartao.dia_vencimento, regra.dia_virada)}</DialogDescription>
        </DialogHeader>
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
          <Button onClick={confirmar}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevisarCartoesDialog({ cartoes, dia, onClose }: { cartoes: any[]; dia: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const bloquear = (e: Event) => e.preventDefault();
  async function confirmar() {
    setSalvando(true);
    await Promise.all(cartoes.map((c) => marcarCartaoRevisado(String(c.id), c.dia_vencimento).catch(() => undefined)));
    await qc.invalidateQueries({ queryKey: ["cartoes"] });
    setSalvando(false);
    onClose();
  }
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent hideCloseButton onEscapeKeyDown={bloquear} onInteractOutside={bloquear} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revise seus cartões</DialogTitle>
          <DialogDescription>Confira em que ciclo as faturas de cada cartão caem com a virada no dia {dia}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {cartoes.map((c) => (
            <p key={c.id} className="rounded-xl border p-3">
              {c.dia_vencimento ? fraseCartaoNoCiclo(nomeCartao(c), Number(c.dia_vencimento), dia) : `${nomeCartao(c)}: sem dia de vencimento cadastrado.`}
            </p>
          ))}
        </div>
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
            Confirmar
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
      {revisar && !aberto && regra && <RevisarCartoesDialog cartoes={pendentes} dia={regra.dia_virada} onClose={fecharRevisao} />}
    </>
  );
}
