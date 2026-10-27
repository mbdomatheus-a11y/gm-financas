import { Link } from "@tanstack/react-router";
import {
  Check,
  DatabaseBackup,
  Headphones,
  Languages,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/useAuthData";
import { useIdioma } from "@/hooks/useIdioma";
import { IDIOMAS, infoIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/traducoes";
import { ADMIN_ONLY_TAG } from "@/lib/areas";
import { cn } from "@/lib/utils";

/**
 * Menu da foto do usuário (27/10/2026): conta, configurações, idioma, grupo, backup, suporte e,
 * para o admin do site, a Administração. Tira esses itens do menu lateral para deixá-lo enxuto.
 */
export function MenuUsuario({
  isAdmin,
  isSiteAdmin,
  modoCliente,
  onSair,
  className,
}: {
  isAdmin: boolean;
  isSiteAdmin: boolean;
  modoCliente: boolean;
  onSair: () => void;
  className?: string;
}) {
  const { data: perfil } = useProfile();
  const { idioma, definir } = useIdioma();
  const foto = (perfil as { foto_url?: string | null } | undefined)?.foto_url ?? null;
  const nome = (perfil as { nome?: string | null } | undefined)?.nome ?? "";
  const inicial = nome.trim() ? nome.trim()[0]!.toLocaleUpperCase("pt-BR") : "";
  const grupoAdmin = isAdmin && !modoCliente;
  const siteAdmin = isSiteAdmin && !modoCliente;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menu da conta"
        title={nome ? `${nome}: conta, configurações e idioma` : "Conta, configurações e idioma"}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold text-muted-foreground outline-none ring-primary transition hover:ring-2 focus-visible:ring-2",
          className,
        )}
      >
        {foto ? (
          <img src={foto} alt="" className="size-full object-cover" />
        ) : inicial ? (
          <span aria-hidden="true">{inicial}</span>
        ) : (
          <User className="size-4" aria-hidden="true" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate">{nome || "Minha conta"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/conta" className="flex items-center gap-2">
            <UserCog className="size-4" aria-hidden="true" /> Minha conta e foto
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/configuracoes" className="flex items-center gap-2">
            <Settings className="size-4" aria-hidden="true" /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            <Languages className="size-4" aria-hidden="true" /> Idioma
            <span className="ml-auto text-xs text-muted-foreground">{infoIdioma(idioma).bandeira}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {IDIOMAS.map((i) => (
              <DropdownMenuItem
                key={i.codigo}
                className="gap-2"
                onClick={() => {
                  definir(i.codigo);
                  toast.success(traduzir("idioma.salvo", i.codigo));
                }}
              >
                <span aria-hidden="true">{i.bandeira}</span>
                <span className="flex-1">{i.nome}</span>
                {i.codigo === idioma && <Check className="size-4 text-primary" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {grupoAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/usuarios" className="flex items-center gap-2">
                <Users className="size-4" aria-hidden="true" /> Meu grupo e permissões
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/backup" className="flex items-center gap-2">
                <DatabaseBackup className="size-4" aria-hidden="true" /> Backup e Reset
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/suporte" className="flex items-center gap-2">
            <Headphones className="size-4" aria-hidden="true" /> Suporte
          </Link>
        </DropdownMenuItem>
        {siteAdmin && (
          <DropdownMenuItem asChild className="bg-violet-500/[0.07]">
            <Link to="/administracao" search={{ aba: undefined }} className="flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" /> Administração do site
              <span className={cn(ADMIN_ONLY_TAG, "ml-auto")}>Admin</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSair()} className="gap-2">
          <LogOut className="size-4" aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
