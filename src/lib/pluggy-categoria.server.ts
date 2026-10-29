import { CATEGORIA_A_CONFIRMAR, classificar, type RegraUsuario } from "@/lib/categorizacao";

/**
 * Categoria automática das despesas do Open Finance (28/10/2026).
 * Ordem: 1) de-para do grupo (categoria_regras) e histórico confirmado; 2) categoria que a Pluggy
 * informa (mapa abaixo); 3) marcas e palavras-chave do sistema; 4) "Categoria a confirmar".
 * Roda na importação e, ao fim de cada sincronização, nas despesas do Open Finance ainda a confirmar.
 */

/** Categoria da Pluggy (minúsculas) → nossa categoria e subcategoria. Transferências ficam de fora. */
const MAPA_PLUGGY: Record<string, [string, string | null]> = {
  groceries: ["Mercado", "Supermercado"],
  shopping: ["Compras / Varejo", "Compras diversas"],
  "online shopping": ["Compras / Varejo", "E-commerce"],
  houseware: ["Compras / Varejo", "Utilidades"],
  "office supplies": ["Compras / Varejo", "Utilidades"],
  electronics: ["Compras / Varejo", "Loja de departamento"],
  "sports goods": ["Compras / Varejo", "Compras diversas"],
  clothing: ["Vestuário / Calçados", "Roupas"],
  "eating out": ["Alimentação", "Restaurante"],
  "food and drinks": ["Alimentação", null],
  "food delivery": ["Alimentação", "Delivery"],
  "taxi and ride-hailing": ["Transporte", "Transporte por aplicativo"],
  "public transportation": ["Transporte", "Transporte público"],
  parking: ["Transporte", "Estacionamento"],
  "tolls and in vehicle payment": ["Transporte", "Pedágio"],
  "gas stations": ["Veículo", "Combustível"],
  "vehicle maintenance": ["Veículo", "Manutenção"],
  automotive: ["Veículo", "Manutenção"],
  "car rental": ["Viagens", "Locação de veículo"],
  pharmacy: ["Saúde", "Farmácia"],
  healthcare: ["Saúde", "Médico"],
  dentist: ["Saúde", "Médico"],
  optometry: ["Saúde", "Ótica"],
  "pet supplies and vet": ["Pets", "Pet shop"],
  bookstore: ["Educação", "Livros"],
  education: ["Educação", "Curso"],
  "digital services": ["Assinaturas / Serviços digitais", null],
  telecommunications: ["Telefonia / Internet", "Celular"],
  services: ["Serviços", "Serviços gerais"],
  housing: ["Moradia / Casa", null],
  rent: ["Moradia / Casa", "Aluguel"],
  electricity: ["Moradia / Casa", "Energia"],
  gas: ["Moradia / Casa", "Gás"],
  water: ["Moradia / Casa", "Água"],
  insurance: ["Seguros", "Outros seguros"],
  "tax on financial operations": ["Taxas / Juros / Anuidade", "IOF"],
  "credit card fees": ["Taxas / Juros / Anuidade", "Anuidade"],
  "interests charged": ["Taxas / Juros / Anuidade", "Juros"],
  "loans and financing": ["Taxas / Juros / Anuidade", "Parcelamento"],
  taxes: ["Taxas / Juros / Anuidade", "Tarifa"],
  "bank fees": ["Taxas / Juros / Anuidade", "Tarifa"],
  leisure: ["Lazer / Entretenimento", "Passeios"],
  "cinema, theater and concerts": ["Lazer / Entretenimento", "Cinema"],
  tickets: ["Lazer / Entretenimento", "Eventos"],
  "stadiums and arenas": ["Lazer / Entretenimento", "Eventos"],
  "wellness and fitness": ["Lazer / Entretenimento", "Esportes"],
  gambling: ["Lazer / Entretenimento", "Eventos"],
  travel: ["Viagens", null],
  accomodation: ["Viagens", "Hospedagem"],
  accommodation: ["Viagens", "Hospedagem"],
  "mileage programs": ["Viagens", "Turismo"],
  donations: ["Outros", null],
};

const cacheRegras = new Map<string, { em: number; regras: RegraUsuario[] }>();

async function regrasDoGrupo(db: any, grupoId: string): Promise<RegraUsuario[]> {
  const c = cacheRegras.get(grupoId);
  if (c && Date.now() - c.em < 5 * 60 * 1000) return c.regras;
  const { data } = await db
    .from("categoria_regras")
    .select("id, estabelecimento_normalizado, padroes, tipo_regra, categoria, subcategoria, prioridade, ativo")
    .eq("grupo_id", grupoId)
    .eq("ativo", true);
  const regras = (data ?? []) as RegraUsuario[];
  cacheRegras.set(grupoId, { em: Date.now(), regras });
  return regras;
}

export async function categoriaAutomatica(
  db: any,
  p: { grupoId: string | null; descricao: string | null; valor: number; categoriaPluggy: string | null },
): Promise<{ categoria: string; subcategoria: string | null }> {
  const regras = p.grupoId ? await regrasDoGrupo(db, p.grupoId) : [];
  const c = classificar(p.descricao ?? "", { regras, valor: p.valor });
  if (c.origem_regra === "regra_usuario" || c.origem_regra === "historico_confirmado") {
    return { categoria: c.categoria, subcategoria: c.subcategoria };
  }
  const mapa = MAPA_PLUGGY[(p.categoriaPluggy ?? "").trim().toLowerCase()];
  if (mapa) return { categoria: mapa[0], subcategoria: mapa[1] };
  if (c.categoria !== CATEGORIA_A_CONFIRMAR) return { categoria: c.categoria, subcategoria: c.subcategoria };
  return { categoria: CATEGORIA_A_CONFIRMAR, subcategoria: null };
}

/** Reclassifica as despesas do Open Finance do grupo que ainda estão "a confirmar". Devolve quantas mudaram. */
export async function reclassificarPendentesOpenFinance(db: any, grupoId: string | null): Promise<number> {
  if (!grupoId) return 0;
  const { data: pendentes } = await db
    .from("despesas")
    .select("id, descricao, valor_total, pluggy_transaction_id")
    .eq("grupo_id", grupoId)
    .eq("origem", "pluggy")
    .eq("categoria", CATEGORIA_A_CONFIRMAR)
    .limit(3000);
  if (!pendentes?.length) return 0;
  const categoriaDe = new Map<string, string | null>();
  const ids = pendentes.map((d: any) => d.pluggy_transaction_id).filter(Boolean) as string[];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db
      .from("pluggy_transacoes")
      .select("transaction_id, categoria_pluggy")
      .in("transaction_id", ids.slice(i, i + 200));
    for (const t of data ?? []) categoriaDe.set(t.transaction_id, t.categoria_pluggy ?? null);
  }
  let mudaram = 0;
  for (const d of pendentes) {
    const r = await categoriaAutomatica(db, {
      grupoId,
      descricao: d.descricao,
      valor: Number(d.valor_total) || 0,
      categoriaPluggy: categoriaDe.get(d.pluggy_transaction_id) ?? null,
    });
    if (r.categoria === CATEGORIA_A_CONFIRMAR) continue;
    const { error } = await db
      .from("despesas")
      .update({ categoria: r.categoria, subcategoria: r.subcategoria, categoria_sugerida: r.categoria })
      .eq("id", d.id)
      .eq("categoria", CATEGORIA_A_CONFIRMAR);
    if (!error) mudaram++;
  }
  return mudaram;
}
