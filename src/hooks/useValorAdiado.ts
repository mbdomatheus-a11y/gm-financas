import { useEffect, useState } from "react";

/** Devolve `valor` só depois de `ms` sem mudar (debounce). Usado em buscas para não refiltrar a cada tecla. */
export function useValorAdiado<T>(valor: T, ms = 250): T {
  const [adiado, setAdiado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAdiado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return adiado;
}
