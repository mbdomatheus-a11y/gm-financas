import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LINK_TESTFLIGHT } from "@/lib/testflight.functions";
import { LINK_TESTE_ANDROID } from "@/lib/beta-android";

export const Route = createFileRoute("/_authenticated/compartilhar")({
  head: () => ({
    meta: [
      { title: "Indicar o Control ALL | Control ALL" },
      { name: "description", content: "Indique o Control ALL para amigos e família pelo WhatsApp ou copiando o link." },
      { property: "og:title", content: "Indicar o Control ALL" },
      { property: "og:description", content: "Mande o Control ALL para quem quer organizar o dinheiro." },
    ],
  }),
  component: IndicarPage,
});

const SITE = "https://www.controlall.com.br";

const MENSAGEM_PADRAO = `Estou usando o Control ALL para organizar minhas contas e saber quanto vai sobrar no mês. Vale conhecer!

Site: ${SITE}
iPhone (TestFlight): ${LINK_TESTFLIGHT}
Android (Google Play): ${LINK_TESTE_ANDROID}`;

function IndicarPage() {
  const [texto, setTexto] = useState(MENSAGEM_PADRAO);
  const podeNativo = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };
  const nativo = async () => {
    try {
      await navigator.share({ title: "Control ALL", text: texto, url: SITE });
    } catch {
      /* cancelado pela pessoa */
    }
  };

  return (
    <AppLayout title="Indicar o Control ALL" description="Mande o app para quem quer organizar o dinheiro">
      <Card className="max-w-2xl rounded-3xl">
        <CardContent className="space-y-4 p-6">
          <label htmlFor="msg-indicacao" className="text-sm font-medium">
            Mensagem (você pode editar)
          </label>
          <Textarea id="msg-indicacao" value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={whatsapp}>
              <MessageCircle className="size-4" /> Enviar no WhatsApp
            </Button>
            {podeNativo && (
              <Button variant="secondary" onClick={nativo}>
                <Share2 className="size-4" /> Compartilhar
              </Button>
            )}
            <Button variant="outline" onClick={copiarLink}>
              <Copy className="size-4" /> Copiar link
            </Button>
            <Button variant="ghost" onClick={() => setTexto(MENSAGEM_PADRAO)}>
              Restaurar mensagem
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Isto apresenta o app. Para convidar alguém para o seu grupo, use os convites em Usuários e grupo.
          </p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
