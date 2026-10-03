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

function decodificarEntidadesHTML(texto: string): string {
  const mapa: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&atilde;": "ã",
    "&Atilde;": "Ã",
    "&otilde;": "õ",
    "&Otilde;": "Õ",
    "&aacute;": "á",
    "&Aacute;": "Á",
    "&eacute;": "é",
    "&Eacute;": "É",
    "&iacute;": "í",
    "&Iacute;": "Í",
    "&oacute;": "ó",
    "&Oacute;": "Ó",
    "&uacute;": "ú",
    "&Uacute;": "Ú",
    "&ccedil;": "ç",
    "&Ccedil;": "Ç",
    "&acirc;": "â",
    "&Acirc;": "Â",
    "&ecirc;": "ê",
    "&Ecirc;": "Ê",
    "&ocirc;": "ô",
    "&Ocirc;": "Ô",
    "&ordm;": "º",
    "&ordf;": "ª",
  };
  return texto
    .replace(/&[a-zA-Z]+;/g, (m) => mapa[m] ?? m)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function limpar(texto: string): string {
  return decodificarEntidadesHTML(
    texto
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function limparDescricaoItem(textoBruto: string): string {
  // Remove códigos anexos como "(Código: 12345)", "(Cód: ...)" ou "(Código do Produto: ...)"
  let limpo = textoBruto
    .replace(/<span[^>]*class=["']?[^"']*RCurva[^"']*["']?[^>]*>[\s\S]*?<\/span>/gi, " ")
    .replace(/\(C[oó]digo(?:\s*do\s*produto)?\s*:[^)]*\)/gi, "")
    .replace(/\(C[oó]d\.?\s*:[^)]*\)/gi, "")
    .replace(/C[oó]digo(?:\s*do\s*produto)?\s*:\s*\d+/gi, "");

  limpo = limpar(limpo);

  // Normaliza pontuação e espaços duplos
  limpo = limpo
    .replace(/\s{2,}/g, " ")
    .replace(/^[-–—:\s]+|[-–—:\s]+$/g, "")
    .trim();

  return limpo;
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

    // Estratégia 1: Tabela SEFAZ clássica (tr com id="Item..." ou classes de itens)
    const trItemRe = /<tr[^>]*id=["']?Item[^"'>]*["']?[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trItemRe.exec(html)) && itens.length < 200) {
      const trConteudo = trMatch[1] ?? "";

      // Descrição do produto: busca em txtTit, fixo-prod-desc-tot ou td
      const descMatch =
        /<(?:span|td)[^>]*class=["']?[^"']*(?:txtTit|fixo-prod-desc-tot)[^"']*["']?[^>]*>([\s\S]*?)<\/(?:span|td)>/i.exec(
          trConteudo,
        ) ?? /<td[^>]*>([\s\S]*?)<\/td>/i.exec(trConteudo);

      const descBruta = descMatch?.[1] ?? "";
      const descricao = limparDescricaoItem(descBruta);
      if (!descricao) continue;

      const qtdMatch = /Qtde[^0-9]{0,25}([\d.,]+)/i.exec(trConteudo);
      const unitMatch = /Vl\.?\s*Unit[^0-9]{0,25}([\d.,]+)/i.exec(trConteudo);
      const totalItemMatch =
        /<(?:span|td)[^>]*class=["']?[^"']*(?:valor|totalNumb)[^"']*["']?[^>]*>([\d.]+,\d{2})<\/(?:span|td)>/i.exec(
          trConteudo,
        ) ?? /([\d.]+,\d{2})\s*<\/(?:td|span)>/i.exec(trConteudo);

      const quantidade = qtdMatch?.[1] ? numeroBR(qtdMatch[1]) || 1 : 1;
      const unit = unitMatch?.[1] ? numeroBR(unitMatch[1]) : 0;
      const totalItem = totalItemMatch?.[1]
        ? numeroBR(totalItemMatch[1])
        : Number((unit * quantidade).toFixed(2));

      itens.push({
        descricao,
        quantidade,
        valor_unitario: unit,
        valor_total: totalItem,
      });
    }

    // Estratégia 2: Se não capturou por <tr>, usa regex refinada sobre spans de txtTit/fixo-prod
    if (itens.length === 0) {
      const linhaRe =
        /<(?:span|td)[^>]*class=["']?[^"']*(?:txtTit|fixo-prod-desc-tot)[^"']*["']?[^>]*>([\s\S]*?)<\/(?:span|td)>[\s\S]{0,600}?Qtde[^0-9]{0,25}([\d.,]+)[\s\S]{0,250}?Vl\.?\s*Unit[^0-9]{0,25}([\d.,]+)[\s\S]{0,350}?([\d.]+,\d{2})/gi;
      let m: RegExpExecArray | null;
      while ((m = linhaRe.exec(html)) && itens.length < 200) {
        const descricao = limparDescricaoItem(m[1] ?? "");
        if (!descricao) continue;
        const quantidade = numeroBR(m[2] ?? "1") || 1;
        const unit = numeroBR(m[3] ?? "0");
        itens.push({
          descricao,
          quantidade,
          valor_unitario: unit,
          valor_total: numeroBR(m[4] ?? "0") || Number((unit * quantidade).toFixed(2)),
        });
      }
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
