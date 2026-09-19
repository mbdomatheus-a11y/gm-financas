import { cn } from "@/lib/utils";

/** Marca visual da Control ALL, com fluxo discreto de luz sobre a rede. */
export function BrandMark({ className, alt = "Control ALL" }: { className?: string; alt?: string }) {
  return <span className={cn("brand-mark", className)} aria-label={alt}>
    <img src="/brand/control-all-network.jfif" alt="" className="brand-mark-image" />
    <span aria-hidden="true" className="brand-mark-flow" />
  </span>;
}
