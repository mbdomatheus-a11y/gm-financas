import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PaginaPublica } from "@/components/PaginaPublica";
import { TextoFormatado } from "@/components/TextoFormatado";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { copiarTextoCompleto } from "@/lib/copiar-texto";
import { abrirNotaPublica } from "@/lib/links-admin.functions";

/**
 * Leitura pública de uma anotação compartilhada pela administração
 * (2026-10-10). Funciona sem conta; quem já está logado continua dentro do
 * site, com o menu de sempre.
 */
export const Route = createFileRoute("/nota/$token")({
  head: () => ({
    meta: [{ title: "Anotação compartilhada | Control ALL" }, { name: "robots", content: "noindex" }],
  }),
  component: NotaPublicaPage,
});

function NotaPublicaPage() {
  const { token } = Route.useParams();
  const abrir = useServerFn(abrirNotaPublica);
  const valido = /^[a-f0-9]{16,64}$/i.test(token);
  const { data, isLoading } = useQuery({
    queryKey: ["nota-publica", token],
    queryFn: () => abrir({ data: { token } }),
    enabled: valido,
    retry: false,
  });
  const ok = data?.status === "ok" ? data : null;

  return (
    <PaginaPublica
      titulo={ok?.titulo ?? "Anotação"}
      descricao="Anotação compartilhada pela administração do Control ALL."
      largura="max-w-2xl"
    >
      <Card>
        <CardContent className="space-y-3 p-5">
          {!valido || data?.status === "nao_encontrado" ? (
            <p className="text-sm">
              Esta anotação não está mais compartilhada. Peça um link novo a quem enviou.
            </p>
          ) : data?.status === "expirado" ? (
            <p className="text-sm">Esta anotação expirou.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : ok ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">{ok.titulo}</h1>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const texto = `${ok.titulo}\n\n${ok.conteudo}`;
                    if (await copiarTextoCompleto(texto)) toast.success("Nota inteira copiada.");
                    else toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
                  }}
                >
                  <Copy className="mr-1.5 size-4" aria-hidden="true" /> Copiar nota toda
                </Button>
              </div>
              <TextoFormatado texto={ok.conteudo} emCaixa />
            </>
          ) : null}
        </CardContent>
      </Card>
    </PaginaPublica>
  );
}
