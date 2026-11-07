import { useState } from "react";

import { visualBanco } from "@/lib/bancos-catalogo";
import { cn } from "@/lib/utils";

/** Ícone do banco pelo favicon do domínio; sem ele, círculo na cor da marca com as iniciais (07/11/2026). */
export function LogoBanco({ nome, className }: { nome: string | null | undefined; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const v = visualBanco(nome);
  if (v.icone && !falhou) {
    return (
      <img
        src={v.icone}
        alt=""
        loading="lazy"
        onError={() => setFalhou(true)}
        className={cn("size-8 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-border", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold", className)}
      style={{ backgroundColor: v.cor, color: v.texto }}
    >
      {v.iniciais}
    </span>
  );
}
