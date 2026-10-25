import { useState } from "react";

import { visualDoBanco } from "@/lib/banco-visual";
import { cn } from "@/lib/utils";

/** Ícone do banco: logo oficial quando houver; senão iniciais na cor principal do banco. */
export function IconeBanco({ nome, logo = null, className }: { nome: string; logo?: string | null; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const v = visualDoBanco(nome);
  if (logo && !falhou)
    return (
      <img
        src={logo}
        alt={nome}
        title={nome}
        loading="lazy"
        onError={() => setFalhou(true)}
        className={cn("size-9 shrink-0 rounded-xl border bg-white object-contain p-1", className)}
      />
    );
  return (
    <span
      title={nome}
      aria-label={nome}
      className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold", className)}
      style={{ backgroundColor: v.cor, color: v.texto }}
    >
      {v.sigla}
    </span>
  );
}
