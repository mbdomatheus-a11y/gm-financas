import { supabase } from "@/integrations/supabase/client";

/** Normaliza o caminho: troca ids (uuid e numeros) por :id. */
export function telaNormalizada(path: string): string {
  return (
    path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:id")
      .slice(0, 120) || "/"
  );
}

/** Coleta Web Vitals da página e envia 1 lote por página (visibilitychange hidden). Nunca bloqueia nem lança. */
export function iniciarColetaDesempenho(): () => void {
  if (typeof window === "undefined") return () => {};
  const tela = telaNormalizada(window.location.pathname);
  const lote = new Map<string, number>();
  let enviado = false;
  let cancelado = false;

  const enviar = () => {
    if (enviado || lote.size === 0) return;
    enviado = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user.id;
        if (!uid) return; // só usuário logado
        const conexao = (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null;
        const linhas = [...lote.entries()].map(([metrica, valor]) => ({
          user_id: uid,
          plataforma: "web",
          tela,
          metrica,
          valor,
          versao: (import.meta.env["VITE_APP_VERSION"] as string | undefined) ?? null,
          conexao,
        }));
        await supabase.from("desempenho_metricas" as never).insert(linhas as never);
      } catch {
        /* telemetria nunca interfere na tela */
      }
    })();
  };

  const onHidden = () => {
    if (document.visibilityState === "hidden") enviar();
  };

  void import("web-vitals")
    .then(({ onLCP, onINP, onCLS, onTTFB, onFCP }) => {
      if (cancelado) return;
      const reg = (m: { name: string; value: number }) => lote.set(m.name, m.value);
      onLCP(reg);
      onINP(reg);
      onCLS(reg);
      onTTFB(reg);
      onFCP(reg);
    })
    .catch(() => {});
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", enviar);
  return () => {
    cancelado = true;
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", enviar);
    enviar();
  };
}
