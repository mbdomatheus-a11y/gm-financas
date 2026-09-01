/**
 * Interpretador de despesas escritas em linguagem natural (WhatsApp, anotações).
 * Regra de ouro: extrai apenas fatos explícitos. Nada é inventado — o que não
 * puder ser determinado com segurança fica vazio.
 */
import { classificar, type RegraUsuario } from "@/lib/categorizacao";
import { addMonths, toISODate } from "@/lib/format";

export type FormaPagamento = {
  banco: string | null;
  final: string | null;
  meio: "cartao" | "pix" | "dinheiro" | "debito" | null;
  label: string;
};

export type LancamentoTexto = {
  descricao: string;
  valor: number | null;
  valor_total: number | null;
  repetir_meses: number | null;
  moeda: "BRL" | "USD";
  categoria: string | null;
  subcategoria: string | null;
  tipo: "fixa" | "variavel" | "parcelada" | null;
  data_compra: string | null;
  pagamento: FormaPagamento;
  parcelas: number | null;
  data_primeira_parcela: string | null;
  responsavel: string | null;
  observacoes: string;
};

export type ContextoTexto = {
  perfis?: string[];
  usuarioAtual?: string | null;
  cartoes?: { final: string | null; banco: string | null; apelido?: string | null }[];
  bancos?: string[];
  regras?: RegraUsuario[];
  hoje?: Date;
};

const BANCOS_CONHECIDOS: { chave: RegExp; nome: string }[] = [
  { chave: /\bnubank\b|\bnu\b/, nome: "Nubank" },
  { chave: /\bitau\b|\bitaú\b|\bitaucard\b/, nome: "Itaú" },
  { chave: /\bsantander\b/, nome: "Santander" },
  { chave: /\bpernambucanas\b/, nome: "Pernambucanas" },
  { chave: /\bbradesco\b/, nome: "Bradesco" },
  { chave: /\bcaixa\b/, nome: "Caixa" },
  { chave: /\bbanco\s?do\s?brasil\b|\bbb\b/, nome: "Banco do Brasil" },
  { chave: /\binter\b/, nome: "Inter" },
  { chave: /\bc6\b/, nome: "C6" },
  { chave: /\bwill\b/, nome: "Will Bank" },
  { chave: /\bxp\b/, nome: "XP" },
  { chave: /\bmercado\s?pago\b/, nome: "Mercado Pago" },
  { chave: /\bpicpay\b/, nome: "PicPay" },
  { chave: /\bamex\b/, nome: "Amex" },
];

const MESES_TXT: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, março: 3, mar: 3,
  abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7,
  agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10,
  novembro: 11, nov: 11, dezembro: 12, dez: 12,
};

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, terça: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, sábado: 6,
};

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** "1.296,00" | "1296,00" | "1296" | "54" -> número */
function paraNumero(bruto: string): number | null {
  let s = bruto.replace(/r\$\s*/i, "").trim();
  if (!s) return null;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) s = s.replace(/\./g, "").replace(",", ".");
  else if (temVirgula) s = s.replace(",", ".");
  else if (temPonto && /\.\d{3}\b/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const RE_VALOR = /(?:r\$\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|(?:r\$\s*)?\d+,\d{1,2}|r\$\s*\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\b/gi;

type Trecho = { inicio: number; fim: number };

function marcar(usados: Trecho[], m: RegExpMatchArray | null) {
  if (!m || m.index == null) return;
  usados.push({ inicio: m.index, fim: m.index + m[0].length });
}

function dataISO(d: Date) {
  return toISODate(d);
}

/** Interpreta uma mensagem livre e devolve os campos de uma despesa. */
export function interpretarTexto(raw: string, ctx: ContextoTexto = {}): LancamentoTexto {
  const hoje = ctx.hoje ?? new Date();
  const texto = raw.replace(/\s+/g, " ").trim();
  const baixo = semAcento(texto.toLowerCase());
  const usados: Trecho[] = [];

  /* ---------------- parcelas ---------------- */
  let parcelas: number | null = null;
  let valorParcela: number | null = null;
  let valorTotal: number | null = null;

  const mNxDe = baixo.match(/\b(\d{1,2})\s*x\s*(?:de\s*)?(?:r\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)\b/);
  if (mNxDe) {
    parcelas = Number(mNxDe[1]);
    valorParcela = paraNumero(mNxDe[2] ?? "");
    marcar(usados, mNxDe);
  } else {
    const mX = baixo.match(/\b(\d{1,2})\s*x\b|\b(\d{1,2})\s*(?:parcelas?|vezes)\b|\bparcelad[oa]\s*(?:em\s*)?(\d{1,2})\b/);
    if (mX) {
      parcelas = Number(mX[1] ?? mX[2] ?? mX[3]);
      marcar(usados, mX);
    }
  }

  const mTotal = baixo.match(/\btotal\s*(?:de\s*)?(?:r\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)\b/);
  if (mTotal) {
    valorTotal = paraNumero(mTotal[1] ?? "");
    marcar(usados, mTotal);
  }

  /* ---------------- recorrência ---------------- */
  let repetir: number | null = null;
  const mDurante = baixo.match(/\b(?:durante|por)\s*(\d{1,3})\s*(?:meses|mes)\b/);
  if (mDurante) {
    repetir = Number(mDurante[1]);
    marcar(usados, mDurante);
  }
  const recorrente =
    /\bpor\s?m[eê]s\b|\bmensal(?:mente)?\b|\btodo\s?m[eê]s\b|\bassinatura\b|\brecorrente\b/.test(baixo) ||
    mDurante != null;
  const mRec = baixo.match(/\bpor\s?mes\b|\bmensal(?:mente)?\b|\btodo\s?mes\b|\brecorrente\b/);
  marcar(usados, mRec);

  /* ---------------- datas ---------------- */
  let dataCompra: string | null = null;
  let dataPrimeira: string | null = null;

  function lerData(fragmento: string, base: Date): string | null {
    const dmy = fragmento.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (dmy) {
      const dia = Number(dmy[1]);
      const mes = Number(dmy[2]);
      let ano = dmy[3] ? Number(dmy[3]) : base.getFullYear();
      if (ano < 100) ano += 2000;
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
        return dataISO(new Date(ano, mes - 1, dia));
      }
    }
    const diaMesTxt = fragmento.match(/\b(\d{1,2})\s*(?:de\s*)?([a-zç]{3,9})\b/);
    if (diaMesTxt) {
      const mes = MESES_TXT[semAcento(diaMesTxt[2] ?? "")];
      if (mes) return dataISO(new Date(base.getFullYear(), mes - 1, Number(diaMesTxt[1])));
    }
    return null;
  }

  const mPrimeira = baixo.match(/\b(?:1a|1ª|primeira)\s*(?:parcela|venc\w*)?\s*(?:em|dia)?\s*([^\s,;]+(?:\s+de\s+[a-zç]+)?)/);
  if (mPrimeira) {
    dataPrimeira = lerData(mPrimeira[1] ?? "", hoje);
    if (dataPrimeira) marcar(usados, mPrimeira);
  }

  if (/\bhoje\b/.test(baixo)) {
    dataCompra = dataISO(hoje);
    marcar(usados, baixo.match(/\bhoje\b/));
  } else if (/\bontem\b/.test(baixo)) {
    const d = new Date(hoje.getTime());
    d.setDate(d.getDate() - 1);
    dataCompra = dataISO(d);
    marcar(usados, baixo.match(/\bontem\b/));
  } else if (/\banteontem\b/.test(baixo)) {
    const d = new Date(hoje.getTime());
    d.setDate(d.getDate() - 2);
    dataCompra = dataISO(d);
    marcar(usados, baixo.match(/\banteontem\b/));
  }

  if (!dataCompra) {
    const mDia = baixo.match(/\bdia\s*(\d{1,2})(?:[/-](\d{1,2}))?(?:[/-](\d{2,4}))?\b/);
    if (mDia) {
      const dia = Number(mDia[1]);
      const mes = mDia[2] ? Number(mDia[2]) : hoje.getMonth() + 1;
      let ano = mDia[3] ? Number(mDia[3]) : hoje.getFullYear();
      if (ano < 100) ano += 2000;
      if (dia >= 1 && dia <= 31) {
        dataCompra = dataISO(new Date(ano, mes - 1, dia));
        marcar(usados, mDia);
      }
    }
  }

  if (!dataCompra) {
    const mData = baixo.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (mData && (!mPrimeira || mData.index !== mPrimeira.index)) {
      dataCompra = lerData(mData[0], hoje);
      if (dataCompra) marcar(usados, mData);
    }
  }

  if (!dataCompra) {
    for (const [nome, idx] of Object.entries(DIAS_SEMANA)) {
      const chave = semAcento(nome);
      const m = baixo.match(new RegExp(`\\b${chave}(?:-feira)?\\b`));
      if (m) {
        const d = new Date(hoje.getTime());
        const diff = (d.getDay() - idx + 7) % 7 || 7;
        d.setDate(d.getDate() - diff);
        dataCompra = dataISO(d);
        marcar(usados, m);
        break;
      }
    }
  }

  /* ---------------- forma de pagamento ---------------- */
  let banco: string | null = null;
  let final: string | null = null;
  let meio: FormaPagamento["meio"] = null;

  for (const b of BANCOS_CONHECIDOS) {
    const m = baixo.match(b.chave);
    if (m) {
      banco = b.nome;
      meio = "cartao";
      marcar(usados, m);
      break;
    }
  }
  const mFinal = baixo.match(/\b(?:final|fim|term(?:ina)?)\s*(\d{4})\b/);
  if (mFinal) {
    final = mFinal[1] ?? null;
    marcar(usados, mFinal);
  } else if (banco) {
    const mQuatro = baixo.match(/\b(\d{4})\b/);
    const conhecidos = (ctx.cartoes ?? []).map((c) => c.final).filter(Boolean) as string[];
    if (mQuatro && conhecidos.includes(mQuatro[1] ?? "")) {
      final = mQuatro[1] ?? null;
      marcar(usados, mQuatro);
    }
  }
  if (/\bpix\b/.test(baixo)) {
    meio = "pix";
    marcar(usados, baixo.match(/\bpix\b/));
  } else if (/\bdinheiro\b|\bespecie\b/.test(baixo)) {
    meio = "dinheiro";
    marcar(usados, baixo.match(/\bdinheiro\b|\bespecie\b/));
  } else if (/\bdebito\b/.test(baixo)) {
    meio = "debito";
    marcar(usados, baixo.match(/\bdebito\b/));
  } else if (/\bcredito\b/.test(baixo)) {
    meio = "cartao";
    marcar(usados, baixo.match(/\bcredito\b/));
  }

  const labelPagamento = [
    banco,
    final ? `•${final}` : null,
    !banco && meio === "pix" ? "PIX" : null,
    !banco && meio === "dinheiro" ? "Dinheiro" : null,
    !banco && meio === "debito" ? "Cartão de débito" : null,
  ]
    .filter(Boolean)
    .join(" ");

  /* ---------------- responsável ---------------- */
  let responsavel: string | null = null;
  for (const nome of ctx.perfis ?? []) {
    const partes = semAcento(nome.toLowerCase()).split(/\s+/).filter((p) => p.length >= 3);
    for (const parte of partes) {
      const m = baixo.match(new RegExp(`\\b${parte}\\b`));
      if (m) {
        responsavel = nome;
        marcar(usados, m);
        break;
      }
    }
    if (responsavel) break;
  }
  if (!responsavel && ctx.usuarioAtual && /\b(meu|minha|eu paguei|paguei eu)\b/.test(baixo)) {
    responsavel = ctx.usuarioAtual;
  }

  /* ---------------- valores restantes ---------------- */
  const numeros: { valor: number; inicio: number; fim: number; explicito: boolean }[] = [];
  for (const m of texto.matchAll(RE_VALOR)) {
    const inicio = m.index ?? 0;
    const fim = inicio + m[0].length;
    if (usados.some((u) => inicio < u.fim && fim > u.inicio)) continue;
    const n = paraNumero(m[0]);
    if (n == null || n <= 0) continue;
    const explicito = /r\$/i.test(m[0]) || /,\d{1,2}$/.test(m[0]) || /\.\d{3}/.test(m[0]);
    // números de 4 dígitos sem centavos podem ser final de cartão/ano — descarta se já houver banco
    if (!explicito && /^\d{4}$/.test(m[0]) && banco) continue;
    numeros.push({ valor: n, inicio, fim, explicito });
  }
  numeros.sort((a, b) => (b.explicito ? 1 : 0) - (a.explicito ? 1 : 0) || b.valor - a.valor);
  const restante = numeros[0] ?? null;

  if (valorParcela == null) {
    if (parcelas && parcelas > 1 && valorTotal != null && restante == null) {
      valorParcela = Number((valorTotal / parcelas).toFixed(2));
    } else if (restante) {
      valorParcela = restante.valor;
      usados.push({ inicio: restante.inicio, fim: restante.fim });
    }
  }
  if (valorTotal == null && valorParcela != null && parcelas && parcelas > 1) {
    valorTotal = Number((valorParcela * parcelas).toFixed(2));
  }

  const moeda: "BRL" | "USD" = /\b(usd|dolar|dólar|us\$)\b/.test(baixo) ? "USD" : "BRL";
  if (moeda === "USD") marcar(usados, baixo.match(/\b(usd|dolar|us\$)\b/));

  /* ---------------- descrição ---------------- */
  const ordenados = [...usados].sort((a, b) => a.inicio - b.inicio);
  let desc = "";
  let cursor = 0;
  for (const t of ordenados) {
    if (t.inicio > cursor) desc += texto.slice(cursor, t.inicio) + " ";
    cursor = Math.max(cursor, t.fim);
  }
  desc += texto.slice(cursor);
  desc = desc
    .replace(/\b(coloca|coloque|ai|aí|lanca|lança|lancar|lançar|paguei|pagar|comprei|comprar|gastei|foi|de|do|da|no|na|em|com|cartao|cartão|conta|parcela|parcelas|primeira|total|r\$)\b/gi, " ")
    .replace(/[^\wÀ-ÿ\s&./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  desc = desc
    .split(" ")
    .filter((p) => p.length > 1 || /[0-9A-Za-zÀ-ÿ]/.test(p))
    .join(" ");
  const descricao = desc
    ? desc
        .split(" ")
        .map((p) => (p.length > 2 && p === p.toLowerCase() ? p[0]?.toUpperCase() + p.slice(1) : p))
        .join(" ")
    : "";

  /* ---------------- categoria e tipo ---------------- */
  let categoria: string | null = null;
  let subcategoria: string | null = null;
  if (descricao) {
    const c = classificar(descricao, { regras: ctx.regras, valor: valorParcela ?? 0 });
    if (c.confianca !== "baixa") {
      categoria = c.categoria;
      subcategoria = c.subcategoria;
    }
  }

  let tipo: LancamentoTexto["tipo"] = null;
  if (parcelas && parcelas > 1) tipo = "parcelada";
  else if (recorrente || (categoria ?? "").toLowerCase().startsWith("assinatura")) tipo = "fixa";
  else if (valorParcela != null) tipo = "variavel";

  /* ---------------- observações ---------------- */
  const obs: string[] = [];
  if (parcelas && parcelas > 1 && valorParcela != null) {
    obs.push(
      `Compra parcelada em ${parcelas}x de ${valorParcela.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} — total ${(valorTotal ?? valorParcela * parcelas).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}.`,
    );
  } else if (tipo === "fixa" && descricao) {
    obs.push(`Despesa recorrente mensal${repetir ? ` por ${repetir} meses` : ""}.`);
  }

  if (!dataPrimeira && parcelas && parcelas > 1 && dataCompra) {
    dataPrimeira = dataISO(addMonths(new Date(`${dataCompra}T12:00:00`), 0));
  }

  return {
    descricao,
    valor: valorParcela,
    valor_total: valorTotal,
    repetir_meses: repetir,
    moeda,
    categoria,
    subcategoria,
    tipo,
    data_compra: dataCompra,
    pagamento: { banco, final, meio, label: labelPagamento },
    parcelas: parcelas && parcelas > 1 ? parcelas : null,
    data_primeira_parcela: dataPrimeira,
    responsavel,
    observacoes: obs.join(" "),
  };
}

/* ------------------------------------------------------------------ */
/* Colagem de vários lançamentos (extrato, planilha copiada, mensagens) */
/* ------------------------------------------------------------------ */

export type LinhaColada = {
  data: string | null;
  descricao: string;
  valor: number;
};

/** Lê um bloco colado, uma linha por lançamento, exigindo descrição + valor. */
export function interpretarBloco(bloco: string, ctx: ContextoTexto = {}): LinhaColada[] {
  const out: LinhaColada[] = [];
  for (const linha of bloco.split(/\r?\n/)) {
    const limpa = linha.replace(/\t/g, " ").trim();
    if (!limpa || limpa.length < 4) continue;
    const parsed = interpretarTexto(limpa, ctx);
    if (parsed.valor == null || !parsed.descricao) continue;
    out.push({
      data: parsed.data_compra,
      descricao: parsed.descricao,
      valor: parsed.valor,
    });
  }
  return out;
}
