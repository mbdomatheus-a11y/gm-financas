import { useState, type ReactNode } from "react";
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
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, usePermissoes, type Modulo } from "@/hooks/useAuthData";
import { useApplyPreferencias, usePreferencias } from "@/hooks/usePreferencias";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

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
  | "/conta";

type NavItem = {
  to: NavTo;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  modulo?: Modulo;
  adminOnly?: boolean;
};

type MundoId = "financas" | "lista" | "notas" | "calculadora";

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
      { to: "/dashboard", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
      { to: "/receitas", label: "Receitas", short: "Receitas", icon: TrendingUp, modulo: "receitas" },
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
      { to: "/veiculos", label: "Meu Veículo", short: "Veículo", icon: Car, modulo: "veiculos" },
    ],
  },
  lista: {
    titulo: "Lista de compras",
    home: "/lista-compras",
    items: [
      { to: "/lista-compras", label: "Lista de compras", short: "Compras", icon: ShoppingCart },
    ],
  },
  notas: {
    titulo: "Notas fiscais",
    home: "/notas",
    items: [{ to: "/notas", label: "Notas fiscais", short: "Notas", icon: ReceiptText }],
  },
  calculadora: {
    titulo: "Calculadora",
    home: "/ferramentas",
    items: [{ to: "/ferramentas", label: "Calculadora", short: "Calculadora", icon: Calculator }],
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
  const { can, isAdmin } = usePermissoes();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const podeVer = (i: NavItem) => {
    if (i.adminOnly) return isAdmin;
    if (i.modulo) return can(i.modulo, "ver");
    return true;
  };

  const mundoId = mundoAtual(pathname);
  const mundo = mundoId ? MUNDOS[mundoId] : null;
  const itensDoMundo = (mundo?.items ?? []).filter(podeVer);
  const itensGlobais = GLOBAL.filter(podeVer);

  const mobileItems = [
    INICIO,
    ...(mundo ? itensDoMundo : itensGlobais).slice(0, 3),
  ];
  const bottomNav = prefs.layout_menu === "bottom";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
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
        <div className="gradient-brand flex size-9 items-center justify-center rounded-xl">
          <Wallet className="size-4.5 text-primary-foreground" />
        </div>
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
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-md">
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
            {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
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
