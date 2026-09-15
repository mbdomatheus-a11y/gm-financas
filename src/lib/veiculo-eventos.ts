export type TipoEventoVeiculo =
  | "troca_oleo"
  | "revisao_preventiva"
  | "troca_pneus"
  | "freios"
  | "bateria"
  | "alinhamento_balanceamento"
  | "lavagem"
  | "multa"
  | "outro";

export const TIPOS_EVENTO_VEICULO: { value: TipoEventoVeiculo; label: string }[] = [
  { value: "troca_oleo", label: "Troca de óleo" },
  { value: "revisao_preventiva", label: "Revisão preventiva" },
  { value: "troca_pneus", label: "Troca de pneus" },
  { value: "freios", label: "Freios" },
  { value: "bateria", label: "Bateria" },
  { value: "alinhamento_balanceamento", label: "Alinhamento/balanceamento" },
  { value: "lavagem", label: "Lavagem" },
  { value: "multa", label: "Multa" },
  { value: "outro", label: "Outro" },
];

export function labelTipoEvento(tipo: string): string {
  return TIPOS_EVENTO_VEICULO.find((t) => t.value === tipo)?.label ?? tipo;
}
