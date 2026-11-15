import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reset de CONTA DE TESTE (14/11/2026), usado para gravar vídeos.
 * A lista é fixa e fica só no servidor. O banco confere de novo (id + e-mail) dentro da função
 * resetar_conta_teste, então nenhuma outra conta é apagada mesmo que a tela seja burlada.
 */
const CONTAS_TESTE = [
  { id: "21c7585b-f5f8-4cfc-8392-0c5a23004516", email: "mwathews@gmail.com" },
  { id: "125ce801-6bee-40b0-b9bf-b519b2d66801", email: "artfoxbrasil@gmail.com" },
] as const;

async function exigirAdminDoSite(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data } = await db.from("site_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Só a administração do site pode usar esta função.");
  return db;
}

export type ContaTeste = {
  id: string;
  email: string;
  nome: string | null;
  ultimoReset: string | null;
  /** Linhas que existem hoje na conta (despesas, receitas, cartões). */
  despesas: number;
  receitas: number;
  cartoes: number;
};

export const adminListarContasTeste = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContaTeste[]> => {
    const db = await exigirAdminDoSite(context.userId);
    const saida: ContaTeste[] = [];
    for (const conta of CONTAS_TESTE) {
      const { data: perfil } = await db.from("profiles").select("nome,grupo_id").eq("id", conta.id).maybeSingle();
      if (!perfil) continue;
      const g = perfil.grupo_id as string | null;
      const contar = async (tabela: string) => {
        if (!g) return 0;
        const { count } = await db.from(tabela).select("id", { count: "exact", head: true }).eq("grupo_id", g);
        return count ?? 0;
      };
      const { data: ultimo } = await db
        .from("reset_backups")
        .select("criado_em")
        .eq("user_id", conta.id)
        .eq("tipo", "conta_teste")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      saida.push({
        id: conta.id,
        email: conta.email,
        nome: (perfil.nome as string | null) ?? null,
        ultimoReset: (ultimo?.criado_em as string | undefined) ?? null,
        despesas: await contar("despesas"),
        receitas: await contar("receitas"),
        cartoes: await contar("cartoes"),
      });
    }
    return saida;
  });

export const adminResetarContaTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), confirmacao: z.string().max(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await exigirAdminDoSite(context.userId);
    if (!CONTAS_TESTE.some((c) => c.id === data.userId)) {
      throw new Error("Esta conta não é uma conta de teste. Reset recusado.");
    }
    if (data.confirmacao.trim().toUpperCase() !== "RESETAR") {
      throw new Error("Confirmação inválida. Digite RESETAR.");
    }
    const { data: apagados, error } = await db.rpc("resetar_conta_teste", {
      p_ator: context.userId,
      p_alvo: data.userId,
      p_confirmacao: data.confirmacao,
    });
    if (error) throw new Error(error.message);
    const contagens = (apagados ?? {}) as Record<string, number>;
    const total = Object.values(contagens).reduce((s, n) => s + Number(n || 0), 0);
    return { ok: true as const, total, contagens };
  });

/** Devolve o último backup da conta de teste, para o admin guardar o arquivo. */
export const adminBaixarBackupContaTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await exigirAdminDoSite(context.userId);
    if (!CONTAS_TESTE.some((c) => c.id === data.userId)) throw new Error("Esta conta não é uma conta de teste.");
    const { data: linha, error } = await db
      .from("reset_backups")
      .select("criado_em,contagens,dados")
      .eq("user_id", data.userId)
      .eq("tipo", "conta_teste")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!linha) throw new Error("Esta conta ainda não tem backup de reset.");
    return {
      formato: "controlall-reset-conta-teste-v1",
      criadoEm: linha.criado_em as string,
      contagens: linha.contagens as Record<string, number>,
      dados: linha.dados as Record<string, any>,
    };
  });
