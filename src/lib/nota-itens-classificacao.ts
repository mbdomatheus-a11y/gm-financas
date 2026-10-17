/**
 * Mapeamento e classificação automática de itens de nota fiscal para
 * Macro Categorias e Subcategorias do sistema (alinhado a categorizacao.ts e depara.ts).
 */

export type ClassificacaoItem = {
  categoria: string;
  subcategoria: string;
  sugestaoDepreciacao?: {
    meses: number;
    anos: number;
    rotulo: string;
  };
};

/** Dicionário de termos comuns encontrados em cupons fiscais (NFC-e / NF-e) */
const REGRAS_ITENS: Array<{
  padrao: RegExp;
  categoria: string;
  subcategoria: string;
  depreciacao?: { meses: number; rotulo: string };
}> = [
  // ALIMENTAÇÃO - REFEIÇÕES / ALMOÇO / JANTAR
  { padrao: /\b(feijoada|almoco|almoço|prato feito|buffet|refeicao|refeição|comida|marmita|marmitex|self service|rodizio|rodízio|churrasco|porcao|porção)\b/i, categoria: "Alimentação", subcategoria: "Restaurante" },
  { padrao: /\b(lanche|hamburguer|hambúrguer|burger|batata frita|cheeseburger|combo|mcdonald|bk|burger king|bobs|subway)\b/i, categoria: "Alimentação", subcategoria: "Fast-food" },
  { padrao: /\b(pizza|esfiha|esfirra|calzone|sushi|sashimi|yakisoba|temaki)\b/i, categoria: "Alimentação", subcategoria: "Delivery" },
  { padrao: /\b(cafe|café|espresso|cappuccino|cappucino|pao de queijo|pão de queijo|croissant|bolo|salgado|coxinha|empada|torta|pastel)\b/i, categoria: "Alimentação", subcategoria: "Cafeteria" },
  { padrao: /\b(cerveja|chope|chopp|vinho|whisky|gin|vodka|drink|coquetel|licor)\b/i, categoria: "Alimentação", subcategoria: "Bar" },
  { padrao: /\b(refrigerante|coca cola|pepsi|guarana|guaraná|suco|agua|água mineral|energetico|energético|red bull|monster)\b/i, categoria: "Alimentação", subcategoria: "Lanchonete" },

  // MERCADO
  { padrao: /\b(arroz|feijao|feijão|macarrao|macarrão|oleo|óleo|azeite|acucar|açúcar|sal|farinha|leite|manteiga|queijo|presunto|iogurte|cafe em po|café em pó)\b/i, categoria: "Mercado", subcategoria: "Supermercado" },
  { padrao: /\b(maca|maçã|banana|laranja|limao|limão|tomate|cebola|alho|batata|cenoura|alface|legume|fruta|verdura)\b/i, categoria: "Mercado", subcategoria: "Hortifruti" },
  { padrao: /\b(pao|pão|pao frances|pão francês|baguete|biscoito|bolacha|torrada)\b/i, categoria: "Mercado", subcategoria: "Padaria" },
  { padrao: /\b(sabao|sabão|detergente|amaciante|desinfetante|esponja|papel higienico|papel higiênico|agua sanitaria|água sanitária|cloro|inseticida)\b/i, categoria: "Mercado", subcategoria: "Supermercado" },

  // ELETRÔNICOS / TECNOLOGIA COM SUGESTÃO DE DEPRECIAÇÃO
  { padrao: /\b(notebook|laptop|computador|pc|desktop|macbook)\b/i, categoria: "Tecnologia / IA", subcategoria: "Software", depreciacao: { meses: 36, rotulo: "3 anos (Tecnologia/Equipamentos)" } },
  { padrao: /\b(smartphone|celular|iphone|galaxy|xiaomi|motorola)\b/i, categoria: "Telefonia / Internet", subcategoria: "Celular", depreciacao: { meses: 24, rotulo: "2 anos (Smartphones)" } },
  { padrao: /\b(monitor|teclado|mouse|headset|fone de ouvido|webcam|impressora|nobreak|roteador|ssd|memoria ram|placa de video)\b/i, categoria: "Tecnologia / IA", subcategoria: "Ferramentas profissionais", depreciacao: { meses: 24, rotulo: "2 anos (Periféricos)" } },
  { padrao: /\b(televisao|televisão|smart tv|tv led|tv oled|soundbar|home theater)\b/i, categoria: "Compras / Varejo", subcategoria: "Compras diversas", depreciacao: { meses: 60, rotulo: "5 anos (Eletrônicos/Eletrodomésticos)" } },
  { padrao: /\b(geladeira|refrigerador|fogao|fogão|microondas|micro-ondas|maquina de lavar|lava e seca|ar condicionado|aspirador|ventilador|fritadeira|air fryer|cafeteira)\b/i, categoria: "Moradia / Casa", subcategoria: "Móveis", depreciacao: { meses: 60, rotulo: "5 anos (Linha Branca/Eletros)" } },
  { padrao: /\b(sofa|sofá|mesa|cadeira|poltrona|cama|colchao|colchão|guarda roupa|armario|armário|estante|rack)\b/i, categoria: "Moradia / Casa", subcategoria: "Móveis", depreciacao: { meses: 120, rotulo: "10 anos (Móveis e Mobiliário)" } },

  // VESTUÁRIO / CALÇADOS
  { padrao: /\b(camiseta|camisa|polo|regata|calca|calça|bermuda|shorts|vestido|saia|jaqueta|casaco|moletom|meia|cueca|calcinha|sutia|sutiã)\b/i, categoria: "Vestuário / Calçados", subcategoria: "Roupas" },
  { padrao: /\b(tenis|tênis|sapato|sandalia|sandália|chinelo|havaianas|bota|sapatenis|sapatênis)\b/i, categoria: "Vestuário / Calçados", subcategoria: "Calçados" },
  { padrao: /\b(cinto|bolsa|mochila|carteira|relogio|relógio|oculos|óculos|joia|brinco|colar|anel)\b/i, categoria: "Vestuário / Calçados", subcategoria: "Acessórios" },

  // SAÚDE / MEDICAMENTOS
  { padrao: /\b(paracetamol|dipirona|ibuprofeno|amoxicilina|dorflex|neosaldina|remedio|remédio|medicamento|pomada|vitamina|curativo|termometro|termômetro)\b/i, categoria: "Saúde", subcategoria: "Farmácia" },

  // PETS
  { padrao: /\b(racao|ração|petisco|areia higienica|areia higiênica|shampoo pet|antipulgas|coleira|brinquedo pet)\b/i, categoria: "Pets", subcategoria: "Pet shop" },

  // VEÍCULO
  { padrao: /\b(gasolina|etanol|alcool|álcool|diesel|combustivel|combustível)\b/i, categoria: "Veículo", subcategoria: "Combustível" },
  // Consumíveis e serviços (óleo, filtros, alinhamento, pastilha) são despesa de manutenção: NÃO depreciam.
  { padrao: /\b(oleo motor|óleo motor|filtro de oleo|filtro de ar|alinhamento|balanceamento|pastilha freio)\b/i, categoria: "Veículo", subcategoria: "Manutenção" },
  // Bens duráveis do veículo: pneu e bateria têm vida útil própria.
  { padrao: /\b(pneu)\b/i, categoria: "Veículo", subcategoria: "Manutenção", depreciacao: { meses: 36, rotulo: "3 anos (Pneus)" } },
  { padrao: /\b(bateria automotiva)\b/i, categoria: "Veículo", subcategoria: "Manutenção", depreciacao: { meses: 24, rotulo: "2 anos (Bateria)" } },

  // BELEZA / CUIDADOS PESSOAIS
  { padrao: /\b(shampoo|condicionador|sabonete|desodorante|perfume|hidratante|protetor solar|pasta de dente|creme dental|fio dental|esmalte|maquiagem|batom)\b/i, categoria: "Beleza / Cuidados pessoais", subcategoria: "Cosméticos" },
];

/** Classifica um item da nota fiscal a partir da sua descrição e regras conhecidas */
export function classificarItemNota(descricao: string): ClassificacaoItem {
  const descNormalizada = (descricao ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  for (const regra of REGRAS_ITENS) {
    if (regra.padrao.test(descNormalizada)) {
      if (regra.depreciacao) {
        return {
          categoria: regra.categoria,
          subcategoria: regra.subcategoria,
          sugestaoDepreciacao: {
            meses: regra.depreciacao.meses,
            anos: Math.round(regra.depreciacao.meses / 12),
            rotulo: regra.depreciacao.rotulo,
          },
        };
      }
      return {
        categoria: regra.categoria,
        subcategoria: regra.subcategoria,
      };
    }
  }

  // Fallback padrão se não coincidir com nenhum padrão
  return {
    categoria: "Outros",
    subcategoria: "Não identificada",
  };
}

/**
 * Calcula a depreciação linear de um item ou bem adquirido.
 * Retorna o valor residual atual, o valor mensal depreciado e o percentual já depreciado.
 */
export function calcularDepreciacao(params: {
  valorOriginal: number;
  dataCompra: string;
  mesesVidaUtil: number;
  dataReferencia?: Date;
}): {
  mesesDecorridos: number;
  mesesRestantes: number;
  valorDepreciado: number;
  /** Valor contábil atual (original menos depreciação acumulada). */
  valorAtual: number;
  /** Alias antigo de valorAtual (mantido por compatibilidade). */
  valorResidual: number;
  taxaMensal: number;
  percentualDepreciado: number;
  totalmenteDepreciado: boolean;
} {
  const { valorOriginal, dataCompra, mesesVidaUtil, dataReferencia = new Date() } = params;
  if (!valorOriginal || valorOriginal <= 0 || !mesesVidaUtil || mesesVidaUtil <= 0) {
    return {
      mesesDecorridos: 0,
      mesesRestantes: 0,
      valorDepreciado: 0,
      valorAtual: valorOriginal,
      valorResidual: valorOriginal,
      taxaMensal: 0,
      percentualDepreciado: 0,
      totalmenteDepreciado: false,
    };
  }

  // "AAAA-MM-DD" lido como data local (new Date("AAAA-MM-DD") é UTC e, no Brasil,
  // joga o dia 1 para o mês anterior).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataCompra ?? "");
  const compra = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dataCompra);
  if (isNaN(compra.getTime())) {
    return {
      mesesDecorridos: 0,
      mesesRestantes: mesesVidaUtil,
      valorDepreciado: 0,
      valorAtual: valorOriginal,
      valorResidual: valorOriginal,
      taxaMensal: valorOriginal / mesesVidaUtil,
      percentualDepreciado: 0,
      totalmenteDepreciado: false,
    };
  }

  // Cálculo de meses decorridos
  const diffAnos = dataReferencia.getFullYear() - compra.getFullYear();
  const diffMeses = dataReferencia.getMonth() - compra.getMonth();
  const totalMeses = Math.max(0, diffAnos * 12 + diffMeses);

  const mesesDecorridos = Math.min(totalMeses, mesesVidaUtil);
  const mesesRestantes = Math.max(0, mesesVidaUtil - mesesDecorridos);

  const taxaMensal = valorOriginal / mesesVidaUtil;
  const valorDepreciado = Math.min(valorOriginal, mesesDecorridos * taxaMensal);
  const valorAtual = Math.max(0, valorOriginal - valorDepreciado);
  const valorResidual = valorAtual;
  const percentualDepreciado = Math.min(100, (valorDepreciado / valorOriginal) * 100);

  return {
    mesesDecorridos,
    mesesRestantes,
    valorDepreciado,
    valorAtual,
    valorResidual,
    taxaMensal,
    percentualDepreciado,
    totalmenteDepreciado: mesesDecorridos >= mesesVidaUtil,
  };
}
