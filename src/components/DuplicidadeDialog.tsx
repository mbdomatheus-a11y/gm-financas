import { AlertTriangle, Check, Copy, FileText, PencilLine, Repeat, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL, formatDate } from "@/lib/format";
import {
  rotuloOrigem,
  type AcaoDuplicata,
  type Candidata,
  type LancamentoImportado,
} from "@/lib/duplicidade-importacao";
import { cn } from "@/lib/utils";

function IconeOrigem({ rotulo }: { rotulo: string }) {
  const classe = "size-3.5 shrink-0";
  if (rotulo.startsWith("Despesa fixa")) return <Repeat className={classe} aria-hidden="true" />;
  if (rotulo.startsWith("Importado") || rotulo.startsWith("Total"))
    return <FileText className={classe} aria-hidden="true" />;
  if (rotulo.startsWith("Lançado com a IA"))
    return <Sparkles className={classe} aria-hidden="true" />;
  return <PencilLine className={classe} aria-hidden="true" />;
}

const OPCOES: Array<{ valor: AcaoDuplicata; titulo: string; detalhe: string }> = [
  {
    valor: "substituir",
    titulo: "Substituir pelo lançamento da fatura",
    detalhe:
      "Atualiza o lançamento que já existe com a data, o valor e a descrição da fatura, e deixa ele vinculado a ela. Nada é duplicado.",
  },
  {
    valor: "manter_existente",
    titulo: "Manter o que já existe",
    detalhe: "Não importa esta linha. O lançamento antigo continua como está.",
  },
  {
    valor: "novo",
    titulo: "São gastos diferentes, criar um novo",
    detalhe:
      "Importa a linha como um lançamento separado. Use quando você gastou o mesmo valor no mesmo lugar duas vezes.",
  },
];

/**
 * Popup de duplicidade da importação: mostra o lançamento lido na fatura, os
 * lançamentos parecidos que já existem (com a origem de cada um) e o que fazer.
 */
export function DuplicidadeDialog({
  aberto,
  onAberto,
  lancamento,
  candidatas,
  acao,
  alvoId,
  onEscolher,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  lancamento: LancamentoImportado | null;
  candidatas: Candidata[];
  acao: AcaoDuplicata;
  alvoId: string | null;
  onEscolher: (acao: AcaoDuplicata, alvoId: string | null) => void;
}) {
  if (!lancamento) return null;
  const alvo = alvoId ?? candidatas[0]?.despesa.id ?? null;

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
            Lançamento parecido com {candidatas.length === 1 ? "um que" : `${candidatas.length} que`}{" "}
            já {candidatas.length === 1 ? "existe" : "existem"}
          </DialogTitle>
          <DialogDescription>
            Confira de onde veio cada lançamento e escolha o que fazer com esta linha da fatura.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Nesta fatura
          </p>
          <p className="mt-1 font-medium">{lancamento.descricao}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(lancamento.data_compra)} · {formatBRL(lancamento.valor)}
            {lancamento.parcela_total > 1
              ? ` · parcela ${lancamento.parcela_numero}/${lancamento.parcela_total}`
              : ""}
            {lancamento.cartao_final ? ` · final ${lancamento.cartao_final}` : ""}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Já cadastrado{candidatas.length > 1 ? "s" : ""}
          </p>
          {candidatas.map((c) => {
            const rotulo = rotuloOrigem(c.despesa);
            const escolhido = alvo === c.despesa.id;
            return (
              <button
                key={c.despesa.id}
                type="button"
                onClick={() => onEscolher(acao === "decidir" ? "substituir" : acao, c.despesa.id)}
                aria-pressed={escolhido}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                  escolhido ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    escolhido ? "border-primary bg-primary text-primary-foreground" : "",
                  )}
                >
                  {escolhido && <Check className="size-3" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <b className="truncate">{c.despesa.descricao}</b>
                    <Badge variant="outline" className="gap-1 font-normal">
                      <IconeOrigem rotulo={rotulo} />
                      {rotulo}
                    </Badge>
                    {(c.despesa.total_parcelas ?? 1) > 1 && (
                      <Badge variant="outline" className="font-normal">
                        {c.despesa.total_parcelas}x
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatDate(c.despesa.data_compra)} ·{" "}
                    {formatBRL(Number(c.despesa.valor_total ?? 0))}
                    {c.despesa.categoria ? ` · ${c.despesa.categoria}` : ""}
                    {c.despesa.cartao_final ? ` · final ${c.despesa.cartao_final}` : ""}
                    {c.despesa.responsavel ? ` · ${c.despesa.responsavel}` : ""}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Por que apareceu aqui: {c.motivos.join(", ")}.
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5" role="radiogroup" aria-label="O que fazer com esta linha">
          {OPCOES.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={acao === o.valor}
              onClick={() => onEscolher(o.valor, alvo)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md border p-2 text-left text-xs transition-colors",
                acao === o.valor ? "border-primary bg-primary/10" : "hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  acao === o.valor ? "border-primary bg-primary text-primary-foreground" : "",
                )}
              >
                {acao === o.valor && <Check className="size-3" aria-hidden="true" />}
              </span>
              <span>
                <span className="block font-medium">{o.titulo}</span>
                <span className="block text-muted-foreground">{o.detalhe}</span>
              </span>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onAberto(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => {
              onEscolher(acao === "decidir" ? "substituir" : acao, alvo);
              onAberto(false);
            }}
          >
            <Copy className="mr-1.5 size-4" aria-hidden="true" /> Confirmar escolha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
