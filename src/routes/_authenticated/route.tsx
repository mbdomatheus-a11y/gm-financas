import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { InactivityGuard } from "@/components/InactivityGuard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/entrar" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("senha_temporaria")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.senha_temporaria && location.pathname !== "/nova-senha") {
      throw redirect({ to: "/nova-senha" });
    }
    return { user: data.user };
  },
  component: () => (
    <InactivityGuard>
      <Outlet />
    </InactivityGuard>
  ),
});
