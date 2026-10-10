import type { ReactNode } from "react";

import { AppLayout } from "@/components/AppLayout";
import { SiteHeader } from "@/components/SiteHeader";
import { useSession } from "@/hooks/useAuthData";

/**
 * Casca das páginas que funcionam com e sem login (2026-10-10).
 *
 * Quem está logado continua dentro do site, com o menu e o cabeçalho de
 * sempre, em vez de ser jogado para fora na página pública. Quem não está
 * logado vê a página pública normal, com o cabeçalho do site.
 */
export function PaginaPublica({
  titulo,
  descricao,
  children,
  largura = "max-w-3xl",
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  /** Largura do conteúdo na versão pública. */
  largura?: string;
}) {
  const { session, loading } = useSession();

  // Enquanto a sessão carrega, mostra só o conteúdo: evita o site piscar
  // entre a versão pública e a de dentro.
  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className={`mx-auto ${largura} px-4 py-12`}>{children}</div>
      </main>
    );
  }

  if (session) {
    return (
      <AppLayout title={titulo} {...(descricao ? { description: descricao } : {})}>
        {children}
      </AppLayout>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className={`mx-auto ${largura} px-4 py-12`}>{children}</div>
    </main>
  );
}
