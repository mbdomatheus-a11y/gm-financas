import { describe, expect, it } from "vitest";
import { correspondeBuscaComValor } from "./busca";

describe("correspondeBuscaComValor", () => {
  it("retorna true para busca vazia", () => {
    expect(correspondeBuscaComValor("Mercado", 150.5, "")).toBe(true);
    expect(correspondeBuscaComValor("Mercado", 150.5, "   ")).toBe(true);
  });

  it("filtra por texto (descrição, categoria, responsável)", () => {
    expect(correspondeBuscaComValor("Mercado Extra · Alimentos · Matheus", 100, "extra")).toBe(true);
    expect(correspondeBuscaComValor("Mercado Extra · Alimentos · Matheus", 100, "matheus")).toBe(true);
    expect(correspondeBuscaComValor("Mercado Extra · Alimentos · Matheus", 100, "padaria")).toBe(false);
  });

  it("filtra por valor formatado em PT-BR com milhar e centavos (ex: 3.259,25)", () => {
    expect(correspondeBuscaComValor("Item", 3259.25, "3.259,25")).toBe(true);
    expect(correspondeBuscaComValor("Item", 3259.25, "3259,25")).toBe(true);
    expect(correspondeBuscaComValor("Item", 3259.25, "259,25")).toBe(true);
  });

  it("filtra por valor menor que mil (ex: 259,25)", () => {
    expect(correspondeBuscaComValor("Item", 259.25, "259,25")).toBe(true);
    expect(correspondeBuscaComValor("Item", 259.25, "259")).toBe(true);
  });

  it("filtra por valor inteiro ou formato com ponto (ex: 120, 120,00, 120.00)", () => {
    expect(correspondeBuscaComValor("Item", 120, "120")).toBe(true);
    expect(correspondeBuscaComValor("Item", 120, "120,00")).toBe(true);
    expect(correspondeBuscaComValor("Item", 120, "120.00")).toBe(true);
    expect(correspondeBuscaComValor("Item", 120, "R$ 120,00")).toBe(true);
  });

  it("retorna false para valores não correspondentes", () => {
    expect(correspondeBuscaComValor("Item", 120, "500")).toBe(false);
    expect(correspondeBuscaComValor("Item", 120, "120,50")).toBe(false);
  });
});
