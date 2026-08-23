import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart, Wallet, ArrowRight } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Finanças do Casal" },
      {
        name: "description",
        content: "Escolha entre acompanhar as finanças do casal ou organizar a lista de compras.",
      },
      { property: "og:title", content: "Início — Finanças do Casal" },
      {
        property: "og:description",
        content: "Central do casal: finanças completas e lista de compras compartilhada.",
      },
    ],
  }),
  component: InicioPage,
});

const AREAS = [
  {
    to: "/dashboard" as const,
    titulo: "Finanças",
    descricao: "Dashboard, receitas, despesas, cartões, investimentos e faturas.",
    icon: Wallet,
  },
  {
    to: "/lista-compras" as const,
    titulo: "Lista de compras",
    descricao: "Alimentação, bens duráveis e diversão — organizados para o casal.",
    icon: ShoppingCart,
  },
];

function InicioPage() {
  return (
    <AppLayout title="Início" description="Por onde você quer começar hoje?">
      <div className="grid gap-4 sm:grid-cols-2">
        {AREAS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="gradient-brand flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold">{a.titulo}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.descricao}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    Entrar <ArrowRight className="size-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppLayout>
  );
}
