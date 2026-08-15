export type Moeda = "BRL" | "USD";

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatMoeda(value: number, moeda: Moeda): string {
  return moeda === "USD" ? formatUSD(value) : formatBRL(value);
}

/** Converte um valor lançado em qualquer moeda para o total consolidado em reais. */
export function toBRL(value: number, moeda: string, cotacao: number): number {
  return moeda === "USD" ? value * cotacao : value;
}

export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T12:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function lastMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

export function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function formatDate(value: string): string {
  return parseDate(value).toLocaleDateString("pt-BR");
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** Divide o total em N parcelas, ajustando os centavos na última. */
export function dividirParcelas(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const values = Array.from({ length: n }, () => base);
  const resto = cents - base * n;
  values[n - 1] = (values[n - 1] ?? 0) + resto;
  return values.map((c) => c / 100);
}
