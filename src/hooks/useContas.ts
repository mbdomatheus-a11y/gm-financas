import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { toISODate } from "@/lib/format";

/**
 * Contas (07/11/2026): contas bancárias e carteira com saldo, e transferências entre contas.
 * Tabelas novas (migration 20261107100000_contas_bancarias.sql); os tipos gerados do Supabase
 * ainda não têm essas tabelas, por isso o acesso passa por `db()` sem tipo.
 * Se a migration ainda não rodou, as listas voltam vazias e `tabelaPendente` fica true.
 */

export type TipoConta = "corrente" | "poupanca" | "carteira" | "investimento" | "outra";

export const TIPOS_CONTA: { valor: TipoConta; rotulo: string }[] = [
  { valor: "corrente", rotulo: "Conta corrente" },
  { valor: "poupanca", rotulo: "Poupança" },
  { valor: "carteira", rotulo: "Carteira" },
  { valor: "investimento", rotulo: "Investimento" },
  { valor: "outra", rotulo: "Outra" },
];

export function rotuloTipoConta(tipo: string): string {
  return TIPOS_CONTA.find((t) => t.valor === tipo)?.rotulo ?? "Conta";
}

export type ContaBancaria = {
  id: string;
  user_id: string;
  grupo_id: string | null;
  nome: string;
  tipo: TipoConta;
  banco_id: string | null;
  saldo_inicial: number;
  data_saldo_inicial: string;
  cor: string | null;
  arquivada: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
  bancos?: { nome: string } | null;
};

export type Transferencia = {
  id: string;
  user_id: string;
  grupo_id: string | null;
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  data: string;
  descricao: string | null;
  created_at: string;
};

export type ContaForm = {
  nome: string;
  tipo: TipoConta;
  banco_id: string | null;
  saldo_inicial: number;
  data_saldo_inicial: string;
  cor?: string | null;
  ordem?: number;
};

export type TransferenciaForm = {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  data: string;
  descricao?: string | null;
};

/** Formato mínimo de receita/despesa que o cálculo de saldo usa (aceita as linhas de useReceitas/useDespesas). */
export type ReceitaParaSaldo = {
  conta_id?: string | null;
  valor: number | string;
  data_recebimento: string;
};
export type DespesaParaSaldo = {
  conta_id?: string | null;
  cartao_id?: string | null;
  direcao?: string | null;
  parcelas?:
    | { valor: number | string; paga: boolean; data_pagamento: string | null; vencimento: string }[]
    | null;
};

export type Movimento = {
  data: string;
  valor: number;
  tipo: "receita" | "despesa" | "transferencia";
};

// Tabelas novas ainda fora dos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const arred = (v: number) => Math.round(v * 100) / 100;

/** Erro de tabela que ainda não existe (migration não rodou). */
export function ehTabelaPendente(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  return /does not exist|could not find the table|schema cache/i.test(err.message ?? "");
}

class TabelaPendente extends Error {
  constructor() {
    super("tabela pendente");
  }
}

async function grupoAtual(): Promise<{ userId: string; grupoId: string }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Entre de novo.");
  const { data: p } = await db()
    .from("profiles")
    .select("grupo_id")
    .eq("id", u.user.id)
    .maybeSingle();
  if (!p?.grupo_id) throw new Error("Seu usuário não está em um grupo.");
  return { userId: u.user.id, grupoId: p.grupo_id };
}

async function listarContas(): Promise<ContaBancaria[]> {
  const { data, error } = await db()
    .from("contas_bancarias")
    .select("*, bancos(nome)")
    .order("arquivada", { ascending: true })
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (ehTabelaPendente(error)) throw new TabelaPendente();
    throw error;
  }
  return ((data ?? []) as ContaBancaria[]).map((c) => ({
    ...c,
    saldo_inicial: num(c.saldo_inicial),
  }));
}

async function listarTransferencias(): Promise<Transferencia[]> {
  const { data, error } = await db()
    .from("transferencias")
    .select("*")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (ehTabelaPendente(error)) throw new TabelaPendente();
    throw error;
  }
  return ((data ?? []) as Transferencia[]).map((t) => ({ ...t, valor: num(t.valor) }));
}

const semRetentarPendente = (n: number, e: unknown) => !(e instanceof TabelaPendente) && n < 2;

/**
 * Lista as contas do grupo. `incluirArquivadas` false (padrão) devolve só as ativas em `contas`;
 * `todas` sempre traz todas (útil para mostrar o nome em transferências antigas).
 */
export function useContas(opts: { incluirArquivadas?: boolean } = {}) {
  const q = useQuery({
    queryKey: ["contas-bancarias"],
    queryFn: listarContas,
    retry: semRetentarPendente,
    staleTime: 60_000,
  });
  const tabelaPendente = q.error instanceof TabelaPendente;
  const todas = q.data ?? [];
  const contas = opts.incluirArquivadas ? todas : todas.filter((c) => !c.arquivada);
  return {
    ...q,
    contas,
    todas,
    tabelaPendente,
    erro: tabelaPendente ? null : (q.error as Error | null),
  };
}

export function useTransferencias() {
  const q = useQuery({
    queryKey: ["transferencias"],
    queryFn: listarTransferencias,
    retry: semRetentarPendente,
    staleTime: 60_000,
  });
  const tabelaPendente = q.error instanceof TabelaPendente;
  return {
    ...q,
    transferencias: q.data ?? [],
    tabelaPendente,
    erro: tabelaPendente ? null : (q.error as Error | null),
  };
}

const msg = (e: unknown, padrao: string) => {
  if (ehTabelaPendente(e)) return "As tabelas de contas ainda não existem. Rode a migration.";
  return e instanceof Error && e.message ? e.message : padrao;
};

function useInvalidarContas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["contas-bancarias"] });
    qc.invalidateQueries({ queryKey: ["transferencias"] });
  };
}

export function useCriarConta() {
  const invalidar = useInvalidarContas();
  return useMutation({
    mutationFn: async (f: ContaForm): Promise<ContaBancaria> => {
      const { userId, grupoId } = await grupoAtual();
      const { data, error } = await db()
        .from("contas_bancarias")
        .insert({ ...f, nome: f.nome.trim(), user_id: userId, grupo_id: grupoId })
        .select("*")
        .single();
      if (error) throw error;
      return data as ContaBancaria;
    },
    onSuccess: () => {
      toast.success("Conta criada.");
      invalidar();
    },
    onError: (e) => toast.error(msg(e, "Não foi possível criar a conta.")),
  });
}

export function useEditarConta() {
  const invalidar = useInvalidarContas();
  return useMutation({
    mutationFn: async ({ id, ...f }: Partial<ContaForm> & { id: string }) => {
      const dados = { ...f, ...(f.nome !== undefined ? { nome: f.nome.trim() } : {}) };
      const { error } = await db().from("contas_bancarias").update(dados).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta atualizada.");
      invalidar();
    },
    onError: (e) => toast.error(msg(e, "Não foi possível salvar a conta.")),
  });
}

/** Arquiva (ou desarquiva com arquivada: false). A conta some das listas, mas o histórico fica. */
export function useArquivarConta() {
  const invalidar = useInvalidarContas();
  return useMutation({
    mutationFn: async ({ id, arquivada = true }: { id: string; arquivada?: boolean }) => {
      const { error } = await db().from("contas_bancarias").update({ arquivada }).eq("id", id);
      if (error) throw error;
      return arquivada;
    },
    onSuccess: (arquivada) => {
      toast.success(arquivada ? "Conta arquivada." : "Conta reativada.");
      invalidar();
    },
    onError: (e) => toast.error(msg(e, "Não foi possível arquivar a conta.")),
  });
}

export function useCriarTransferencia() {
  const invalidar = useInvalidarContas();
  return useMutation({
    mutationFn: async (f: TransferenciaForm) => {
      if (f.conta_origem_id === f.conta_destino_id) throw new Error("Escolha contas diferentes.");
      if (!(f.valor > 0)) throw new Error("Informe um valor maior que zero.");
      const { userId, grupoId } = await grupoAtual();
      const { error } = await db()
        .from("transferencias")
        .insert({
          ...f,
          valor: arred(f.valor),
          descricao: f.descricao?.trim() || null,
          user_id: userId,
          grupo_id: grupoId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transferência registrada.");
      invalidar();
    },
    onError: (e) => toast.error(msg(e, "Não foi possível registrar a transferência.")),
  });
}

export function useExcluirTransferencia() {
  const invalidar = useInvalidarContas();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("transferencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transferência excluída.");
      invalidar();
    },
    onError: (e) => toast.error(msg(e, "Não foi possível excluir a transferência.")),
  });
}

/**
 * Movimentos de uma conta desde data_saldo_inicial até `ate` (padrão: hoje):
 * receitas com conta_id, parcelas pagas de despesas com conta_id e sem cartão
 * (despesa de cartão sai pela fatura, não pela conta) e transferências.
 * Despesa com direcao "credito" (estorno) entra como valor positivo.
 */
export function movimentosDaConta(
  conta: Pick<ContaBancaria, "id" | "data_saldo_inicial">,
  receitas: ReceitaParaSaldo[],
  despesas: DespesaParaSaldo[],
  transferencias: Pick<Transferencia, "conta_origem_id" | "conta_destino_id" | "valor" | "data">[],
  ate: string = toISODate(new Date()),
): Movimento[] {
  const inicio = conta.data_saldo_inicial.slice(0, 10);
  const dentro = (d: string | null | undefined) =>
    !!d && d.slice(0, 10) >= inicio && d.slice(0, 10) <= ate;
  const out: Movimento[] = [];

  for (const r of receitas) {
    if (r.conta_id === conta.id && dentro(r.data_recebimento))
      out.push({ data: r.data_recebimento.slice(0, 10), valor: num(r.valor), tipo: "receita" });
  }
  for (const d of despesas) {
    if (d.conta_id !== conta.id || d.cartao_id) continue;
    const sinal = d.direcao === "credito" ? 1 : -1;
    for (const p of d.parcelas ?? []) {
      if (!p.paga) continue;
      const quando = p.data_pagamento ?? p.vencimento;
      if (dentro(quando))
        out.push({ data: quando.slice(0, 10), valor: sinal * num(p.valor), tipo: "despesa" });
    }
  }
  for (const t of transferencias) {
    if (!dentro(t.data)) continue;
    if (t.conta_destino_id === conta.id)
      out.push({ data: t.data.slice(0, 10), valor: num(t.valor), tipo: "transferencia" });
    if (t.conta_origem_id === conta.id)
      out.push({ data: t.data.slice(0, 10), valor: -num(t.valor), tipo: "transferencia" });
  }
  return out.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

/**
 * Saldo atual da conta: saldo_inicial + receitas com conta_id - despesas pagas com conta_id
 * (não cartão) + transferências entrando - saindo, a partir de data_saldo_inicial. Função pura.
 */
export function saldoAtualDaConta(
  conta: Pick<ContaBancaria, "id" | "saldo_inicial" | "data_saldo_inicial">,
  receitas: ReceitaParaSaldo[],
  despesas: DespesaParaSaldo[],
  transferencias: Pick<Transferencia, "conta_origem_id" | "conta_destino_id" | "valor" | "data">[],
  ate?: string,
): number {
  const movs = movimentosDaConta(conta, receitas, despesas, transferencias, ate);
  return arred(num(conta.saldo_inicial) + movs.reduce((s, m) => s + m.valor, 0));
}

/** Data da última movimentação da conta (ou null se nunca mexeu). */
export function ultimaMovimentacaoDaConta(
  conta: Pick<ContaBancaria, "id" | "data_saldo_inicial">,
  receitas: ReceitaParaSaldo[],
  despesas: DespesaParaSaldo[],
  transferencias: Pick<Transferencia, "conta_origem_id" | "conta_destino_id" | "valor" | "data">[],
): string | null {
  return movimentosDaConta(conta, receitas, despesas, transferencias)[0]?.data ?? null;
}

/**
 * Contas ativas com saldo calculado, prontas para telas e para o formulário de lançamento
 * (seletor "conta ou cartão"). Junta useContas, useTransferencias e os lançamentos já carregados.
 */
export function useContasComSaldo(
  receitas: ReceitaParaSaldo[] = [],
  despesas: DespesaParaSaldo[] = [],
) {
  const c = useContas();
  const t = useTransferencias();
  const linhas = c.contas.map((conta) => ({
    conta,
    saldo: saldoAtualDaConta(conta, receitas, despesas, t.transferencias),
    ultima: ultimaMovimentacaoDaConta(conta, receitas, despesas, t.transferencias),
  }));
  const total = arred(linhas.reduce((s, l) => s + l.saldo, 0));
  return {
    linhas,
    total,
    contas: c.contas,
    todas: c.todas,
    transferencias: t.transferencias,
    isLoading: c.isLoading || t.isLoading,
    tabelaPendente: c.tabelaPendente || t.tabelaPendente,
    erro: c.erro ?? t.erro,
  };
}
