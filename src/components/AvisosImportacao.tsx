import { AlertTriangle, Check, Repeat } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Avisos da tela de importação (2026-10-10).
 *
 * Antes, a explicação da duplicidade/correspondência com despesa fixa era
 * impressa por extenso dentro da coluna estreita "Tipo" e empurrava a tabela
 * inteira; a escolha (mesclar/substituir) ficava num select pequeno e pouco
 * visível. Agora cada aviso é um botão compacto que abre um painel fixo
 * (fica aberto até o usuário clicar fora ou fechar), com a explicação e as
 * opções como botões grandes.
 */

export type AcaoFixa = "manter" | "substituir" | "ajustar" | "ignorar" | "vincular";

const ROTULO_CURTO: Record<AcaoFixa, string> = {
  manter: "Manter os dois",
  substituir: "Valor só deste mês",
  ajustar: "Ajustar daqui pra frente",
  vincular: "Vincular à fixa",
  ignorar: "Ignorar linha",
};

export function AvisoDuplicata({ motivo }: { motivo: string | null | undefined }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
        >
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" /> Possível duplicata
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs" align="start">
        <p className="font-semibold">Pode já estar lançado</p>
        <p className="mt-1 text-muted-foreground">
          {motivo ?? "Encontramos um lançamento muito parecido (mesma data, valor e descrição)."}
        </p>
        <p className="mt-2 text-muted-foreground">
          Se for o mesmo gasto, desmarque a caixa da linha para não importar de novo.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function AvisoCorrespondenciaFixa({
  titulo,
  fixaDescricao,
  fixaValor,
  motivos,
  valorImportado,
  competenciaRotulo,
  acao,
  onAcao,
}: {
  titulo: string;
  fixaDescricao: string;
  fixaValor: number;
  motivos: string[];
  valorImportado: number;
  competenciaRotulo: string;
  acao: AcaoFixa;
  onAcao: (a: AcaoFixa) => void;
}) {
  const opcoes: Array<{ valor: AcaoFixa; titulo: string; detalhe: string }> = [
    {
      valor: "substituir",
      titulo: `Usar ${formatBRL(valorImportado)} só em ${competenciaRotulo}`,
      detalhe: "Troca o valor da fixa apenas neste mês. Os outros meses não mudam.",
    },
    {
      valor: "ajustar",
      titulo: `Ajustar a fixa para ${formatBRL(valorImportado)} a partir de ${competenciaRotulo}`,
      detalhe: "Os meses anteriores ficam como estão; deste mês em diante vale o novo valor.",
    },
    {
      valor: "vincular",
      titulo: "Vincular à fixa sem mudar o valor",
      detalhe: `Marca que este lançamento é a fixa de ${competenciaRotulo}, mantendo ${formatBRL(fixaValor)}.`,
    },
    {
      valor: "manter",
      titulo: "Manter os dois lançamentos",
      detalhe: "Importa a linha como um gasto novo, separado da fixa.",
    },
    {
      valor: "ignorar",
      titulo: "Ignorar a linha importada",
      detalhe: "Não importa esta linha; a fixa continua como está.",
    },
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "mt-1 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-left text-[10px] font-semibold",
            acao === "manter"
              ? "border-amber-500/50 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300"
              : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
          )}
          aria-label={`${titulo}: escolher o que fazer`}
        >
          <Repeat className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {acao === "manter" ? "Parece uma fixa: decidir" : ROTULO_CURTO[acao]}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 text-xs" align="start">
        <p className="font-semibold">{titulo}</p>
        <p className="mt-1 text-muted-foreground">
          Fixa cadastrada: <b className="text-foreground">{fixaDescricao}</b> ({formatBRL(fixaValor)}).
          Importado: <b className="text-foreground">{formatBRL(valorImportado)}</b>.
        </p>
        {motivos.length > 0 && (
          <p className="mt-1 text-muted-foreground">Por quê: {motivos.join(", ")}.</p>
        )}
        <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="O que fazer com esta linha">
          {opcoes.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={acao === o.valor}
              onClick={() => onAcao(o.valor)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors",
                acao === o.valor
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted",
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
      </PopoverContent>
    </Popover>
  );
}
