import {
  ROTULO_SOBRA_REAL,
  textoDiferenca,
  textoPrevisto,
  type NumerosCiclo,
} from "@/lib/numeros-ciclo";

/**
 * Bloco único de sobra (07/11/2026). TODA tela que mostra sobra usa este componente, que só lê
 * calcularNumerosCiclo: destaque "Sobra até agora" (REAL) e, abaixo e menor, "Previsto no fim do ciclo: R$ X"
 * com a linha que explica a diferença.
 */
export function SobraCiclo({
  numeros,
  formatar,
  tamanho = "grande",
  className = "",
}: {
  numeros: NumerosCiclo;
  formatar: (v: number) => string;
  tamanho?: "grande" | "medio";
  className?: string;
}) {
  const real = numeros.real.sobra;
  const prev = numeros.previsto.sobra;
  const grande = tamanho === "grande";
  return (
    <div className={`space-y-1.5 ${className}`}>
      <p className="text-sm font-medium text-muted-foreground">{ROTULO_SOBRA_REAL}</p>
      <p
        className={`${grande ? "text-5xl sm:text-6xl" : "text-3xl"} font-extrabold leading-none tabular-nums tracking-tight ${real >= 0 ? "text-success" : "text-destructive"}`}
      >
        {formatar(real)}
      </p>
      <p className={`text-sm font-semibold tabular-nums ${prev >= 0 ? "text-foreground" : "text-destructive"}`}>
        {textoPrevisto(numeros, formatar)}
      </p>
      <p className="text-xs text-muted-foreground">{textoDiferenca(numeros, formatar)}</p>
    </div>
  );
}
