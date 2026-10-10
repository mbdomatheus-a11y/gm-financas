import { createFileRoute } from "@tanstack/react-router";

import { AreaHub } from "@/components/AreaHub";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos | Control ALL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <AreaHub area="documentos" />,
});
