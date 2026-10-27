import { createFileRoute } from "@tanstack/react-router";

import { ConteudoBancosPluggy } from "@/components/BancosPluggy";

export const Route = createFileRoute("/_authenticated/pluggy")({
  head: () => ({ meta: [{ title: "Bancos (teste) | Control ALL" }, { name: "robots", content: "noindex" }] }),
  component: PluggyPage,
});

function PluggyPage() {
  return <ConteudoBancosPluggy />;
}
