import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import { acharBanco, idBanco } from "@/lib/bancos-catalogo";

/**
 * Logos dos bancos do bucket "logos-bancos" (14/11/2026). A tabela logos_bancos é lida uma vez por sessão
 * (e de novo a cada 6 h) e fica em memória. Mesmo esquema no app (src/lib/logos-bancos-cache.ts).
 */
type Linha = { chave: string; nome: string; cor: string | null; apelidos: string[] | null; personalizado: boolean; logo_path: string | null };
type Estado = { porChave: Map<string, Linha>; extras: { re: RegExp; linha: Linha }[] };

const VALIDADE_MS = 6 * 3600_000;
let estado: Estado = { porChave: new Map(), extras: [] };
let carregadoEm = 0;
let carregando: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim();
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function carregar() {
  if (carregando || Date.now() - carregadoEm < VALIDADE_MS) return;
  carregando = (async () => {
    try {
      const { data, error } = await (supabase as any).from("logos_bancos").select("chave, nome, cor, apelidos, personalizado, logo_path");
      if (error || !data) return;
      const linhas = data as Linha[];
      const extras = linhas
        .filter((l) => l.personalizado)
        .flatMap((l) => [...(l.apelidos ?? []), l.nome].map((a) => semAcento(a)).filter(Boolean).map((a) => ({ a, linha: l })))
        .sort((x, y) => y.a.length - x.a.length)
        .map(({ a, linha }) => ({ re: new RegExp(`(^| )${escapar(a)}( |$)`), linha }));
      estado = { porChave: new Map(linhas.map((l) => [l.chave, l])), extras };
      carregadoEm = Date.now();
      ouvintes.forEach((f) => f());
    } catch {
      /* sem rede: fica o comportamento antigo (favicon do domínio) */
    } finally {
      carregando = null;
    }
  })();
}

export function urlLogoPublico(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  return supabase.storage.from("logos-bancos").getPublicUrl(caminho).data.publicUrl;
}

/** Logo do bucket para o texto livre do banco (catálogo do código ou banco adicionado pelo admin). */
export function logoDoBanco(nome: string | null | undefined): { url: string | null; cor: string | null } {
  const b = acharBanco(nome);
  const linha = b ? estado.porChave.get(idBanco(b.nome)) : estado.extras.find((e) => e.re.test(semAcento(String(nome ?? ""))))?.linha;
  return { url: urlLogoPublico(linha?.logo_path), cor: linha?.cor ?? null };
}

/** Recarrega já (depois de o admin trocar um logo). */
export function recarregarLogosBancos() {
  carregadoEm = 0;
  carregar();
}

export function useLogosBancos(): Estado {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      carregar();
      return () => ouvintes.delete(f);
    },
    () => estado,
    () => estado,
  );
}
