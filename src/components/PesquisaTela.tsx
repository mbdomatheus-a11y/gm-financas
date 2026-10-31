import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Estado = "perguntar" | "comentar" | "obrigado";

// Versão para o benchmark do site: mês do deploy em uso (o app usa o número da versão).
const VERSAO_SITE = `web-${new Date().toISOString().slice(0, 7)}`;

/**
 * Pesquisa "Está gostando desta tela?" com joinha no fim das páginas (31/10/2026, igual ao app iPhone e
 * Android). Grava em avaliacoes_tela: uma opinião por pessoa, tela, plataforma e versão.
 */
export function PesquisaTela() {
  const caminho = useRouterState({ select: (s) => s.location.pathname }).replace(/\/$/, "") || "/";
  const tela = caminho.slice(0, 120);
  const chave = `control-all.pesquisa.web.${VERSAO_SITE}.${tela}`;
  const [estado, setEstado] = useState<Estado>("perguntar");
  const [voto, setVoto] = useState<1 | -1 | null>(null);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    setComentario("");
    try {
      const v = localStorage.getItem(chave);
      if (v === "1" || v === "-1") {
        setVoto(Number(v) as 1 | -1);
        setEstado("obrigado");
        return;
      }
    } catch {
      /* navegador sem armazenamento */
    }
    setVoto(null);
    setEstado("perguntar");
  }, [chave]);

  async function gravar(v: 1 | -1, texto?: string) {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;
      await (supabase as any).from("avaliacoes_tela").upsert(
        {
          user_id: uid,
          plataforma: "web",
          tela,
          voto: v,
          comentario: texto?.trim() ? texto.trim().slice(0, 500) : null,
          versao: VERSAO_SITE,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "user_id,plataforma,tela,versao" },
      );
      try {
        localStorage.setItem(chave, String(v));
      } catch {
        /* ignora */
      }
    } catch {
      /* sem rede: não atrapalha o uso */
    }
  }

  function votar(v: 1 | -1) {
    setVoto(v);
    void gravar(v);
    setEstado(v === 1 ? "obrigado" : "comentar");
  }

  return (
    <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
      {estado === "perguntar" ? (
        <>
          <p className="font-medium">Está gostando desta tela?</p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => votar(1)} aria-label="Gostei">
              <ThumbsUp className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => votar(-1)} aria-label="Não gostei">
              <ThumbsDown className="size-4" />
            </Button>
          </div>
        </>
      ) : estado === "comentar" ? (
        <>
          <p className="font-medium">O que podemos melhorar aqui? (opcional)</p>
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Conte em poucas palavras"
          />
          <Button
            size="sm"
            onClick={() => {
              if (comentario.trim()) void gravar(-1, comentario);
              setEstado("obrigado");
            }}
          >
            {comentario.trim() ? "Enviar" : "Pular"}
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          {voto === 1 ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />}
          <span>Obrigado pela sua opinião!</span>
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setEstado("perguntar")}>
            Mudar
          </button>
        </div>
      )}
    </div>
  );
}
