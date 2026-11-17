import { useState } from "react";
import { textoContaSobra, textoEmConta, textoPorDia, textoVaiSobrar, type NumerosCiclo } from "@/lib/numeros-ciclo";

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
      <ContaSobra numeros={numeros} formatar={formatar} />
    </div>
  );
}

/**
 * 17/11/2026: a conta do "Vai sobrar" por extenso (receitas − despesas lançadas − faturas que ainda vão
 * fechar − caixinhas), com o detalhe por cartão da estimativa. Fecha com as caixas de Receitas e Despesas.
 */
export function ContaSobra({ numeros, formatar }: { numeros: NumerosCiclo; formatar: (v: number) => string }) {
  const est = numeros.estimativas;
  const [aberto, setAberto] = useState(false);
  return (
    <div className="text-xs text-muted-foreground">
      <button
        type="button"
        aria-expanded={aberto}
        className="text-left hover:text-foreground"
        onClick={(e) => {
          // Pode estar dentro de um link (Início): abre o detalhe sem navegar.
          e.preventDefault();
          e.stopPropagation();
          setAberto((v) => !v);
        }}
      >
        {textoContaSobra(numeros, formatar)} = <b className="text-foreground">{formatar(numeros.previsto.sobra)}</b>
        {est.length > 0 && <span className="ml-1 underline">{aberto ? "ocultar" : "ver faturas"}</span>}
      </button>
      {aberto && est.length > 0 && (
        <div className="mt-1.5 space-y-0.5 rounded-lg bg-muted/50 p-2">
          <p>Faturas ainda abertas: o que falta para chegar na média das últimas faturas de cada cartão.</p>
          {est.map((e) => (
            <p key={e.cartaoId} className="flex justify-between gap-3 tabular-nums">
              <span className="truncate">{e.nome}</span>
              <span>
                média {formatar(e.media)} − lançado {formatar(e.real)} = <b className="text-foreground">{formatar(e.extra)}</b>
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
