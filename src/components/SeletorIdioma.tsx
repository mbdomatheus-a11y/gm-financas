import { Check, Languages } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IDIOMAS, infoIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/traducoes";
import { useIdioma } from "@/hooks/useIdioma";
import { cn } from "@/lib/utils";

/** Troca o idioma do site e guarda a escolha na conta e no navegador. */
export function SeletorIdioma({
  className,
  mostrarNome = false,
}: {
  className?: string;
  mostrarNome?: boolean;
}) {
  const { idioma, automatico, definir, t } = useIdioma();
  const atual = infoIdioma(idioma);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={mostrarNome ? "sm" : "icon"}
          className={cn(mostrarNome ? "gap-1.5" : "size-9", className)}
          aria-label={t("idioma.escolher")}
          title={t("idioma.escolher")}
        >
          <Languages className="size-4" aria-hidden="true" />
          {mostrarNome && <span className="text-xs">{atual.nome}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          {t("idioma.titulo")}
          {automatico && (
            <span className="text-[10px] font-normal text-muted-foreground">
              {atual.nomeEmIngles}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {IDIOMAS.map((i) => (
          <DropdownMenuItem
            key={i.codigo}
            onClick={() => {
              definir(i.codigo);
              toast.success(traduzir("idioma.salvo", i.codigo));
            }}
            className="gap-2"
          >
            <span aria-hidden="true">{i.bandeira}</span>
            <span className="flex-1">{i.nome}</span>
            {i.codigo === idioma && <Check className="size-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
          {t("idioma.parcial")}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
