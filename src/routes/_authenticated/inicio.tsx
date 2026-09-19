import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, DatabaseBackup, Palette, ReceiptText, Settings, Share2, ShoppingCart, Users, Wallet } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissoes } from "@/hooks/useAuthData";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início | Control ALL" },
      { name: "description", content: "Escolha o módulo que deseja acessar." },
      { property: "og:title", content: "Início | Control ALL" },
      { property: "og:description", content: "Central de acesso aos módulos do Control ALL." },
    ],
  }),
  component: InicioPage,
});

const MODULOS = [
  { to: "/dashboard" as const, titulo: "Finanças", descricao: "Receitas, despesas, cartões, investimentos, faturas e veículos.", icon: Wallet },
  { to: "/lista-compras" as const, titulo: "Lista", descricao: "Lista de compras compartilhada e aprovações.", icon: ShoppingCart },
  { to: "/notas" as const, titulo: "Notas", descricao: "Notas fiscais, comprovantes e garantias.", icon: ReceiptText },
  { to: "/ferramentas" as const, titulo: "Calculadora", descricao: "Cálculos de datas, horários e simulações.", icon: Calculator },
];

function InicioPage() {
  const { can, isAdmin } = usePermissoes();
  const gerais = [
    { to: "/compartilhar" as const, label: "Compartilhar", icon: Share2, modulo: "compartilhar" as const },
    { to: "/usuarios" as const, label: "Usuários e Privilégios", icon: Users, adminOnly: true },
    { to: "/backup" as const, label: "Backup e Reset", icon: DatabaseBackup, adminOnly: true },
    { to: "/personalizacao" as const, label: "Personalização", icon: Palette, modulo: "personalizacao" as const },
    { to: "/conta" as const, label: "Configurações da conta", icon: Settings },
  ].filter((item) => {
    if ("adminOnly" in item && item.adminOnly) return isAdmin;
    if ("modulo" in item && item.modulo) return can(item.modulo, "ver");
    return true;
  });

  return (
    <AppLayout title="Início" description="Escolha o que deseja acessar">
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MODULOS.map((modulo) => {
          const Icon = modulo.icon;
          return (
            <Link key={modulo.to} to={modulo.to}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex h-full min-h-44 flex-col gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <div className="gradient-brand flex size-12 items-center justify-center rounded-xl">
                      <Icon className="size-6 text-primary-foreground" />
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">Entrar <ArrowRight className="size-3.5" /></span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{modulo.titulo}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{modulo.descricao}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {gerais.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Geral</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {gerais.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to}>
                  <Card className="h-full transition-colors hover:bg-muted/40">
                    <CardContent className="flex flex-col items-center gap-1.5 p-3 text-center">
                      <Icon className="size-4.5 text-muted-foreground" />
                      <span className="text-xs font-medium leading-tight">{item.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
