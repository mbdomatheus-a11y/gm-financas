import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { visualDoBanco } from "@/lib/banco-visual";
import { logoDoCatalogo } from "@/lib/bancos-logos";
import { catalogoLogosBancos } from "@/lib/bancos-logos.functions";
import { logosDosBancos } from "@/lib/pix.functions";
import { cn } from "@/lib/utils";

const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Logos dos bancos conectados (Pluggy), buscados uma vez e guardados por 12 horas. */
export function useLogosBancos() {
  const buscar = useServerFn(logosDosBancos);
  return useQuery({
    queryKey: ["logos-bancos"],
    queryFn: () => buscar(),
    staleTime: 12 * 3600_000,
    gcTime: 24 * 3600_000,
    retry: false,
  });
}

/** Catálogo de logos oficiais de todos os bancos (28/10/2026), guardado por 24 horas. */
export function useCatalogoLogos() {
  const buscar = useServerFn(catalogoLogosBancos);
  return useQuery({
    queryKey: ["catalogo-logos-bancos"],
    queryFn: () => buscar(),
    staleTime: 24 * 3600_000,
    gcTime: 48 * 3600_000,
    retry: false,
  });
}

/**
 * Ícone do banco (27/10/2026, igual ao app): logo oficial do banco conectado no Open Finance;
 * sem logo, selo com as iniciais na cor do banco. Acha o logo pelo id do banco ou pelo nome
 * ("Itaú 9120" usa o logo do Itaú).
 */
export function IconeBanco({
  nome,
  logo = null,
  bancoId = null,
  className,
}: {
  nome: string;
  logo?: string | null;
  bancoId?: string | null;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const { data: logos = [] } = useLogosBancos();
  const { data: catalogo = [] } = useCatalogoLogos();
  const v = visualDoBanco(nome);
  // 30/10/2026: o logo do catálogo (pelo nome do banco) vem primeiro. O logo da conexão de Open Finance
  // é o do conector usado (ex.: Meu Pluggy, igual para todos os bancos) e só entra se o banco não estiver
  // no catálogo. Antes ele substituía o logo certo assim que carregava ("aparece e some").
  const achado =
    logoDoCatalogo(nome, catalogo) ??
    logo ??
    (bancoId ? logos.find((l) => l.bancoId === bancoId)?.logo : undefined) ??
    logos.find((l) => normal(l.nome) === normal(nome))?.logo ??
    (v.conhecido ? logos.find((l) => visualDoBanco(l.nome).sigla === v.sigla && visualDoBanco(l.nome).conhecido)?.logo : undefined) ??
    null;

  if (achado && !falhou)
    return (
      <img
        src={achado}
        alt={nome}
        title={nome}
        loading="lazy"
        onError={() => setFalhou(true)}
        className={cn("size-9 shrink-0 rounded-xl border bg-white object-contain p-1 shadow-sm", className)}
      />
    );
  return (
    <span
      title={nome}
      aria-label={nome}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl text-[13px] font-extrabold tracking-tight shadow-sm ring-1 ring-black/5",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(145deg, ${v.cor} 0%, ${v.cor} 55%, color-mix(in srgb, ${v.cor} 72%, black) 100%)`,
        color: v.texto,
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/15" aria-hidden="true" />
      <span className="relative">{v.sigla}</span>
    </span>
  );
}
