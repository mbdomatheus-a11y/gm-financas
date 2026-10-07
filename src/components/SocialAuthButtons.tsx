import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface SocialAuthButtonsProps {
  labelPrefix?: "Entrar com" | "Continuar com" | "Cadastrar com" | undefined;
  className?: string | undefined;
  next?: string | undefined;
}

export function SocialAuthButtons({
  labelPrefix = "Continuar com",
  className = "",
  next,
}: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  // Navegadores embutidos (Instagram, Facebook, TikTok...) são bloqueados pelo Google
  // no login social. Avisamos para abrir no Chrome ou Safari.
  const [navegadorEmbutido, setNavegadorEmbutido] = useState(false);
  useEffect(() => {
    setNavegadorEmbutido(/Instagram|FBAN|FBAV|FB_IAB|TikTok|Line\/|Snapchat|MicroMessenger/i.test(navigator.userAgent));
  }, []);

  const handleOAuth = async (provider: "google" | "azure") => {
    try {
      setLoadingProvider(provider);
      const origin = window.location.origin;
      const redirectUrl = next
        ? `${origin}/entrar?next=${encodeURIComponent(next)}`
        : `${origin}/entrar`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        const msgAmigavel =
          error.message.includes("provider is not enabled") ||
          error.message.includes("validation_failed")
            ? "Login social ainda não está ativo neste ambiente. Use e-mail e senha ou aguarde a ativação."
            : `Falha na autenticação: ${error.message}`;
        toast.error(msgAmigavel);
        setLoadingProvider(null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao conectar conta social");
      setLoadingProvider(null);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">ou acesse com</span>
        </div>
      </div>

      {navegadorEmbutido && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Você está no navegador de um aplicativo (como o Instagram). O login com Google e Microsoft
          pode não funcionar aqui. Toque nos três pontinhos e escolha "Abrir no navegador" (Chrome ou
          Safari), ou crie a conta com e-mail e senha.
        </p>
      )}
      <div className="grid gap-2">
        {/* Google */}
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-center gap-2.5 text-xs font-medium hover:bg-muted/60"
          onClick={() => handleOAuth("google")}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === "google" ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <svg className="size-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{labelPrefix} Google</span>
        </Button>

        {/* Microsoft */}
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-center gap-2.5 text-xs font-medium hover:bg-muted/60"
          onClick={() => handleOAuth("azure")}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === "azure" ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <svg className="size-4 shrink-0" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          )}
          <span>{labelPrefix} Microsoft</span>
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Ao continuar com Google ou Microsoft você concorda com os Termos de Uso e o Aviso de
        Privacidade.
      </p>
    </div>
  );
}
