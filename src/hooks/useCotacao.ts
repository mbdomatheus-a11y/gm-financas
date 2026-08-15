import { useQuery } from "@tanstack/react-query";

const FALLBACK = 5.4;

/** Cotação do dólar comercial do dia (AwesomeAPI), com fallback offline. */
export function useCotacao() {
  const query = useQuery({
    queryKey: ["cotacao-usd"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      try {
        const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
        if (!res.ok) throw new Error("falha");
        const json = (await res.json()) as { USDBRL?: { bid?: string } };
        const bid = Number(json.USDBRL?.bid);
        return Number.isFinite(bid) && bid > 0 ? bid : FALLBACK;
      } catch {
        return FALLBACK;
      }
    },
  });
  return query.data ?? FALLBACK;
}
