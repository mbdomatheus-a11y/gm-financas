import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useBrandLogoUrl() {
  const { data: logoPath } = useQuery({
    // Query key exclusiva deste hook — não compartilhar com outras queries
    // que leem a mesma tabela (ex.: a aba Personalização em administracao.tsx),
    // mesmo que pareça conveniente reaproveitar o cache: se os dois lados
    // devolverem formatos diferentes (aqui é uma string, lá é um objeto),
    // o React Query mistura o cache e este hook recebe um objeto em vez de
    // string, quebrando getPublicUrl (2026-09-26: foi exatamente isso que
    // derrubou a página /administracao).
    queryKey: ["brand-logo-path"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("identidade_visual_site")
        .select("logo_path")
        .eq("id", true)
        .maybeSingle();
      return data?.logo_path as string | null | undefined;
    },
  });
  return typeof logoPath === "string" && logoPath
    ? supabase.storage.from("site_assets").getPublicUrl(logoPath).data.publicUrl
    : "/brand/control-all-network.jfif";
}

export function DynamicFavicon() {
  const src = useBrandLogoUrl();
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = src;
    const caminho = (src.split("?")[0] ?? src).toLowerCase();
    link.type = caminho.endsWith(".png")
      ? "image/png"
      : caminho.endsWith(".svg")
        ? "image/svg+xml"
        : caminho.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
  }, [src]);
  return null;
}

/** Marca visual da Control ALL, com fluxo discreto de luz sobre a rede. */
export function BrandMark({
  className,
  alt = "Control ALL",
}: {
  className?: string;
  alt?: string;
}) {
  const src = useBrandLogoUrl();
  return (
    <span className={cn("brand-mark", className)} aria-label={alt}>
      <img src={src} alt="" className="brand-mark-image" />
      <span aria-hidden="true" className="brand-mark-flow" />
    </span>
  );
}
