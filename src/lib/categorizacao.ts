/**
 * Categorização automática de despesas.
 *
 * Ordem de prioridade (item 7 do escopo):
 * 1. regra personalizada do usuário
 * 2. classificações confirmadas pelo usuário / histórico do mesmo estabelecimento
 * 3. base conhecida de estabelecimentos
 * 4. regras por palavra-chave
 * 5. contexto (tipo de lançamento: juros, anuidade, pagamento…)
 * 6. categoria a confirmar
 */

export type Confianca = "alta" | "media" | "baixa";

export const CATEGORIA_A_CONFIRMAR = "Categoria a confirmar";

export const CATEGORIAS_PADRAO: Record<string, string[]> = {
  "Alimentação": [
    "Restaurante",
    "Fast-food",
    "Delivery",
    "Cafeteria",
    "Bar",
    "Lanchonete",
    "Conveniência",
  ],
  Mercado: ["Supermercado", "Hortifruti", "Atacado", "Padaria"],
  Transporte: [
    "Transporte por aplicativo",
    "Táxi",
    "Transporte público",
    "Pedágio",
    "Estacionamento",
  ],
  "Veículo": ["Combustível", "Manutenção", "Acessórios", "Seguro veicular", "Vistoria"],
  "Moradia / Casa": ["Aluguel", "Condomínio", "Energia", "Água", "Gás", "Móveis", "Reformas"],
  "Compras / Varejo": [
    "Loja de departamento",
    "E-commerce",
    "Utilidades",
    "Presentes",
    "Compras diversas",
  ],
  "Vestuário / Calçados": ["Roupas", "Calçados", "Acessórios"],
  "Saúde": ["Farmácia", "Médico", "Hospital", "Ótica", "Exames", "Plano de saúde"],
  Pets: ["Pet shop", "Veterinário", "Medicamentos", "Alimentação pet"],
  "Assinaturas / Serviços digitais": ["Streaming", "Música", "Notícias", "Nuvem"],
  "Tecnologia / IA": [
    "Inteligência Artificial",
    "Software",
    "SaaS",
    "Aplicativos",
    "Ferramentas profissionais",
  ],
  "Telefonia / Internet": ["Celular", "Internet", "TV"],
  Seguros: ["Seguro residencial", "Seguro de vida", "Seguro veicular", "Outros seguros"],
  "Educação": ["Curso", "Faculdade", "Livros", "Escola"],
  "Beleza / Cuidados pessoais": ["Salão", "Barbearia", "Cosméticos", "Estética"],
  "Lazer / Entretenimento": ["Cinema", "Eventos", "Esportes", "Passeios"],
  Games: ["Jogos", "Assinatura de games", "Itens virtuais"],
  Viagens: ["Passagens", "Hospedagem", "Locação de veículo", "Turismo"],
  "Serviços": ["Serviços gerais", "Profissionais", "Assinatura de serviços"],
  "Taxas / Juros / Anuidade": ["Juros", "IOF", "Anuidade", "Multa", "Parcelamento", "Tarifa"],
  Outros: ["Não identificada"],
  [CATEGORIA_A_CONFIRMAR]: ["Não identificada"],
};

export const LISTA_CATEGORIAS = Object.keys(CATEGORIAS_PADRAO);

export function subcategoriasDe(categoria: string): string[] {
  return CATEGORIAS_PADRAO[categoria] ?? [];
}

/* ------------------------------------------------------------------ */
/* Normalização do estabelecimento                                     */
/* ------------------------------------------------------------------ */

const RUIDO = [
  /\bparc(ela)?\.?\s*\d{1,2}\s*(\/|de)\s*\d{1,2}\b/gi,
  /\b\d{1,2}\s*\/\s*\d{1,2}\b/g,
  /\bltda\b|\bs\.?a\.?\b|\beireli\b|\bme\b|\bmei\b|\bcia\b/gi,
  /\bbrasil\b|\bbr\b|\bbra\b/gi,
  /\b\d{2}\/\d{2}(\/\d{2,4})?\b/g,
  /\*+/g,
];

/** Chave estável usada para casar regras e histórico. */
export function chaveEstabelecimento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 *\/.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Marca = { nome: string; padroes: RegExp[] };

const MARCAS: Marca[] = [
  { nome: "Uber", padroes: [/\bUBER\b/] },
  { nome: "99", padroes: [/\b99\s?(APP|TAXI|POP|TECNOLOGIA)\b/] },
  { nome: "iFood", padroes: [/\bIFOOD\b/, /\bIFD\b/] },
  { nome: "Rappi", padroes: [/\bRAPPI\b/] },
  { nome: "McDonald's", padroes: [/\bMC\s?DONALD/, /\bMCDONALDS?\b/, /\bMETODO\s?MC\b/] },
  { nome: "Burger King", padroes: [/\bBURGER\s?KING\b/, /\bBK\s?\d/] },
  { nome: "Subway", padroes: [/\bSUBWAY\b/] },
  { nome: "Starbucks", padroes: [/\bSTARBUCKS\b/] },
  { nome: "Rei do Mate", padroes: [/\bREI\s?DO\s?MATE\b/] },
  { nome: "Grupo Madero", padroes: [/\bMADERO\b/] },
  { nome: "Outback", padroes: [/\bOUTBACK\b/] },
  { nome: "Habib's", padroes: [/\bHABIB/] },
  { nome: "Amazon", padroes: [/\bAMAZON/, /\bAMZN\b/] },
  { nome: "Mercado Livre", padroes: [/\bMERCADO\s?LIVRE\b/, /\bMERCADOLIVRE\b/, /\bMERPAGO\b/] },
  { nome: "Shopee", padroes: [/\bSHOPEE\b/] },
  { nome: "AliExpress", padroes: [/\bALIEXPRESS\b/] },
  { nome: "Magazine Luiza", padroes: [/\bMAGAZINE\s?LUIZA\b/, /\bMAGALU\b/] },
  { nome: "Americanas", padroes: [/\bAMERICANAS\b/] },
  { nome: "Renner", padroes: [/\bRENNER\b/] },
  { nome: "Riachuelo", padroes: [/\bRIACHUELO\b/] },
  { nome: "C&A", padroes: [/\bC\s?&\s?A\b/, /\bCEA\s?MODAS\b/] },
  { nome: "Centauro", padroes: [/\bCENTAURO\b/] },
  { nome: "Netshoes", padroes: [/\bNETSHOES\b/] },
  { nome: "Apple", padroes: [/\bAPPLE(\.COM)?\b/, /\bITUNES\b/] },
  { nome: "Google", padroes: [/\bGOOGLE\b/, /\bGOOGL\b/] },
  { nome: "Microsoft", padroes: [/\bMICROSOFT\b/, /\bMSFT\b/] },
  { nome: "Netflix", padroes: [/\bNETFLIX\b/] },
  { nome: "Spotify", padroes: [/\bSPOTIFY\b/] },
  { nome: "Disney+", padroes: [/\bDISNEY\b/] },
  { nome: "HBO Max", padroes: [/\bHBO\b/, /\bMAX\.COM\b/] },
  { nome: "Prime Video", padroes: [/\bPRIME\s?VIDEO\b/] },
  { nome: "YouTube", padroes: [/\bYOUTUBE\b/] },
  { nome: "Canva", padroes: [/\bCANVA\b/] },
  { nome: "Lovable", padroes: [/\bLOVABLE\b/] },
  { nome: "OpenAI", padroes: [/\bOPENAI\b/, /\bCHATGPT\b/] },
  { nome: "Anthropic", padroes: [/\bANTHROPIC\b/, /\bCLAUDE\.AI\b/] },
  { nome: "Cursor", padroes: [/\bCURSOR\s?(AI|SH|COM)?\b/] },
  { nome: "GitHub", padroes: [/\bGITHUB\b/] },
  { nome: "Notion", padroes: [/\bNOTION\b/] },
  { nome: "Petz", padroes: [/\bPETZ\b/] },
  { nome: "Cobasi", padroes: [/\bCOBASI\b/] },
  { nome: "Drogaria São Paulo", padroes: [/\bDROGARIA\s?SAO\s?PAULO\b/] },
  { nome: "Drogasil", padroes: [/\bDROGASIL\b/] },
  { nome: "Raia", padroes: [/\bDROGA\s?RAIA\b/, /\bRAIADROGASIL\b/] },
  { nome: "Pague Menos", padroes: [/\bPAGUE\s?MENOS\b/] },
  { nome: "Carrefour", padroes: [/\bCARREFOUR\b/] },
  { nome: "Assaí", padroes: [/\bASSAI\b/] },
  { nome: "Atacadão", padroes: [/\bATACADAO\b/] },
  { nome: "Pão de Açúcar", padroes: [/\bPAO\s?DE\s?ACUCAR\b/] },
  { nome: "Porto Seguro", padroes: [/\bPORTO\s?SEGURO\b/] },
  { nome: "Shell", padroes: [/\bSHELL\b/] },
  { nome: "Ipiranga", padroes: [/\bIPIRANGA\b/] },
  { nome: "Petrobras", padroes: [/\bPETROBRAS\b/, /\bBR\s?MANIA\b/] },
  { nome: "Vivo", padroes: [/\bVIVO\b/] },
  { nome: "Claro", padroes: [/\bCLARO\b/] },
  { nome: "Tim", padroes: [/\bTIM\s?(CEL|BRASIL|SA)?\b/] },
  { nome: "Steam", padroes: [/\bSTEAM(GAMES)?\b/, /\bVALVE\b/] },
  { nome: "PlayStation", padroes: [/\bPLAYSTATION\b/, /\bPSN\b/] },
  { nome: "Xbox", padroes: [/\bXBOX\b/] },
  { nome: "Nintendo", padroes: [/\bNINTENDO\b/] },
  { nome: "Booking.com", padroes: [/\bBOOKING\b/] },
  { nome: "Airbnb", padroes: [/\bAIRBNB\b/] },
  { nome: "Latam", padroes: [/\bLATAM\b/] },
  { nome: "Gol", padroes: [/\bGOL\s?LINHAS\b/, /\bGOL\s?TRANSP/] },
  { nome: "Azul", padroes: [/\bAZUL\s?LINHAS\b/, /\bAZUL\s?VIAGENS\b/] },
];

const PALAVRAS_MENOR = new Set(["de", "da", "do", "das", "dos", "e", "em", "no", "na", "com"]);

function titulo(texto: string): string {
  return texto
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .filter(Boolean)
    .map((p, i) => {
      if (i > 0 && PALAVRAS_MENOR.has(p)) return p;
      if (p.length <= 2) return p.toLocaleUpperCase("pt-BR");
      return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1);
    })
    .join(" ");
}

/** Transforma a descrição bruta da fatura num nome de estabelecimento legível. */
export function normalizarEstabelecimento(descricao: string): string {
  const chave = chaveEstabelecimento(descricao);
  for (const marca of MARCAS) {
    if (marca.padroes.some((re) => re.test(chave))) return marca.nome;
  }

  let limpo = chave;
  for (const re of RUIDO) limpo = limpo.replace(re, " ");
  limpo = limpo
    .replace(/\b[A-Z]{2}\s*$/g, " ") // UF solta no fim
    .replace(/\.COM(\.BR)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!limpo) return titulo(chave.slice(0, 40));
  // Descrições sem espaço (ex.: MARCELOSANTOSLIMA) ficam como estão, em título.
  return titulo(limpo.slice(0, 60));
}

/* ------------------------------------------------------------------ */
/* Base de conhecimento                                                */
/* ------------------------------------------------------------------ */

type Sugestao = { categoria: string; subcategoria: string | null; confianca: Confianca };

const BASE_MARCAS: Record<string, Sugestao> = {
  Uber: { categoria: "Transporte", subcategoria: "Transporte por aplicativo", confianca: "alta" },
  "99": { categoria: "Transporte", subcategoria: "Transporte por aplicativo", confianca: "alta" },
  iFood: { categoria: "Alimentação", subcategoria: "Delivery", confianca: "alta" },
  Rappi: { categoria: "Alimentação", subcategoria: "Delivery", confianca: "alta" },
  "McDonald's": { categoria: "Alimentação", subcategoria: "Fast-food", confianca: "alta" },
  "Burger King": { categoria: "Alimentação", subcategoria: "Fast-food", confianca: "alta" },
  Subway: { categoria: "Alimentação", subcategoria: "Fast-food", confianca: "alta" },
  "Habib's": { categoria: "Alimentação", subcategoria: "Fast-food", confianca: "alta" },
  Starbucks: { categoria: "Alimentação", subcategoria: "Cafeteria", confianca: "alta" },
  "Rei do Mate": { categoria: "Alimentação", subcategoria: "Cafeteria", confianca: "alta" },
  "Grupo Madero": { categoria: "Alimentação", subcategoria: "Restaurante", confianca: "alta" },
  Outback: { categoria: "Alimentação", subcategoria: "Restaurante", confianca: "alta" },
  Amazon: { categoria: "Compras / Varejo", subcategoria: "E-commerce", confianca: "alta" },
  "Mercado Livre": { categoria: "Compras / Varejo", subcategoria: "E-commerce", confianca: "alta" },
  Shopee: { categoria: "Compras / Varejo", subcategoria: "E-commerce", confianca: "alta" },
  AliExpress: { categoria: "Compras / Varejo", subcategoria: "E-commerce", confianca: "alta" },
  "Magazine Luiza": {
    categoria: "Compras / Varejo",
    subcategoria: "Loja de departamento",
    confianca: "alta",
  },
  Americanas: {
    categoria: "Compras / Varejo",
    subcategoria: "Loja de departamento",
    confianca: "alta",
  },
  Renner: { categoria: "Vestuário / Calçados", subcategoria: "Roupas", confianca: "alta" },
  Riachuelo: { categoria: "Vestuário / Calçados", subcategoria: "Roupas", confianca: "alta" },
  "C&A": { categoria: "Vestuário / Calçados", subcategoria: "Roupas", confianca: "alta" },
  Centauro: { categoria: "Vestuário / Calçados", subcategoria: "Calçados", confianca: "media" },
  Netshoes: { categoria: "Vestuário / Calçados", subcategoria: "Calçados", confianca: "media" },
  Apple: { categoria: "Tecnologia / IA", subcategoria: "Aplicativos", confianca: "media" },
  Google: { categoria: "Tecnologia / IA", subcategoria: "SaaS", confianca: "media" },
  Microsoft: { categoria: "Tecnologia / IA", subcategoria: "Software", confianca: "alta" },
  Canva: { categoria: "Tecnologia / IA", subcategoria: "Software", confianca: "alta" },
  Lovable: {
    categoria: "Tecnologia / IA",
    subcategoria: "Inteligência Artificial",
    confianca: "alta",
  },
  OpenAI: {
    categoria: "Tecnologia / IA",
    subcategoria: "Inteligência Artificial",
    confianca: "alta",
  },
  Anthropic: {
    categoria: "Tecnologia / IA",
    subcategoria: "Inteligência Artificial",
    confianca: "alta",
  },
  Cursor: { categoria: "Tecnologia / IA", subcategoria: "Ferramentas profissionais", confianca: "alta" },
  GitHub: { categoria: "Tecnologia / IA", subcategoria: "Ferramentas profissionais", confianca: "alta" },
  Notion: { categoria: "Tecnologia / IA", subcategoria: "SaaS", confianca: "alta" },
  Netflix: {
    categoria: "Assinaturas / Serviços digitais",
    subcategoria: "Streaming",
    confianca: "alta",
  },
  "Disney+": {
    categoria: "Assinaturas / Serviços digitais",
    subcategoria: "Streaming",
    confianca: "alta",
  },
  "HBO Max": {
    categoria: "Assinaturas / Serviços digitais",
    subcategoria: "Streaming",
    confianca: "alta",
  },
  "Prime Video": {
    categoria: "Assinaturas / Serviços digitais",
    subcategoria: "Streaming",
    confianca: "alta",
  },
  YouTube: {
    categoria: "Assinaturas / Serviços digitais",
    subcategoria: "Streaming",
    confianca: "alta",
  },
  Spotify: {
    categoria: "Assinaturas / Serviços digitais",
    subcategoria: "Música",
    confianca: "alta",
  },
  Petz: { categoria: "Pets", subcategoria: "Pet shop", confianca: "alta" },
  Cobasi: { categoria: "Pets", subcategoria: "Pet shop", confianca: "alta" },
  "Drogaria São Paulo": { categoria: "Saúde", subcategoria: "Farmácia", confianca: "alta" },
  Drogasil: { categoria: "Saúde", subcategoria: "Farmácia", confianca: "alta" },
  Raia: { categoria: "Saúde", subcategoria: "Farmácia", confianca: "alta" },
  "Pague Menos": { categoria: "Saúde", subcategoria: "Farmácia", confianca: "alta" },
  Carrefour: { categoria: "Mercado", subcategoria: "Supermercado", confianca: "alta" },
  "Assaí": { categoria: "Mercado", subcategoria: "Atacado", confianca: "alta" },
  "Atacadão": { categoria: "Mercado", subcategoria: "Atacado", confianca: "alta" },
  "Pão de Açúcar": { categoria: "Mercado", subcategoria: "Supermercado", confianca: "alta" },
  "Porto Seguro": { categoria: "Seguros", subcategoria: "Outros seguros", confianca: "alta" },
  Shell: { categoria: "Veículo", subcategoria: "Combustível", confianca: "alta" },
  Ipiranga: { categoria: "Veículo", subcategoria: "Combustível", confianca: "alta" },
  Petrobras: { categoria: "Veículo", subcategoria: "Combustível", confianca: "alta" },
  Vivo: { categoria: "Telefonia / Internet", subcategoria: "Celular", confianca: "alta" },
  Claro: { categoria: "Telefonia / Internet", subcategoria: "Celular", confianca: "alta" },
  Tim: { categoria: "Telefonia / Internet", subcategoria: "Celular", confianca: "alta" },
  Steam: { categoria: "Games", subcategoria: "Jogos", confianca: "alta" },
  PlayStation: { categoria: "Games", subcategoria: "Jogos", confianca: "alta" },
  Xbox: { categoria: "Games", subcategoria: "Jogos", confianca: "alta" },
  Nintendo: { categoria: "Games", subcategoria: "Jogos", confianca: "alta" },
  "Booking.com": { categoria: "Viagens", subcategoria: "Hospedagem", confianca: "alta" },
  Airbnb: { categoria: "Viagens", subcategoria: "Hospedagem", confianca: "alta" },
  Latam: { categoria: "Viagens", subcategoria: "Passagens", confianca: "alta" },
  Gol: { categoria: "Viagens", subcategoria: "Passagens", confianca: "alta" },
  Azul: { categoria: "Viagens", subcategoria: "Passagens", confianca: "alta" },
};

type RegraChave = { re: RegExp } & Sugestao;

const REGRAS_PALAVRA: RegraChave[] = [
  { re: /\b(TAXI|CABIFY|BLABLA)\b/, categoria: "Transporte", subcategoria: "Táxi", confianca: "media" },
  { re: /\b(PEDAGIO|SEM\s?PARAR|CONECTCAR|VELOE)\b/, categoria: "Transporte", subcategoria: "Pedágio", confianca: "alta" },
  { re: /\b(ESTACIONAMENTO|ESTAPAR|PARK)\b/, categoria: "Transporte", subcategoria: "Estacionamento", confianca: "media" },
  { re: /\b(METRO|BILHETE\s?UNICO|CPTM|ONIBUS|BUSER)\b/, categoria: "Transporte", subcategoria: "Transporte público", confianca: "media" },
  { re: /\b(AUTO\s?POSTO|POSTO|COMBUSTIVEL|GASOLINA|ETANOL)\b/, categoria: "Veículo", subcategoria: "Combustível", confianca: "alta" },
  { re: /\b(OFICINA|MECANICA|PNEU|AUTO\s?CENTER|LAVA\s?RAPIDO)\b/, categoria: "Veículo", subcategoria: "Manutenção", confianca: "media" },
  { re: /\b(DROGARIA|DROGA|FARMACIA|FARMA)\b/, categoria: "Saúde", subcategoria: "Farmácia", confianca: "alta" },
  { re: /\b(HOSPITAL|CLINICA|LABORATORIO|EXAME|ODONTO|DENTISTA|MEDICO)\b/, categoria: "Saúde", subcategoria: "Médico", confianca: "media" },
  { re: /\b(OTICA|OPTICA)\b/, categoria: "Saúde", subcategoria: "Ótica", confianca: "alta" },
  { re: /\b(RESTAURANTE|PIZZARIA|BURGER|CHURRASC|SUSHI|TEMAKI|GRILL|COMIDA)\b/, categoria: "Alimentação", subcategoria: "Restaurante", confianca: "media" },
  { re: /\b(LANCHONETE|LANCHES|PADARIA|CAFE|CAFETERIA|DOCERIA|SORVETE|ACAI)\b/, categoria: "Alimentação", subcategoria: "Lanchonete", confianca: "media" },
  { re: /\b(BAR|CHOPP|CERVEJ|PUB|DISTRIBUIDORA\s?DE\s?BEBIDAS)\b/, categoria: "Alimentação", subcategoria: "Bar", confianca: "media" },
  { re: /\b(VEND|MACHINES|CONVENIENCIA)\b/, categoria: "Alimentação", subcategoria: "Conveniência", confianca: "media" },
  { re: /\b(SUPERMERCADO|MERCADO|HORTIFRUTI|SACOLAO|ATACAD|MINIMERCADO|EMPORIO)\b/, categoria: "Mercado", subcategoria: "Supermercado", confianca: "media" },
  { re: /\b(PET\s?SHOP|PETSHOP|AGROPET|PET)\b/, categoria: "Pets", subcategoria: "Pet shop", confianca: "media" },
  { re: /\b(VET|VETERINARI|VETNASA|CLINVET)\b/, categoria: "Pets", subcategoria: "Veterinário", confianca: "media" },
  { re: /\b(STREAMING|ASSINATURA|SUBSCRIPTION|PREMIUM)\b/, categoria: "Assinaturas / Serviços digitais", subcategoria: "Streaming", confianca: "media" },
  { re: /\b(AI|IA|GPT|COPILOT|MIDJOURNEY|PERPLEXITY|REPLICATE)\b/, categoria: "Tecnologia / IA", subcategoria: "Inteligência Artificial", confianca: "media" },
  { re: /\b(SOFTWARE|SAAS|CLOUD|HOSTING|DOMINIO|GODADDY|HOSTGATOR|AWS|AZURE)\b/, categoria: "Tecnologia / IA", subcategoria: "SaaS", confianca: "media" },
  { re: /\b(TELEFON|INTERNET|BANDA\s?LARGA|OI\s?FIBRA|NET\s?SERVICOS|FIBRA)\b/, categoria: "Telefonia / Internet", subcategoria: "Internet", confianca: "media" },
  { re: /\b(SEGURO|SEGUROS|SEGURADORA)\b/, categoria: "Seguros", subcategoria: "Outros seguros", confianca: "media" },
  { re: /\b(ESCOLA|FACULDADE|CURSO|UNIVERSIDADE|ALURA|UDEMY|COLEGIO|LIVRARIA)\b/, categoria: "Educação", subcategoria: "Curso", confianca: "media" },
  { re: /\b(SALAO|BARBEARIA|CABELEIREIRO|ESTETICA|MANICURE|BOTICARIO|SEPHORA|PERFUM)\b/, categoria: "Beleza / Cuidados pessoais", subcategoria: "Salão", confianca: "media" },
  { re: /\b(CINEMA|CINEMARK|INGRESSO|TEATRO|SHOW|EVENTO|SYMPLA|ACADEMIA|SMARTFIT|GYM)\b/, categoria: "Lazer / Entretenimento", subcategoria: "Eventos", confianca: "media" },
  { re: /\b(GAME|GAMES|JOGO|EPIC\s?GAMES|BLIZZARD|RIOT)\b/, categoria: "Games", subcategoria: "Jogos", confianca: "media" },
  { re: /\b(HOTEL|POUSADA|RESORT|VIAGEM|TURISMO|DECOLAR|123MILHAS|AEREO)\b/, categoria: "Viagens", subcategoria: "Hospedagem", confianca: "media" },
  { re: /\b(MAGAZINE|LOJAS|LOJA|SHOPPING|VAREJO|HAVAN)\b/, categoria: "Compras / Varejo", subcategoria: "Compras diversas", confianca: "media" },
  { re: /\b(CONDOMINIO|ALUGUEL|IMOBILIARIA|ENERGIA|ELETROPAULO|ENEL|SABESP|COMGAS|CEMIG|COPEL)\b/, categoria: "Moradia / Casa", subcategoria: "Energia", confianca: "media" },
  { re: /\b(MOVEIS|DECOR|CASA|TOK\s?STOK|LEROY|TELHANORTE|MADEIRA\s?MADEIRA)\b/, categoria: "Moradia / Casa", subcategoria: "Móveis", confianca: "media" },
];

/* ------------------------------------------------------------------ */
/* Tipo do lançamento (item 16)                                        */
/* ------------------------------------------------------------------ */

export type TipoLancamento =
  | "compra"
  | "credito"
  | "estorno"
  | "pagamento"
  | "juros"
  | "iof"
  | "anuidade"
  | "multa"
  | "parcelamento";

export function detectarTipoLancamento(descricao: string, valor: number): TipoLancamento {
  const t = chaveEstabelecimento(descricao);
  if (/\bPAGAMENTO\b|\bPAGTO\b|\bPAG\s?FATURA\b|DEBITO\s?AUTOMATICO/.test(t)) return "pagamento";
  if (/\bESTORNO\b|\bDEVOLUCAO\b|\bREEMBOLSO\b|\bCANCELAMENTO\b/.test(t)) return "estorno";
  if (/\bJUROS\b|\bENCARGOS\b|\bROTATIVO\b/.test(t)) return "juros";
  if (/\bIOF\b/.test(t)) return "iof";
  if (/\bANUIDADE\b|\bTARIFA\b|\bMENSALIDADE\s?CARTAO\b/.test(t)) return "anuidade";
  if (/\bMULTA\b|\bATRASO\b/.test(t)) return "multa";
  if (/\bPARCELAMENTO\s?DE\s?FATURA\b|\bPARC\s?FATURA\b/.test(t)) return "parcelamento";
  if (/\bCREDITO\b/.test(t) || valor < 0) return "credito";
  return "compra";
}

const POR_TIPO: Partial<Record<TipoLancamento, Sugestao>> = {
  juros: { categoria: "Taxas / Juros / Anuidade", subcategoria: "Juros", confianca: "alta" },
  iof: { categoria: "Taxas / Juros / Anuidade", subcategoria: "IOF", confianca: "alta" },
  anuidade: { categoria: "Taxas / Juros / Anuidade", subcategoria: "Anuidade", confianca: "alta" },
  multa: { categoria: "Taxas / Juros / Anuidade", subcategoria: "Multa", confianca: "alta" },
  parcelamento: {
    categoria: "Taxas / Juros / Anuidade",
    subcategoria: "Parcelamento",
    confianca: "alta",
  },
  pagamento: { categoria: "Outros", subcategoria: "Não identificada", confianca: "alta" },
};

/* ------------------------------------------------------------------ */
/* Classificação                                                       */
/* ------------------------------------------------------------------ */

export type RegraUsuario = {
  id?: string;
  estabelecimento_normalizado: string;
  tipo_regra?: string | null;
  categoria: string;
  subcategoria: string | null;
  prioridade?: number | null;
  ativo?: boolean | null;
};

export type HistoricoItem = {
  estabelecimento_normalizado: string | null;
  categoria: string | null;
  subcategoria: string | null;
  categoria_confirmada?: boolean | null;
};

export type Classificacao = {
  estabelecimento: string;
  estabelecimento_normalizado: string;
  categoria: string;
  subcategoria: string | null;
  confianca: Confianca;
  origem_regra:
    | "regra_usuario"
    | "historico_confirmado"
    | "historico"
    | "base"
    | "palavra_chave"
    | "contexto"
    | "nenhuma";
  regra_id: string | null;
  tipo_lancamento: TipoLancamento;
};

export type ContextoClassificacao = {
  regras?: RegraUsuario[];
  historico?: HistoricoItem[];
  valor?: number;
};

/** Classifica uma descrição de lançamento seguindo a ordem de prioridade do escopo. */
export function classificar(descricao: string, ctx: ContextoClassificacao = {}): Classificacao {
  const estabelecimento = normalizarEstabelecimento(descricao);
  const chaveNome = chaveEstabelecimento(estabelecimento);
  const chaveBruta = chaveEstabelecimento(descricao);
  const tipo = detectarTipoLancamento(descricao, ctx.valor ?? 0);

  const base = {
    estabelecimento,
    estabelecimento_normalizado: chaveNome,
    tipo_lancamento: tipo,
  };

  // 1. regra do usuário
  const regras = (ctx.regras ?? [])
    .filter((r) => r.ativo !== false)
    .sort((a, b) => (b.prioridade ?? 100) - (a.prioridade ?? 100));
  const regra = regras.find((r) => {
    const alvo = chaveEstabelecimento(r.estabelecimento_normalizado);
    if (!alvo) return false;
    return (
      alvo === chaveNome ||
      chaveNome.includes(alvo) ||
      chaveBruta.includes(alvo)
    );
  });
  if (regra) {
    return {
      ...base,
      categoria: regra.categoria,
      subcategoria: regra.subcategoria ?? null,
      confianca: "alta",
      origem_regra: "regra_usuario",
      regra_id: regra.id ?? null,
    };
  }

  // 2/3. histórico do mesmo estabelecimento
  const hist = (ctx.historico ?? []).filter(
    (h) => h.categoria && chaveEstabelecimento(h.estabelecimento_normalizado ?? "") === chaveNome,
  );
  const confirmado = hist.find((h) => h.categoria_confirmada);
  const usado = confirmado ?? hist[0];
  if (usado) {
    return {
      ...base,
      categoria: usado.categoria!,
      subcategoria: usado.subcategoria ?? null,
      confianca: confirmado ? "alta" : "media",
      origem_regra: confirmado ? "historico_confirmado" : "historico",
      regra_id: null,
    };
  }

  // 4. base conhecida
  const conhecida = BASE_MARCAS[estabelecimento];
  if (conhecida) {
    return { ...base, ...conhecida, origem_regra: "base", regra_id: null };
  }

  // 5. contexto (juros, anuidade, pagamento…)
  const porTipo = POR_TIPO[tipo];
  if (porTipo) {
    return { ...base, ...porTipo, origem_regra: "contexto", regra_id: null };
  }

  // 6. palavras-chave
  const palavra = REGRAS_PALAVRA.find((r) => r.re.test(chaveBruta) || r.re.test(chaveNome));
  if (palavra) {
    return {
      ...base,
      categoria: palavra.categoria,
      subcategoria: palavra.subcategoria,
      confianca: palavra.confianca,
      origem_regra: "palavra_chave",
      regra_id: null,
    };
  }

  // 7. sem evidência suficiente
  return {
    ...base,
    categoria: CATEGORIA_A_CONFIRMAR,
    subcategoria: null,
    confianca: "baixa",
    origem_regra: "nenhuma",
    regra_id: null,
  };
}

export const CONFIANCA_LABEL: Record<Confianca, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
