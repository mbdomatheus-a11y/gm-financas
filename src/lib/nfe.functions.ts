import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotaItemLido = {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

export type ConsultaNotaResultado = {
  status: "auto" | "manual";
  estabelecimento: string | null;
  valor_total: number | null;
  data_compra: string | null;
  itens: NotaItemLido[];
  motivo?: string;
};

function limpar(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroBR(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
}

/**
 * Tenta ler os dados públicos da nota a partir da URL do QR Code.
 * Muitos estados exigem captcha; nesse caso devolvemos status "manual".
 */
export const consultarNota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<ConsultaNotaResultado> => {
    const vazio: ConsultaNotaResultado = {
      status: "manual",
      estabelecimento: null,
      valor_total: null,
      data_compra: null,
      itens: [],
    };

    let alvo: URL;
    try {
      alvo = new URL(data.url);
    } catch {
      return { ...vazio, motivo: "QR Code sem link de consulta" };
    }
    if (alvo.protocol !== "https:" || !/\.gov\.br$/i.test(alvo.hostname)) {
      return { ...vazio, motivo: "Link fora dos portais oficiais" };
    }

    let html = "";
    try {
      const res = await fetch(alvo.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { ...vazio, motivo: `Portal respondeu ${res.status}` };
      html = await res.text();
    } catch {
      return { ...vazio, motivo: "Portal indisponível" };
    }

    if (/captcha|recaptcha/i.test(html)) {
      return { ...vazio, motivo: "Portal exigiu captcha" };
    }

    const texto = limpar(html);

    const emitente =
      /(?:txtTopo[^>]*>)([^<]{3,120})/i.exec(html)?.[1] ??
      /Emitente[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .,&-]{4,80})/i.exec(texto)?.[1] ??
      null;

    const totalMatch =
      /Valor total(?:\s*da\s*nota)?[^0-9]{0,40}([\d.]+,\d{2})/i.exec(texto) ??
      /Valor a pagar[^0-9]{0,40}([\d.]+,\d{2})/i.exec(texto);
    const valor = totalMatch?.[1] ? numeroBR(totalMatch[1]) : null;

    const dataMatch = /(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
    const dataCompra = dataMatch ? `${dataMatch[3]}-${dataMatch[2]}-${dataMatch[1]}` : null;

    const itens: NotaItemLido[] = [];
    const linhaRe =
      /txtTit[^>]*>([^<]{2,120})<[\s\S]{0,600}?Qtde[^0-9]{0,20}([\d.,]+)[\s\S]{0,200}?Vl\.?\s*Unit[^0-9]{0,20}([\d.,]+)[\s\S]{0,300}?([\d.]+,\d{2})/gi;
    let m: RegExpExecArray | null;
    while ((m = linhaRe.exec(html)) && itens.length < 200) {
      const quantidade = numeroBR(m[2] ?? "1") || 1;
      const unit = numeroBR(m[3] ?? "0");
      itens.push({
        descricao: limpar(m[1] ?? ""),
        quantidade,
        valor_unitario: unit,
        valor_total: numeroBR(m[4] ?? "0") || Number((unit * quantidade).toFixed(2)),
      });
    }

    const achouAlgo = !!emitente || valor !== null || itens.length > 0;
    return {
      status: achouAlgo ? "auto" : "manual",
      estabelecimento: emitente ? limpar(emitente) : null,
      valor_total: valor,
      data_compra: dataCompra,
      itens,
      ...(achouAlgo ? {} : { motivo: "Não foi possível ler os dados da nota" }),
    };
  });
