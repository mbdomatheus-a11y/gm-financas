import { ArrowDown, ArrowUp } from "lucide-react";

import { type OrdemGastos, proximaOrdem } from "@/lib/ordem-gastos";

const OPCOES: { campo: OrdemGastos["campo"]; rotulo: string }[] = [
  { campo: "data", rotulo: "Data" },
  { campo: "valor", rotulo: "Valor" },
  { campo: "nome", rotulo: "Nome A-Z" },
];

/** Controle compacto de ordenação: tocar de novo em Data ou Valor inverte a ordem. */
export function OrdemGastosControle({ ordem, onChange }: { ordem: OrdemGastos; onChange: (o: OrdemGastos) => void }) {
  return (
    <div className="inline-flex items-center gap-1 text-xs" role="group" aria-label="Ordenar gastos">
      <span className="mr-1 text-muted-foreground">Ordenar</span>
      {OPCOES.map((o) => {
        const ativo = ordem.campo === o.campo;
        return (
          <button
            key={o.campo}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(proximaOrdem(ordem, o.campo))}
            className={`inline-flex h-7 items-center gap-0.5 rounded-full border px-2.5 font-medium ${
              ativo ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {o.rotulo}
            {ativo && o.campo !== "nome" && (ordem.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          </button>
        );
      })}
    </div>
  );
}
