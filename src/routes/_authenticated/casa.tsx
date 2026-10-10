import { createFileRoute } from "@tanstack/react-router";

import { AreaHub } from "@/components/AreaHub";

export const Route = createFileRoute("/_authenticated/casa")({
  head: () => ({
    meta: [
      { title: "Casa e vida | Control ALL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <AreaHub area="casa" />,
});
