import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Palette, Settings } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissoes } from "@/hooks/useAuthData";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Control ALL" },
      {
        name: "description",
        content: "Configurações da conta e personalização do aplicativo.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

/**
 * Hub de "Configurações" (Item 3 da Frente 4, plano de 2026-10-02): agrupa,
 * num único ponto de entrada pro usuário comum, as telas de Conta e
 * Personalização — que antes apareciam soltas na navegação "Geral".
 *
 * Backup/Usuários/Administração ficam DE FORA desse agrupamento de
 * propósito: são ferramentas administrativas (gated por `isAdmin`/
 * `isSiteAdmin` em `AppLayout.tsx`/`inicio.tsx`, não por módulo de usuário
 * comum), não "configurações pessoais" — misturá-las aqui confundiria o
 * escopo do hub. `/conta` e `/personalizacao` continuam existindo como
 * rotas próprias (link direto ainda funciona), este hub só lhes dá uma
 * porta de entrada comum na navegação.
 */
function ConfiguracoesPage() {
  const { can } = usePermissoes();

  const itens = [
    {
      to: "/conta" as const,
      label: "Conta",
      descricao: "Dados pessoais, senha, segurança e preferências de IA.",
      icon: Settings,
    },
    ...(can("personalizacao", "ver")
      ? [
          {
            to: "/personalizacao" as const,
            label: "Personalização",
            descricao: "Tema, paleta de cores, fonte e layout do menu.",
            icon: Palette,
          },
        ]
      : []),
  ];

  return (
    <AppLayout title="Configurações" description="Conta e personalização do aplicativo">
      <div className="grid gap-4 sm:grid-cols-2">
        {itens.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="gradient-brand flex size-12 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">{item.label}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.descricao}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppLayout>
  );
}
