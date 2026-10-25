import { describe, expect, it } from "vitest";
import { mesmoDiaNoMes, planejarCorte } from "./exclusao-recorrente";

describe("planejarCorte", () => {
  it("nova série mantém o dia (salário dia 15)", () => {
    const p = planejarCorte({ inicio: "2026-01-15", semPrazo: true, meses: null, competencia: "2026-01", modo: "so_competencia" });
    expect(p.apagarOriginal).toBe(true);
    expect(p.novaSerie?.recorrencia_inicio).toBe("2026-02-15");
  });
  it("corta no meio e continua no mês seguinte", () => {
    const p = planejarCorte({ inicio: "2026-01-30", semPrazo: true, meses: null, competencia: "2026-09", modo: "so_competencia" });
    expect(p.atualizarOriginal?.recorrencia_meses).toBe(8);
    expect(p.novaSerie?.recorrencia_inicio).toBe("2026-10-30");
  });
  it("dia 31 em mês curto vira o último dia", () => {
    expect(mesmoDiaNoMes("2026-01-31", "2026-02")).toBe("2026-02-28");
  });
});
