import { createFileRoute, notFound } from "@tanstack/react-router";

import { PaginaBio } from "@/components/PaginaBio";
import { obterBioPublica } from "@/lib/bio.functions";

/**
 * Página de links da bio (19/11/2026). Só por link direto: fora do menu do site, fora do app e fora dos
 * buscadores (noindex). O aviso de privacidade é o mesmo do Control ALL (vem do layout raiz).
 * Cada clique passa por /api/bio-ir, que registra e redireciona.
 */
const cabecalho = ({ loaderData }: { loaderData?: { titulo: string; bio: string; foto: string | null } | undefined }) => ({
  meta: [
    { title: loaderData?.titulo || "Links" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "description", content: loaderData?.bio || "Meus links" },
    { property: "og:title", content: loaderData?.titulo || "Links" },
    { property: "og:description", content: loaderData?.bio || "Meus links" },
    ...(loaderData?.foto ? [{ property: "og:image", content: loaderData.foto }] : []),
  ],
});
const naoEncontrada = () => (
  <main className="grid min-h-dvh place-items-center bg-neutral-950 p-6 text-center text-neutral-300">
    <p>Página não encontrada.</p>
  </main>
);

export const Route = createFileRoute("/bio/$slug")({
  loader: async ({ params }) => {
    const pagina = await obterBioPublica({ data: { slug: String(params.slug).toLowerCase() } });
    if (!pagina) throw notFound();
    return pagina;
  },
  head: cabecalho,
  notFoundComponent: naoEncontrada,
  component: () => <PaginaBio p={Route.useLoaderData()} />,
});
