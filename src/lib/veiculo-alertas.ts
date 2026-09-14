import { diasRestantes } from "@/lib/nfe";

/** Mesmos limiares usados pelo alerta de garantia de nota fiscal em /inicio. */
const LIMIAR_CRITICO_DIAS = 15;
const LIMIAR_ATENCAO_DIAS = 30;
/** Troca de óleo/revisão: alerta quando faltar isso (ou menos) de KM rodado. */
const LIMIAR_KM = 500;

export type TipoAlertaVeiculo = "oleo" | "ipva" | "seguro";
export type UrgenciaAlerta = "critica" | "atencao";

export interface AlertaVeiculo {
  veiculoId: string;
  veiculoNome: string;
  tipo: TipoAlertaVeiculo;
  urgencia: UrgenciaAlerta;
  mensagem: string;
}

interface VeiculoParaAlerta {
  id: string;
  nome: string;
  km_atual: number | null;
  km_proxima_troca_oleo: number | null;
  data_proxima_troca_oleo: string | null;
  data_vencimento_ipva: string | null;
  data_vencimento_seguro: string | null;
}

function urgenciaPorDias(dias: number): UrgenciaAlerta | null {
  if (dias < 0) return "critica";
  if (dias <= LIMIAR_CRITICO_DIAS) return "critica";
  if (dias <= LIMIAR_ATENCAO_DIAS) return "atencao";
  return null;
}

function alertaData(
  v: VeiculoParaAlerta,
  tipo: TipoAlertaVeiculo,
  data: string | null,
  rotulo: string,
): AlertaVeiculo | null {
  if (!data) return null;
  const dias = diasRestantes(data);
  if (dias === null) return null;
  const urgencia = urgenciaPorDias(dias);
  if (!urgencia) return null;
  const venceu = dias < 0;
  return {
    veiculoId: v.id,
    veiculoNome: v.nome,
    tipo,
    urgencia,
    mensagem: venceu ? `${rotulo} venceu há ${Math.abs(dias)}d` : `${rotulo} vence em ${dias}d`,
  };
}

/**
 * Calcula os alertas de um veículo: troca de óleo/revisão (por data OU por
 * KM, o que vier primeiro), IPVA e seguro — mesma lógica de urgência usada
 * para garantia de nota fiscal (crítico ≤15 dias, atenção ≤30 dias).
 */
export function alertasDoVeiculo(v: VeiculoParaAlerta): AlertaVeiculo[] {
  const alertas: AlertaVeiculo[] = [];

  const porData = alertaData(v, "oleo", v.data_proxima_troca_oleo, "Troca de óleo/revisão");
  const kmFaltando =
    v.km_atual != null && v.km_proxima_troca_oleo != null
      ? v.km_proxima_troca_oleo - v.km_atual
      : null;
  const porKm =
    kmFaltando != null && kmFaltando <= LIMIAR_KM
      ? ({
          veiculoId: v.id,
          veiculoNome: v.nome,
          tipo: "oleo" as const,
          urgencia: (kmFaltando <= 0 ? "critica" : "atencao") as UrgenciaAlerta,
          mensagem:
            kmFaltando <= 0
              ? `Troca de óleo/revisão passou ${Math.abs(kmFaltando)}km`
              : `Troca de óleo/revisão em ${kmFaltando}km`,
        } satisfies AlertaVeiculo)
      : null;
  // O que vencer primeiro (data ou KM) — se os dois disparam, mostra o mais urgente.
  if (porData && porKm) {
    alertas.push(porData.urgencia === "critica" ? porData : porKm);
  } else if (porData || porKm) {
    alertas.push((porData ?? porKm)!);
  }

  const ipva = alertaData(v, "ipva", v.data_vencimento_ipva, "IPVA");
  if (ipva) alertas.push(ipva);

  const seguro = alertaData(v, "seguro", v.data_vencimento_seguro, "Seguro");
  if (seguro) alertas.push(seguro);

  return alertas;
}

export function alertasDosVeiculos(veiculos: VeiculoParaAlerta[]): AlertaVeiculo[] {
  return veiculos.flatMap(alertasDoVeiculo);
}
