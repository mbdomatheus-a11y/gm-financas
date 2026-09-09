import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "financas_ocultar_valores";

export function usePrivacidadeValores() {
  const [ocultarValores, setOcultarValores] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(ocultarValores));
    } catch {
      // Ignora falhas de localStorage
    }
  }, [ocultarValores]);

  const toggle = useCallback(() => {
    setOcultarValores((prev) => !prev);
  }, []);

  return {
    ocultarValores,
    toggle,
    setOcultarValores,
  };
}
