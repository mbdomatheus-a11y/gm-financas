import { useState } from "react";
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

  const handleOAuth = async (provider: "google" | "azure" | "apple") => {
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

        {/* Apple */}
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-center gap-2.5 text-xs font-medium hover:bg-muted/60"
          onClick={() => handleOAuth("apple")}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === "apple" ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <svg className="size-4 shrink-0 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.7-11.64-13.99-6.97-10.78-12.01-22.68-15.14-35.69-3.12-13.01-4.69-25.17-4.69-36.48 0-14.47 3.59-26.63 10.77-36.48 7.18-9.85 16.31-14.89 27.39-15.11 5.01 0 10.39 1.25 16.14 3.76 5.75 2.5 9.77 3.82 12.05 3.94 1.85-.12 6.09-1.5 12.72-4.14 6.63-2.64 12.33-3.81 17.1-3.52 12.74.87 22.84 5.92 30.3 15.14-11.09 6.74-16.52 16.03-16.3 27.87.22 9.24 3.79 17.06 10.71 23.47 6.92 6.41 15.12 10.15 24.6 11.22-2.17 6.53-4.8 13.06-7.88 19.59zM119.22 31.84c0-7.39 2.66-14.28 7.98-20.67 5.32-6.39 11.96-10.45 19.92-12.17.65 3.91.76 7.42.33 10.53-.87 6.08-3.69 12.06-8.47 17.93-4.78 5.87-10.87 9.4-18.26 10.59-.22-1.74-.75-3.81-1.5-6.21z" />
            </svg>
          )}
          <span>{labelPrefix} Apple</span>
        </Button>
      </div>
    </div>
  );
}
