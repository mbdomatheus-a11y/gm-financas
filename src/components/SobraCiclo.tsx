import { textoEmConta, textoPorDia, textoVaiSobrar, type NumerosCiclo } from "@/lib/numeros-ciclo";

/**
 * Bloco único de sobra. TODA tela que mostra sobra usa este componente, que só lê calcularNumerosCiclo.
 * Regra do ciclo (08/11/2026): destaque "Vai sobrar em DD/MM" (previsto para sobrar no fim do ciclo, verde ou
 * vermelho), abaixo "Pode gastar R$ Y por dia até DD/MM" (ou "Faltam R$ X para fechar o ciclo") e, menor,
 * "Em conta agora: R$ X (já recebido menos já pago). Ainda vão entrar R$ A e vencer R$ B."
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
  const prev = numeros.previsto.sobra;
  const grande = tamanho === "grande";
  return (
    <div className={`space-y-1.5 ${className}`}>
      {mostrarCiclo && <p className="text-xs text-muted-foreground">Ciclo {numeros.textoCiclo}</p>}
      {mostrarCiclo && <p className="text-xs text-muted-foreground">{numeros.janelas.descricao}</p>}
      <p className="text-sm font-medium text-muted-foreground">{textoVaiSobrar(numeros)}</p>
      <p
        className={`${grande ? "text-5xl sm:text-6xl" : "text-3xl"} font-extrabold leading-none tabular-nums tracking-tight ${prev >= 0 ? "text-success" : "text-destructive"}`}
      >
        {formatar(prev)}
      </p>
      <p className={`text-sm font-semibold tabular-nums ${prev >= 0 ? "text-foreground" : "text-destructive"}`}>
        {textoPorDia(numeros, formatar)}
      </p>
      <p className="text-xs text-muted-foreground">{textoEmConta(numeros, formatar)}</p>
    </div>
  );
}
