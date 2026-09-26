import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { aplicarLimitePorIp } from "@/lib/rate-limit.server";

const emailAdmin = "privacidade@controlall.com.br";
const pedidoSchema = z.object({ email: z.string().trim().email(), telefone: z.string().trim().min(8).max(24), cpf: z.string().transform(onlyDigits).refine(isValidCpf, "Informe um CPF válido."), motivo: z.string().trim().max(2000).optional() });
const cpfHash = (cpf: string) => createHash("sha256").update(cpf).digest("hex");

// Item 15 do backlog (revisão de segurança, 2026-09-26): rota pública que
// aceita CPF/e-mail/telefone de qualquer pessoa sem prova de posse e, a
// cada chamada, grava uma solicitação e dispara e-mail pra equipe — sem
// limite, permitia spam e abrir solicitações de exclusão em nome de
// terceiros repetidamente. Agora limitada por IP.
export const enviarSolicitacaoPrivacidade = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => pedidoSchema.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await aplicarLimitePorIp(supabaseAdmin as any, "enviar-solicitacao-privacidade", 10, 60);
    // Nunca persistir o CPF em texto claro nesta solicitação pública.
    const { data: pedido, error } = await (supabaseAdmin as any).from("solicitacoes_privacidade").insert({
      email: data.email,
      telefone: data.telefone,
      cpf_hash: cpfHash(data.cpf),
      motivo: data.motivo || null,
      tipo: "exclusao",
    }).select("protocolo").single();
    if (error) {
      console.error("Falha ao registrar solicitação de privacidade", { code: error.code, message: error.message });
      throw new Error("Não foi possível registrar a solicitação. Tente novamente em alguns minutos.");
    }
    // O protocolo já foi persistido. Falha no e-mail provisório não pode fazer
    // o usuário acreditar que sua solicitação foi perdida.
    try {
      const { enviarEmail } = await import("@/lib/email.server");
      await enviarEmail({ to: emailAdmin, subject: "Control ALL: nova solicitação de privacidade", html: `<p>Há uma nova solicitação de exclusão. Protocolo: <strong>${pedido.protocolo}</strong>.</p>` });
    } catch (emailError) {
      console.error("Solicitação registrada, mas e-mail administrativo falhou", emailError);
    }
    return { protocolo: pedido.protocolo as string };
  });

// Nota (item 15 do backlog, revisão de 2026-09-26): `adminListarSolicitacoesPrivacidade`
// e `adminTratarSolicitacaoPrivacidade` foram removidas daqui — eram
// duplicatas não usadas por nenhuma tela (a UI de administração importa as
// versões equivalentes de `central-solicitacoes.functions.ts`). Manter as
// duas cópias era risco de manutenção: uma correção de segurança futura
// podia ser aplicada só numa delas.
