import { useEffect, useState } from "react";

import { visualBanco } from "@/lib/bancos-catalogo";
import { logoDoBanco, useLogosBancos } from "@/lib/logos-bancos-cache";
import { cn } from "@/lib/utils";

/**
 * Ícone do banco: logo do bucket "logos-bancos" (escolhido pelo admin ou buscado toda semana, 14/11/2026);
 * sem ele, favicon do domínio; sem os dois, círculo na cor da marca com as iniciais (07/11/2026).
 */
export function LogoBanco({ nome, className }: { nome: string | null | undefined; className?: string }) {
  useLogosBancos();
  const v = visualBanco(nome);
  const doBucket = logoDoBanco(nome);
  const fontes = [doBucket.url, v.icone].filter((u): u is string => !!u);
  const [falhas, setFalhas] = useState(0);
  const src = fontes[falhas];
  useEffect(() => setFalhas(0), [doBucket.url]);
  const cor = doBucket.cor ?? v.cor;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFalhas((n) => n + 1)}
        className={cn("size-8 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-border", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold", className)}
      style={{ backgroundColor: cor, color: v.texto }}
    >
      {v.iniciais}
    </span>
  );
}
