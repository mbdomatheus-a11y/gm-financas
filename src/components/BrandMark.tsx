import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Marca visual da Control ALL, com fluxo discreto de luz sobre a rede. */
export function BrandMark({ className, alt = "Control ALL" }: { className?: string; alt?: string }) {
  const { data: logoPath } = useQuery({
    queryKey: ["identidade-visual-site"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("identidade_visual_site").select("logo_path").eq("id", true).maybeSingle();
      return data?.logo_path as string | null | undefined;
    },
  });
  const src = logoPath ? supabase.storage.from("site_assets").getPublicUrl(logoPath).data.publicUrl : "/brand/control-all-network.jfif";
  return <span className={cn("brand-mark", className)} aria-label={alt}>
    <img src={src} alt="" className="brand-mark-image" />
    <span aria-hidden="true" className="brand-mark-flow" />
  </span>;
}
