import { describe, expect, test } from "bun:test";
import { alertasDoVeiculo } from "@/lib/veiculo-alertas";
import { toISODate } from "@/lib/format";

function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return toISODate(d);
}

const base = {
  id: "v1",
  nome: "Carro do Guilherme",
  km_atual: null,
  km_proxima_troca_oleo: null,
  data_proxima_troca_oleo: null,
  data_vencimento_ipva: null,
  data_vencimento_seguro: null,
};

describe("alertasDoVeiculo", () => {
  test("sem nenhuma data/KM configurado, não gera alerta", () => {
    expect(alertasDoVeiculo(base)).toHaveLength(0);
  });

  test("IPVA vencendo em 10 dias gera alerta crítico", () => {
    const alertas = alertasDoVeiculo({ ...base, data_vencimento_ipva: emDias(10) });
    expect(alertas).toHaveLength(1);
    expect(alertas[0]!.tipo).toBe("ipva");
    expect(alertas[0]!.urgencia).toBe("critica");
  });

  test("seguro vencendo em 25 dias gera alerta de atenção", () => {
    const alertas = alertasDoVeiculo({ ...base, data_vencimento_seguro: emDias(25) });
    expect(alertas[0]!.urgencia).toBe("atencao");
  });

  test("data de troca de óleo a mais de 30 dias não gera alerta", () => {
    expect(alertasDoVeiculo({ ...base, data_proxima_troca_oleo: emDias(60) })).toHaveLength(0);
  });

  test("KM restante pequeno gera alerta de troca de óleo", () => {
    const alertas = alertasDoVeiculo({
      ...base,
      km_atual: 49700,
      km_proxima_troca_oleo: 50000,
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0]!.tipo).toBe("oleo");
    expect(alertas[0]!.urgencia).toBe("atencao");
  });

  test("KM já passado da troca gera alerta crítico", () => {
    const alertas = alertasDoVeiculo({
      ...base,
      km_atual: 50200,
      km_proxima_troca_oleo: 50000,
    });
    expect(alertas[0]!.urgencia).toBe("critica");
  });

  test("IPVA e seguro vencendo juntos geram dois alertas", () => {
    const alertas = alertasDoVeiculo({
      ...base,
      data_vencimento_ipva: emDias(5),
      data_vencimento_seguro: emDias(5),
    });
    expect(alertas).toHaveLength(2);
    expect(alertas.map((a) => a.tipo).sort()).toEqual(["ipva", "seguro"]);
  });
});
