import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, X } from "lucide-react";

import { useIsSiteAdmin } from "@/hooks/useAuthData";
import { pluggyListarSincronizacoes } from "@/lib/pluggy.functions";

const CHAVE = "financas_aviso_pluggy_fechado";

/** Aviso no topo (só admin) quando a última sincronização de algum banco falhou. */
export function AvisoSincronizacaoPluggy() {
  const { data: ehAdmin } = useIsSiteAdmin();
  const listar = useServerFn(pluggyListarSincronizacoes);
  const [fechado, setFechado] = useState(() => {
    try {
      return sessionStorage.getItem(CHAVE) === "true";
    } catch {
      return false;
    }
  });
  const { data } = useQuery({
    queryKey: ["pluggy-historico"],
    queryFn: () => listar(),
    enabled: !!ehAdmin,
    retry: false,
    staleTime: 60_000,
  });

  if (!ehAdmin || fechado || !data) return null;

  // Considera só a sincronização mais recente de cada banco.
  const ultimaPorBanco = new Map<string, any>();
  for (const h of data.historico) {
    if (!ultimaPorBanco.has(h.item_id)) ultimaPorBanco.set(h.item_id, h);
  }
  const falhas = [...ultimaPorBanco.values()].filter((h) => h.status === "erro");
  if (falhas.length === 0) return null;

  function fechar() {
    try {
      sessionStorage.setItem(CHAVE, "true");
    } catch {
      // sem sessionStorage: o aviso só some até a próxima tela
    }
    setFechado(true);
  }

  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm">
      <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {falhas.length === 1
          ? "1 banco com falha na última sincronização."
          : `${falhas.length} bancos com falha na última sincronização.`}
      </span>
      <Link to="/administracao" search={{ aba: "bancos" }} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
        Ver detalhes
      </Link>
      <button
        type="button"
        aria-label="Fechar aviso"
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={fechar}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
