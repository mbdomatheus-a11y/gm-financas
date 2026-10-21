import { useEffect, useState } from "react";

import { useCartoes, useDespesas, useFaturasMes } from "@/hooks/useFinance";
import { useCotacao } from "@/hooks/useCotacao";
import { ehAppNativo } from "@/lib/app-nativo";
import {
  agendaAppVinculada,
  enviarParaAgendaApp,
  eventosParaAgendaApp,
  useListaAgenda,
  useNotasAgenda,
} from "@/lib/agenda-app";

// Última lista enviada ao iPhone nesta abertura do app (evita reenviar a cada troca de tela).
let ultimaAssinatura = "";

/**
 * App do iPhone com a agenda vinculada: mantém o calendário "Control ALL" atualizado sozinho,
 * sem precisar abrir a tela Calendário. No navegador (ou sem vínculo) não faz nada.
 */
export function SincronizadorAgendaApp() {
  const [ativo, setAtivo] = useState(false);
  useEffect(() => {
    const avaliar = () => setAtivo(ehAppNativo() && agendaAppVinculada());
    avaliar();
    window.addEventListener("agenda-app-resultado", avaliar);
    return () => window.removeEventListener("agenda-app-resultado", avaliar);
  }, []);
  return ativo ? <SincronizadorAtivo /> : null;
}

function SincronizadorAtivo() {
  const cotacao = useCotacao();
  const despesas = useDespesas();
  const faturasMes = useFaturasMes();
  const cartoes = useCartoes();
  const notas = useNotasAgenda();
  const lista = useListaAgenda();
  // Só sincroniza com tudo carregado: nunca apaga a agenda por causa de dados incompletos.
  const pronto = despesas.isSuccess && faturasMes.isSuccess && cartoes.isSuccess && notas.isSuccess && lista.isSuccess;

  useEffect(() => {
    if (!pronto) return;
    const eventos = eventosParaAgendaApp({
      despesas: despesas.data ?? [],
      faturasMes: faturasMes.data ?? [],
      cartoes: cartoes.data ?? [],
      notas: notas.data ?? [],
      listaItens: lista.data ?? [],
      cotacao,
    });
    const assinatura = JSON.stringify(eventos);
    if (assinatura === ultimaAssinatura) return;
    const espera = window.setTimeout(() => {
      ultimaAssinatura = assinatura;
      enviarParaAgendaApp(eventos, true);
    }, 3000);
    return () => window.clearTimeout(espera);
  }, [pronto, despesas.data, faturasMes.data, cartoes.data, notas.data, lista.data, cotacao]);

  return null;
}
