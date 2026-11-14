import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BotaoCompartilhar } from "@/components/BotaoCompartilhar";
import { supabase } from "@/integrations/supabase/client";
import { useCotacao } from "@/hooks/useCotacao";
import { useModulosGlobais } from "@/hooks/useAuthData";
import { useDespesas, useReceitas, useVeiculos } from "@/hooks/useFinance";
import { useNumerosCiclo } from "@/hooks/useNumerosCiclo";
import { competenciaDaReceita, competenciaDoDia, currentMonthKey, formatDate, monthLabel, toBRL } from "@/lib/format";
import { alertasDosVeiculos } from "@/lib/veiculo-alertas";

/** Botões de compartilhar de cada módulo (conteúdo herdado da antiga tela Compartilhar). */

/** Compartilha as notas que estão na tela (já com o filtro/busca aplicados). */
export function CompartilharNotas({ notas }: { notas: { estabelecimento?: string | null; data_compra?: string | null; valor_total?: number | string | null }[] }) {
  return (
    <BotaoCompartilhar
      titulo="Notas fiscais"
      arquivo="notas-fiscais"
      desativado={notas.length === 0}
      gerar={(fmt) => {
        const total = notas.reduce((s, n) => s + Number(n.valor_total ?? 0), 0);
        const top = [...notas]
          .sort((x, y) => Number(y.valor_total ?? 0) - Number(x.valor_total ?? 0))
          .slice(0, 5)
          .map((n) => `• ${n.estabelecimento || "Sem nome"}: ${fmt(Number(n.valor_total ?? 0))}`);
        return [`${notas.length} nota${notas.length > 1 ? "s" : ""} · Total: ${fmt(total)}`, "", "Maiores compras:", ...top];
      }}
    />
  );
}

export function CompartilharVeiculos() {
  const { data: veiculos = [] } = useVeiculos();
  const alertas = useMemo(() => alertasDosVeiculos(veiculos as any[]), [veiculos]);
  return (
    <BotaoCompartilhar
      titulo="Veículos"
      arquivo="veiculos"
      temValores={false}
      desativado={(veiculos as any[]).length === 0}
      gerar={() => [
        ...(veiculos as any[]).map(
          (v) => `• ${v.nome}${v.km_atual != null ? ` · ${Number(v.km_atual).toLocaleString("pt-BR")} km` : ""}`,
        ),
        ...(alertas.length ? ["", "Alertas:", ...alertas.map((a) => `⚠️ ${a.veiculoNome}: ${a.mensagem}`)] : []),
      ]}
    />
  );
}

export function CompartilharPet() {
  const { data: pets = [] } = useQuery({
    queryKey: ["pets-compartilhar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pet_animais").select("id,nome,especie,raca").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: vacinas = [] } = useQuery({
    queryKey: ["pet-vacinas-compartilhar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pet_vacinas").select("pet_id,nome,proxima_dose_em").order("proxima_dose_em");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <BotaoCompartilhar
      titulo="Pet"
      arquivo="pet"
      temValores={false}
      desativado={(pets as any[]).length === 0}
      gerar={() => {
        const hoje = new Date().toISOString().slice(0, 10);
        const doses = (vacinas as any[])
          .filter((v) => v.proxima_dose_em && v.proxima_dose_em >= hoje)
          .slice(0, 5)
          .map((v) => `• ${(pets as any[]).find((p) => p.id === v.pet_id)?.nome ?? "Pet"}, ${v.nome}: ${formatDate(v.proxima_dose_em)}`);
        return [
          ...(pets as any[]).map((p) => `• ${p.nome}${p.especie ? ` (${p.especie}${p.raca ? ` · ${p.raca}` : ""})` : ""}`),
          ...(doses.length ? ["", "Próximas doses de vacina:", ...doses] : []),
        ];
      }}
    />
  );
}

export function CompartilharOndeEsta() {
  const { data: locais = [] } = useQuery({
    queryKey: ["locais-compartilhar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("locais_armazenamento").select("id,nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-armazenados-compartilhar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("itens_armazenados").select("local_id");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <BotaoCompartilhar
      titulo="Onde está?"
      arquivo="onde-esta"
      temValores={false}
      desativado={(locais as any[]).length === 0}
      gerar={() =>
        (locais as any[]).map((l) => `• ${l.nome}: ${(itens as any[]).filter((i) => i.local_id === l.id).length} item(ns)`)
      }
    />
  );
}

/** Só título, data e laboratório; os resultados não entram (como antes). */
export function CompartilharExames() {
  const { data: exames = [] } = useQuery({
    queryKey: ["exames-compartilhar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("exames_registros")
        .select("titulo,laboratorio,data_exame")
        .eq("status_importacao", "aprovado")
        .order("data_exame", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <BotaoCompartilhar
      titulo="Exames: últimos registrados"
      arquivo="exames"
      temValores={false}
      desativado={(exames as any[]).length === 0}
      gerar={() =>
        (exames as any[]).map(
          (e) => `• ${e.titulo}${e.data_exame ? ` · ${formatDate(e.data_exame)}` : ""}${e.laboratorio ? ` (${e.laboratorio})` : ""}`,
        )
      }
    />
  );
}

/** Resumo inteligente (Início): finanças, lista de compras e veículos num texto só. */
export function CompartilharResumoGeral() {
  const cotacao = useCotacao();
  const { habilitado } = useModulosGlobais();
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const { data: veiculos = [] } = useVeiculos();
  const { data: itensLista = [] } = useQuery({
    queryKey: ["lista-compras-compartilhar"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lista_compras").select("nome,quantidade,comprado").order("comprado").limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: habilitado("lista"),
  });
  const mes = currentMonthKey();
  const numeros = useNumerosCiclo(mes);
  const alertasVeiculos = useMemo(() => (habilitado("veiculo") ? alertasDosVeiculos(veiculos as any[]) : []), [veiculos, habilitado]);
  return (
    <BotaoCompartilhar
      titulo="Resumo inteligente"
      arquivo="resumo-inteligente"
      gerar={(fmt) => {
        const rec = (receitas as any[])
          .filter((r) => competenciaDaReceita(r.data_recebimento) === mes)
          .reduce((s, r) => s + toBRL(Number(r.valor), r.moeda, cotacao), 0);
        const desp = (despesas as any[])
          .flatMap((d) => (d.parcelas ?? []).filter((p: any) => competenciaDoDia(p.vencimento) === mes).map((p: any) => ({ ...p, moeda: d.moeda })))
          .reduce((s, p: any) => s + toBRL(Number(p.valor), p.moeda, cotacao), 0);
        const prev = numeros.previsto.sobra;
        const pend = (itensLista as any[]).filter((i) => !i.comprado).length;
        const l = [
          `Resumo · ${monthLabel(mes)}`,
          "",
          `💰 Receitas: ${fmt(rec)}`,
          `💸 Despesas: ${fmt(desp)}`,
          `${prev >= 0 ? "✅" : "🔴"} Vai sobrar no fim do ciclo: ${fmt(prev)}`,
          `Em conta agora: ${fmt(numeros.real.sobra)}`,
        ];
        if (numeros.diasRestantes > 0) l.push(`Posso gastar por dia: ${fmt(numeros.porDia)}`);
        if (habilitado("lista")) l.push(pend > 0 ? `🛒 ${pend} item(ns) pendente(s) na lista de compras` : "🛒 Lista de compras sem pendências");
        if (habilitado("veiculo") && alertasVeiculos.length > 0) l.push(`🚗 ${alertasVeiculos.length} alerta(s) de veículo em aberto`);
        return l;
      }}
    />
  );
}
