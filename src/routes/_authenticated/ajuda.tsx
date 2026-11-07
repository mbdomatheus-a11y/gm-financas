import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Headphones, Search, X } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { filtrarFaq } from "@/lib/ajuda-faq";

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda | Control ALL" },
      { name: "description", content: "Respostas rápidas sobre lançamentos, cartões, previsão do mês, caixinhas e mais." },
    ],
  }),
  component: AjudaPage,
});

function AjudaPage() {
  const [busca, setBusca] = useState("");
  const temas = useMemo(() => filtrarFaq(busca), [busca]);
  const buscando = busca.trim().length > 0;
  const total = temas.reduce((n, t) => n + t.perguntas.length, 0);

  return (
    <AppLayout title="Ajuda" description="Respostas rápidas sobre o Control ALL">
      <div className="mx-auto max-w-2xl">
        <div className="relative mb-8">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na ajuda"
            aria-label="Buscar na ajuda"
            className="h-12 w-full rounded-2xl border bg-card pl-11 pr-11 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {buscando && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {buscando && (
          <p className="mb-4 px-4 text-xs text-muted-foreground">
            {total === 0 ? "Nada encontrado." : `${total} resposta${total === 1 ? "" : "s"} encontrada${total === 1 ? "" : "s"}`}
          </p>
        )}

        {temas.map((tema) => (
          <section key={tema.id} className="mb-8">
            <h2 className="mb-2 px-4 text-sm font-semibold text-muted-foreground">{tema.titulo}</h2>
            <Card className="overflow-hidden rounded-3xl py-0">
              <Accordion key={buscando ? `b:${busca}` : "todas"} type="multiple" defaultValue={buscando ? tema.perguntas.map((p) => p.id) : []}>
                {tema.perguntas.map((p) => (
                  <AccordionItem key={p.id} value={p.id} className="px-5 last:border-b-0">
                    <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                      {p.pergunta}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {p.resposta}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </section>
        ))}

        <Card className="mb-8 flex flex-col items-center gap-3 rounded-3xl px-6 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-primary">
            <Headphones className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-semibold">Não encontrou o que procurava?</p>
            <p className="text-sm text-muted-foreground">Envie um chamado e acompanhe a resposta por aqui.</p>
          </div>
          <Button asChild className="rounded-full px-6">
            <Link to="/suporte">Falar com o suporte</Link>
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}
