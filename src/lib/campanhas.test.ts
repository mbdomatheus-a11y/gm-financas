import { describe, expect, it } from "bun:test";
import { gerarLinkCampanha, slugCampanha } from "./campanhas";

describe("links de campanha", () => {
  it("normaliza o nome do post", () => {
    expect(slugCampanha("Parcelas de Outubro!")).toBe("parcelas-de-outubro");
    expect(slugCampanha("  Fatura  Itaú  ")).toBe("fatura-itau");
  });
  it("monta o link com utm de Instagram", () => {
    const l = new URL(gerarLinkCampanha({ campanha: "Post 1", destino: "/comecar/parcelas", origem: "instagram" }));
    expect(l.pathname).toBe("/comecar/parcelas");
    expect(l.searchParams.get("utm_source")).toBe("ig");
    expect(l.searchParams.get("utm_medium")).toBe("social");
    expect(l.searchParams.get("utm_campaign")).toBe("post-1");
  });
});
