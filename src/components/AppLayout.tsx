import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { encerrarSessao } from "@/lib/login-protecao.functions";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PiggyBank,
  Share2,
  Users,
  Palette,
  Settings,
  LogOut,
  Menu,
  Wallet,
  Tags,
  FileUp,
  Home,
  ShoppingCart,
  DatabaseBackup,
  ReceiptText,
  ArrowLeftRight,
  Calculator,
  Car,
  PawPrint,
  MapPin,
  FileHeart,
  ShieldCheck,
  Headphones,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  useModulosGlobais,
  useProfile,
  usePermissoes,
  type Modulo,
  type ModuloGlobal,
} from "@/hooks/useAuthData";
import { useApplyPreferencias, usePreferencias } from "@/hooks/usePreferencias";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AlertsBell } from "@/components/AlertsBell";
import { BrandMark } from "@/components/BrandMark";

type NavTo =
  | "/inicio"
  | "/dashboard"
  | "/receitas"
  | "/despesas"
  | "/importar"
  | "/categorias"
  | "/de-para"
  | "/lista-compras"
  | "/notas"
  | "/cartoes"
  | "/investimentos"
  | "/veiculos"
  | "/compartilhar"
  | "/ferramentas"
  | "/usuarios"
  | "/backup"
  | "/personalizacao"
  | "/conta"
  | "/pets"
  | "/onde-esta"
  | "/exames"
  | "/administracao"
  | "/suporte";

type NavItem = {
  to: NavTo;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  modulo?: Modulo;
  adminOnly?: boolean;
  moduloGlobal?: ModuloGlobal;
};

type MundoId = "financas" | "lista" | "notas" | "calculadora" | "vida";

/**
 * Navegação em "mundos" (2026-09-18): em vez de uma lista única com tudo
 * misturado, a Home mostra só 4 caixas (Finanças, Lista, Notas fiscais e Calculadora) e,
 * dentro de cada uma, o menu lateral passa a mostrar só os itens daquele
 * mundo — pra não misturar despesas/investimentos com a lista de compras,
 * por exemplo. "Início" fica sempre fixo no topo do menu como botão de
 * voltar. Ferramentas administrativas/utilitárias (Compartilhar,
 * Usuários, Backup, Personalização, Conta) ficam numa seção
 * global, visível o tempo todo, independente do mundo atual.
 */
const MUNDOS: Record<MundoId, { titulo: string; home: NavTo; items: NavItem[] }> = {
  financas: {
    titulo: "Finanças",
    home: "/dashboard",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        short: "Dashboard",
        icon: LayoutDashboard,
        moduloGlobal: "financas",
      },
      {
        to: "/receitas",
        label: "Receitas",
        short: "Receitas",
        icon: TrendingUp,
        modulo: "receitas",
      },
      {
        to: "/despesas",
        label: "Despesas",
        short: "Despesas",
        icon: TrendingDown,
        modulo: "despesas",
      },
      {
        to: "/importar",
        label: "Importar Faturas",
        short: "Faturas",
        icon: FileUp,
        modulo: "despesas",
      },
      { to: "/categorias", label: "Categorias", short: "Categ.", icon: Tags },
      {
        to: "/de-para",
        label: "De-para de categorias",
        short: "De-para",
        icon: ArrowLeftRight,
        modulo: "despesas",
      },
      {
        to: "/cartoes",
        label: "Cartões e Bancos",
        short: "Cartões",
        icon: CreditCard,
        modulo: "cartoes",
      },
      {
        to: "/investimentos",
        label: "Investimentos",
        short: "Invest.",
        icon: PiggyBank,
        modulo: "investimentos",
      },
      {
        to: "/veiculos",
        label: "Meu Veículo",
        short: "Veículo",
        icon: Car,
        modulo: "veiculos",
        moduloGlobal: "veiculo",
      },
    ],
  },
  lista: {
    titulo: "Lista de compras",
    home: "/lista-compras",
    items: [
      {
        to: "/lista-compras",
        label: "Lista de compras",
        short: "Compras",
        icon: ShoppingCart,
        moduloGlobal: "lista",
      },
    ],
  },
  notas: {
    titulo: "Notas fiscais",
    home: "/notas",
    items: [
      {
        to: "/notas",
        label: "Notas fiscais",
        short: "Notas",
        icon: ReceiptText,
        moduloGlobal: "notas",
      },
    ],
  },
  calculadora: {
    titulo: "Calculadora",
    home: "/ferramentas",
    items: [
      {
        to: "/ferramentas",
        label: "Calculadora",
        short: "Calculadora",
        icon: Calculator,
        moduloGlobal: "calculadora",
      },
    ],
  },
  vida: {
    titulo: "Vida",
    home: "/pets",
    items: [
      { to: "/pets", label: "Pet", short: "Pet", icon: PawPrint, moduloGlobal: "pet" },
      {
        to: "/onde-esta",
        label: "Onde está?",
        short: "Onde",
        icon: MapPin,
        moduloGlobal: "onde_esta",
      },
      { to: "/exames", label: "Exames", short: "Exames", icon: FileHeart, moduloGlobal: "exames" },
    ],
  },
};

/** Itens sempre visíveis, independente do mundo atual (ou de estar na Home). */
const GLOBAL: NavItem[] = [
  {
    to: "/compartilhar",
    label: "Compartilhar",
    short: "Compart.",
    icon: Share2,
    modulo: "compartilhar",
  },
  {
    to: "/usuarios",
    label: "Usuários e Privilégios",
    short: "Usuários",
    icon: Users,
    adminOnly: true,
  },
  {
    to: "/administracao",
    label: "Administração do site",
    short: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
  {
    to: "/backup",
    label: "Backup e Reset",
    short: "Backup",
    icon: DatabaseBackup,
    adminOnly: true,
  },
  {
    to: "/personalizacao",
    label: "Personalização",
    short: "Tema",
    icon: Palette,
    modulo: "personalizacao",
  },
  { to: "/conta", label: "Configurações da conta", short: "Conta", icon: Settings },
  { to: "/suporte", label: "Suporte", short: "Suporte", icon: Headphones },
];

const INICIO: NavItem = { to: "/inicio", label: "Início", short: "Início", icon: Home };

/** Descobre em qual "mundo" a rota atual está, se estiver em algum. */
function mundoAtual(pathname: string): MundoId | null {
  for (const [id, mundo] of Object.entries(MUNDOS) as [MundoId, (typeof MUNDOS)[MundoId]][]) {
    if (mundo.items.some((i) => i.to === pathname)) return id;
  }
  return null;
}

export function AppLayout({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  useApplyPreferencias();
  const { prefs } = usePreferencias();
  const { data: profile } = useProfile();
  const { can, isSiteAdmin } = usePermissoes();
  const { habilitado } = useModulosGlobais();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const registrarEncerramento = useServerFn(encerrarSessao);
  const [open, setOpen] = useState(false);
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;

  // Preserva o caminho atual e parâmetros para recuperar se a sessão for reconectada
  if (typeof window !== "undefined" && pathname && pathname !== "/entrar" && pathname !== "/") {
    const currentFullUrl = `${location.pathname}${location.searchStr ?? ""}`;
    sessionStorage.setItem("control-all-return-url", currentFullUrl);
  }

  const podeVer = (i: NavItem) => {
    if (i.adminOnly) return isSiteAdmin;
    if (i.moduloGlobal && !habilitado(i.moduloGlobal)) return false;
    if (i.modulo) return can(i.modulo, "ver");
    return true;
  };

  const mundoId = mundoAtual(pathname);
  const mundo = mundoId ? MUNDOS[mundoId] : null;
  const mundoGlobal: Partial<Record<MundoId, ModuloGlobal>> = {
    financas: "financas",
    lista: "lista",
    notas: "notas",
    calculadora: "calculadora",
  };
  const mundoVisivel = (id: MundoId) => {
    const m = MUNDOS[id];
    const global = mundoGlobal[id];
    if (global && !habilitado(global)) return false;
    return m.items.filter(podeVer).length > 0;
  };
  const mundosVisiveis = (Object.keys(MUNDOS) as MundoId[]).filter(mundoVisivel);
  const itensDoMundo = (
    mundo && (!mundoId || !mundoGlobal[mundoId] || habilitado(mundoGlobal[mundoId]!))
      ? mundo.items
      : []
  ).filter(podeVer);
  const itensGlobais = GLOBAL.filter(podeVer);

  const mobileItems = [INICIO, ...(mundo ? itensDoMundo : itensGlobais).slice(0, 3)];
  const bottomNav = prefs.layout_menu === "bottom";

  async function signOut() {
    try {
      await registrarEncerramento({ data: { motivo: "usuario" } });
    } catch {
      // Falha de telemetria não impede sair.
    }
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    sessionStorage.removeItem("control-all-sessao-iniciada");
    sessionStorage.removeItem("control-all-sessao-max-min");
    navigate({ to: "/entrar", replace: true });
  }

  const NavLink = ({
    item,
    onNavigate,
  }: {
    item: NavItem;
    onNavigate?: (() => void) | undefined;
  }) => {
    const active = pathname === item.to;
    const Icon = item.icon;
    return (
      <Link
        to={item.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("size-4.5 shrink-0", active && "text-primary")} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: (() => void) | undefined }) => (
    <nav className="flex flex-1 flex-col gap-1">
      <NavLink item={INICIO} onNavigate={onNavigate} />

      {mundo && itensDoMundo.length > 0 && (
        <>
          <p className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {mundo.titulo}
          </p>
          {itensDoMundo.map((item) => (
            <NavLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </>
      )}

      <p className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        Geral
      </p>
      {itensGlobais.map((item) => (
        <NavLink key={item.to} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );

  const SidebarInner = ({ onNavigate }: { onNavigate?: (() => void) | undefined }) => (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-2 py-1">
        <BrandMark className="size-9 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">Control ALL</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.nome ?? ""}</p>
        </div>
      </Link>
      <NavLinks onNavigate={onNavigate} />
      <Button
        variant="ghost"
        className="justify-start gap-3 text-muted-foreground"
        onClick={signOut}
      >
        <LogOut className="size-4.5" /> Sair
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {!bottomNav && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
          <SidebarInner />
        </aside>
      )}

      <div className={cn(!bottomNav && "lg:pl-64")}>
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(!bottomNav && "lg:hidden")}
                  aria-label="Abrir menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SidebarInner onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{title}</h1>
              {description && (
                <p className="truncate text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AlertsBell />
              {actions}
            </div>
          </div>

          {/* Alternador de módulos (2026-09-26): antes, ao entrar num módulo
              (ex.: Finanças), os outros módulos (Lista, Onde está?, Exames…)
              desapareciam do menu lateral e só voltavam pela Início. Esta
              barra fica sempre visível no topo, mostra em qual módulo você
              está (destacado) e deixa pular pra qualquer outro em 1 clique. */}
          {mundosVisiveis.length > 0 && (
            <nav
              aria-label="Módulos"
              className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {mundosVisiveis.map((id) => {
                const m = MUNDOS[id];
                const Icon = m.items[0]!.icon;
                const ativo = mundoId === id;
                return (
                  <Link
                    key={id}
                    to={m.home}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      ativo
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {m.titulo}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 lg:pb-10">{children}</main>
      </div>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md",
          !bottomNav && "lg:hidden",
        )}
      >
        {mobileItems.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
