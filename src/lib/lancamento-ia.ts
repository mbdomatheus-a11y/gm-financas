import { z } from "zod";

/**
 * Lançamento rápido por texto/áudio (IA) — tipos e validação compartilhados
 * entre a UI (`LancamentoRapidoDialog`) e as server functions
 * (`lancamento-ia.functions.ts`). Ver `claude/plano-lancamento-ia-2026-10-01.md`
 * no projeto Claude para o desenho completo.
 *
 * Regra de ouro (igual a `lancamento-texto.ts`): a IA nunca inventa — campo
 * incerto vem `null` e listado em `campos_faltantes`. A resposta da IA passa
 * por este schema `zod` antes de tocar a UI; nada é inserido no banco sem o
 * usuário revisar/confirmar num formulário editável.
 */
export const RascunhoIASchema = z.object({
  tipo: z.enum(["despesa", "receita"]).nullable(),
  descricao: z.string().trim().min(1).nullable(),
  valor: z.number().positive().nullable(),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  categoria: z.string().trim().min(1).nullable(),
  responsavel: z.string().trim().min(1).nullable(),
  forma_pagamento: z.string().trim().min(1).nullable(),
  parcelas: z.number().int().min(1).max(60).nullable(),
  confianca: z.number().min(0).max(1).default(0.5),
  campos_faltantes: z.array(z.string()).default([]),
  observacao_ia: z.string().trim().nullable().optional(),
});

export type RascunhoIA = z.infer<typeof RascunhoIASchema>;

/** Rascunho "vazio" — usado quando a IA falha ou não está configurada, pra
 * cair direto no formulário manual sem travar o usuário. */
export const RASCUNHO_VAZIO: RascunhoIA = {
  tipo: null,
  descricao: null,
  valor: null,
  data: null,
  categoria: null,
  responsavel: null,
  forma_pagamento: null,
  parcelas: null,
  confianca: 0,
  campos_faltantes: ["tudo"],
  observacao_ia: null,
};

/** Contexto enviado à IA — nomes reais do grupo, montados no client (que já
 * tem esses dados via `useCategorias`/`useCartoes`/`useBancos`/
 * `useProfilesList`) para a server function não precisar consultar o banco. */
export type ContextoLancamentoIA = {
  hoje: string; // YYYY-MM-DD, para resolver "hoje"/"ontem" sem depender do fuso do servidor
  perfis: string[];
  categoriasDespesa: string[];
  categoriasReceita: string[];
  formasPagamento: string[]; // nomes de cartões/bancos cadastrados, já rotulados
  usuarioAtual: string | null; // nome do usuário logado, pra resolver "eu paguei"
};

/** Limite de caracteres do texto livre enviado à IA (lançamento ou pergunta
 * de resumo) — evita custo desproporcional de quem manda um "textão" de
 * propósito. Ver `claude/plano-fase2-lancamento-2026-10-02.md` (Frente 1). */
export const LIMITE_CARACTERES_TEXTO_IA = 500;

/** Resumo financeiro do mês, calculado no CLIENT a partir dos mesmos dados
 * que o Dashboard já usa (`useDespesas`/`useReceitas` + `lancamentosPorCompetencias`
 * de `@/lib/recorrencia`) — a server function só traduz isso em texto, nunca
 * recalcula nem consulta o banco (mesmo espírito de `ContextoLancamentoIA`). */
export type ResumoFinanceiroContexto = {
  competencia: string; // "YYYY-MM"
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  taxaPoupancaPct: number | null; // null quando não há receita no mês
  topCategoriasDespesa: { categoria: string; total: number }[];
  numLancamentosDespesa: number;
  numLancamentosReceita: number;
};
