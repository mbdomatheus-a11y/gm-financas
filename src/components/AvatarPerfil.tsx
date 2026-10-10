import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuthData";
import { cn } from "@/lib/utils";

const TAMANHO_MAXIMO = 2 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

/** Primeira letra do nome, para quando ainda não há foto. */
function inicial(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  return limpo ? limpo[0]!.toLocaleUpperCase("pt-BR") : "";
}

/**
 * Foto do usuário no canto do site (2026-10-10). Clicar abre Minha conta;
 * o botão da câmera troca a foto na hora, sem sair da tela.
 */
export function AvatarPerfil({
  tamanho = "size-9",
  permitirTroca = true,
  className,
}: {
  tamanho?: string;
  permitirTroca?: boolean;
  className?: string;
}) {
  const { user } = useSession();
  const { data: perfil } = useProfile();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const foto = (perfil as { foto_url?: string | null } | undefined)?.foto_url ?? null;

  async function enviar(arquivo: File | undefined) {
    if (!arquivo || !user?.id) return;
    if (!TIPOS.includes(arquivo.type)) {
      toast.error("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      toast.error("A imagem precisa ter até 2 MB.");
      return;
    }
    setEnviando(true);
    try {
      const extensao = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
      const caminho = `${user.id}/foto-${Date.now()}.${extensao}`;
      const { error: erroUpload } = await supabase.storage
        .from("avatares")
        .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
      if (erroUpload) throw erroUpload;
      const { data: publico } = supabase.storage.from("avatares").getPublicUrl(caminho);
      const { error: erroPerfil } = await supabase
        .from("profiles")
        .update({ foto_url: publico.publicUrl } as never)
        .eq("id", user.id);
      if (erroPerfil) throw erroPerfil;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <Link
        to="/conta"
        aria-label="Abrir minha conta"
        title={perfil?.nome ? `${perfil.nome} — abrir minha conta` : "Abrir minha conta"}
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold text-muted-foreground transition-opacity hover:opacity-90",
          tamanho,
        )}
      >
        {foto ? (
          <img src={foto} alt="" className="size-full object-cover" />
        ) : inicial(perfil?.nome) ? (
          <span aria-hidden="true">{inicial(perfil?.nome)}</span>
        ) : (
          <User className="size-4" aria-hidden="true" />
        )}
      </Link>
      {permitirTroca && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void enviar(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={enviando}
            aria-label="Trocar foto do perfil"
            title="Trocar foto do perfil"
            className="absolute -bottom-1 -right-1 flex size-4.5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            {enviando ? (
              <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-2.5" aria-hidden="true" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
