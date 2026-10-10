import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/AppLayout";
import { HomeWidgets } from "@/components/HomeWidgets";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início | Control ALL" },
      { name: "description", content: "Escolha o que deseja acessar." },
      { property: "og:title", content: "Início | Control ALL" },
      { property: "og:description", content: "Central de acesso do Control ALL." },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  return (
    <AppLayout title="Início" description="Escolha o que deseja acessar">
      <HomeWidgets />
    </AppLayout>
  );
}
