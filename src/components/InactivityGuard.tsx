import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { obterTempoInatividade } from "@/lib/inatividade.functions";
import { registrarAtividadeSessao, encerrarSessao } from "@/lib/login-protecao.functions";
import { Button } from "@/components/ui/button";

export function InactivityGuard({ children }: { children: ReactNode }) {
  const obterTempo = useServerFn(obterTempoInatividade);
  const registrarAtividade = useServerFn(registrarAtividadeSessao);
  const registrarEncerramento = useServerFn(encerrarSessao);
  const { data } = useQuery({
    queryKey: ["inatividade-minutos"],
    queryFn: () => obterTempo(),
    refetchInterval: 5 * 60 * 1000,
  });
  const limiteMs = Math.max(2, Math.min(120, data?.minutos ?? 5)) * 60 * 1000;
  const ultimoUso = useRef(Date.now());
  const encerrando = useRef(false);
  const [restanteMs, setRestanteMs] = useState(limiteMs);

  async function sair(motivo: "usuario" | "inatividade" = "inatividade") {
    if (encerrando.current) return;
    encerrando.current = true;
    try {
      await registrarEncerramento({ data: { motivo } });
    } catch {
      // O encerramento de autenticação deve prosseguir mesmo se a métrica falhar.
    }
    await supabase.auth.signOut();
    window.location.assign("/entrar");
  }

  useEffect(() => {
    const aoInteragir = () => {
      if (Date.now() - ultimoUso.current >= limiteMs - 60_000) return;
      ultimoUso.current = Date.now();
    };
    const eventos = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    eventos.forEach((evento) => window.addEventListener(evento, aoInteragir, { passive: true }));
    const timer = window.setInterval(() => {
      const restante = Math.max(0, limiteMs - (Date.now() - ultimoUso.current));
      setRestanteMs(restante);
      if (restante === 0) void sair();
    }, 1000);
    const atividadeTimer = window.setInterval(() => {
      if (!encerrando.current && Date.now() - ultimoUso.current < limiteMs - 60_000) {
        void registrarAtividade().catch(() => undefined);
      }
    }, 60_000);
    return () => {
      eventos.forEach((evento) => window.removeEventListener(evento, aoInteragir));
      window.clearInterval(timer);
      window.clearInterval(atividadeTimer);
    };
  }, [limiteMs]);

  const mostrarAviso = restanteMs <= 60_000 && restanteMs > 0;
  return (
    <>
      {children}
      {mostrarAviso && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="inatividade-titulo"
          aria-describedby="inatividade-descricao"
        >
          <div className="w-full max-w-sm rounded-xl bg-background p-6 text-center shadow-2xl">
            <LockKeyhole className="mx-auto mb-3 h-8 w-8 text-amber-600" aria-hidden="true" />
            <h2 id="inatividade-titulo" className="text-lg font-semibold">
              Sua sessão vai terminar
            </h2>
            <p id="inatividade-descricao" className="mt-2 text-sm text-muted-foreground">
              Por segurança, você será desconectado em {Math.ceil(restanteMs / 1000)} segundos sem
              atividade.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" onClick={() => void sair("usuario")}>
                Sair agora
              </Button>
              <Button
                autoFocus
                onClick={() => {
                  ultimoUso.current = Date.now();
                  setRestanteMs(limiteMs);
                  void registrarAtividade().catch(() => undefined);
                }}
              >
                Manter sessão
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
