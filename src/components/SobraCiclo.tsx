import { textoDiferenca, textoDisponivel, textoPrevisto, type NumerosCiclo } from "@/lib/numeros-ciclo";

/**
 * Bloco único de sobra. TODA tela que mostra sobra usa este componente, que só lê calcularNumerosCiclo.
 * Regra do ciclo (08/11/2026): destaque "Disponível até DD/MM" (recebidas menos vencidas), abaixo
 * "Previsto para sobrar em DD/MM: R$ X" e a linha "Inclui R$ X que ainda vão entrar e R$ Y de contas que
 * ainda vão vencer". Ciclo como "15/nov a 15/dez · faltam N dias".
 */
export function SobraCiclo({
  numeros,
  formatar,
  tamanho = "grande",
  className = "",
  mostrarCiclo = true,
}: {
  numeros: NumerosCiclo;
  formatar: (v: number) => string;
  tamanho?: "grande" | "medio";
  className?: string;
  mostrarCiclo?: boolean;
}) {
  const real = numeros.real.sobra;
  const prev = numeros.previsto.sobra;
  const grande = tamanho === "grande";
  return (
    <div className={`space-y-1.5 ${className}`}>
      {mostrarCiclo && <p className="text-xs text-muted-foreground">Ciclo {numeros.textoCiclo}</p>}
      <p className="text-sm font-medium text-muted-foreground">{textoDisponivel(numeros)}</p>
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
