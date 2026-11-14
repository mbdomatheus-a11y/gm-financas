/**
 * Catálogo dos alertas do sistema (14/11/2026). Uma linha por tipo de public.config_alertas
 * (migration 20261114110000). Os padrões repetem o seed: se a tabela ainda não existe, o servidor
 * segue estes valores e nada muda. Ver docs/alertas.md.
 */
export type FrequenciaAlerta = "na_hora" | "diaria" | "semanal" | "quinzenal" | "mensal";
export type CanalAlerta = "push" | "app" | "email";

export type ConfigAlerta = {
  tipo: string;
  ativo: boolean;
  frequencia: FrequenciaAlerta;
  dia_semana: number | null;
  dia_mes: number | null;
  hora: number | null;
  antecedencia_dias: number | null;
  canais: CanalAlerta[];
  titulo_modelo: string | null;
  atualizado_por?: string | null;
  atualizado_em?: string | null;
};

export type ItemCatalogo = {
  tipo: string;
  nome: string;
  descricao: string;
  /** data: gerado pelo cron conforme a data; evento: gravado quando algo acontece; email: e-mail de retenção. */
  origem: "data" | "evento" | "email";
  /** Antecedência faz sentido (dias antes da data). */
  usaAntecedencia: boolean;
  /** Chave de preferência do usuário (preferencias_notificacao.lembretes) que desliga o tipo para ele. */
  lembrete: string | null;
  /** Título do push resumo quando a frequência não é "na hora" ({n} = quantidade). */
  resumo: string;
  padrao: Omit<ConfigAlerta, "tipo">;
};

const base = (p: Partial<Omit<ConfigAlerta, "tipo">>): Omit<ConfigAlerta, "tipo"> => ({
  ativo: true,
  frequencia: "na_hora",
  dia_semana: null,
  dia_mes: null,
  hora: null,
  antecedencia_dias: null,
  canais: ["push", "app"],
  titulo_modelo: null,
  ...p,
});

export const CATALOGO_ALERTAS: ItemCatalogo[] = [
  { tipo: "parcela_vence", nome: "Conta ou parcela vence", descricao: "Parcela em aberto (fora do cartão) vencendo.", origem: "data", usaAntecedencia: true, lembrete: "despesa_perto_vencer", resumo: "{n} contas vencem em breve", padrao: base({ hora: 7, antecedencia_dias: 1 }) },
  { tipo: "fatura_fecha", nome: "Fatura fecha", descricao: "Dia de fechamento da fatura do cartão.", origem: "data", usaAntecedencia: true, lembrete: "revisar_faturas", resumo: "{n} faturas fecham em breve", padrao: base({ hora: 7, antecedencia_dias: 0 }) },
  { tipo: "fatura_vence", nome: "Fatura vence", descricao: "Vencimento da fatura do cartão.", origem: "data", usaAntecedencia: true, lembrete: "despesa_perto_vencer", resumo: "{n} faturas vencem em breve", padrao: base({ hora: 7, antecedencia_dias: 1 }) },
  { tipo: "garantia_acabando", nome: "Garantia acabando", descricao: "Garantia de nota fiscal perto do fim (30, 7 e 1 dia).", origem: "data", usaAntecedencia: true, lembrete: "garantia_vencendo", resumo: "{n} garantias acabando", padrao: base({ hora: 7, antecedencia_dias: 30 }) },
  { tipo: "parcelas_terminam", nome: "Parcelas que terminam", descricao: "Compras parceladas com a última parcela no período.", origem: "data", usaAntecedencia: true, lembrete: "despesa_perto_vencer", resumo: "{n} parcelas terminam nesta semana", padrao: base({ ativo: false, frequencia: "semanal", dia_semana: 1, hora: 9, antecedencia_dias: 7, titulo_modelo: "{n} parcelas terminam nesta semana" }) },
  { tipo: "limite", nome: "Limite de gastos", descricao: "Limite da categoria perto do fim ou estourado, logo após o lançamento.", origem: "evento", usaAntecedencia: false, lembrete: "limite_perto", resumo: "{n} limites de gastos pedem atenção", padrao: base({}) },
  { tipo: "open_finance", nome: "Open Finance importou", descricao: "Lançamentos novos chegaram do banco.", origem: "evento", usaAntecedencia: false, lembrete: "revisar_transacoes", resumo: "{n} importações do banco", padrao: base({}) },
  { tipo: "convite", nome: "Convite de grupo", descricao: "Alguém convidou a pessoa para dividir as finanças.", origem: "evento", usaAntecedencia: false, lembrete: null, resumo: "{n} convites novos", padrao: base({}) },
  { tipo: "regra_ciclo", nome: "Regra do ciclo alterada", descricao: "Alguém do grupo mudou o dia de virada do ciclo.", origem: "evento", usaAntecedencia: false, lembrete: null, resumo: "{n} mudanças no ciclo", padrao: base({}) },
  { tipo: "layout_pendente", nome: "Fatura para modelar (admin)", descricao: "Usuário enviou fatura para modelagem. Só administradores.", origem: "evento", usaAntecedencia: false, lembrete: null, resumo: "{n} faturas para modelar", padrao: base({}) },
  { tipo: "layout_corrigido", nome: "Fatura modelada", descricao: "O modelo da fatura enviada ficou pronto.", origem: "evento", usaAntecedencia: false, lembrete: null, resumo: "{n} faturas modeladas", padrao: base({}) },
  { tipo: "vencimento_email", nome: "E-mail: vence em breve", descricao: "E-mail com o total que vence daqui a alguns dias.", origem: "email", usaAntecedencia: true, lembrete: null, resumo: "", padrao: base({ frequencia: "diaria", antecedencia_dias: 3, canais: ["email"] }) },
  { tipo: "resumo_semanal_email", nome: "E-mail: resumo semanal", descricao: "Resumo da semana por e-mail.", origem: "email", usaAntecedencia: false, lembrete: null, resumo: "", padrao: base({ frequencia: "semanal", dia_semana: 1, canais: ["email"] }) },
  { tipo: "ativacao_email", nome: "E-mail: primeiro lançamento", descricao: "Convite ao primeiro lançamento (1 e 3 dias após o cadastro).", origem: "email", usaAntecedencia: false, lembrete: null, resumo: "", padrao: base({ frequencia: "diaria", canais: ["email"] }) },
];

export const FREQUENCIAS: { valor: FrequenciaAlerta; rotulo: string }[] = [
  { valor: "na_hora", rotulo: "Na hora" },
  { valor: "diaria", rotulo: "Diária" },
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "quinzenal", rotulo: "Quinzenal" },
  { valor: "mensal", rotulo: "Mensal" },
];

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Dias cobertos por um resumo: o período até o próximo envio. */
export const DIAS_DO_PERIODO: Record<FrequenciaAlerta, number> = { na_hora: 0, diaria: 1, semanal: 7, quinzenal: 15, mensal: 30 };

export const itemCatalogo = (tipo: string) => CATALOGO_ALERTAS.find((c) => c.tipo === tipo) ?? null;
