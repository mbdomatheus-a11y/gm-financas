// Envio de e-mail transacional via Resend (https://resend.com), usando a API
// HTTP direta — sem SDK, pra não adicionar dependência nova. Use isso só a
// partir de server functions/rotas server (nunca em código que vai pro
// bundle do cliente).
//
// Variáveis de ambiente:
// - RESEND_API_KEY (obrigatória): chave da conta Resend.
// - RESEND_FROM_EMAIL (opcional): remetente, ex. "Control ALL <avisos@seudominio.com>".
//   Sem essa variável, cai no domínio de teste do Resend (onboarding@resend.dev) —
//   que só permite enviar e-mails para o próprio endereço cadastrado na conta do Resend.
//   Configure RESEND_FROM_EMAIL com um domínio verificado em Resend -> Domains para enviar
//   a qualquer destinatário.

const RESEND_API_URL = "https://api.resend.com/emails";
const REMETENTE_TESTE = "Control ALL <onboarding@resend.dev>";

export async function enviarEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY não configurada — e-mail não enviado.");
    return { ok: false, erro: "Envio de e-mail não está configurado no momento." };
  }

  const from = process.env["RESEND_FROM_EMAIL"] || REMETENTE_TESTE;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [params.to], subject: params.subject, html: params.html }),
    });

    if (!res.ok) {
      const texto = await res.text();
      console.error(`[email] Resend recusou o envio (${res.status}): ${texto}`);
      if (res.status === 403) {
        return {
          ok: false,
          erro: "Envio recusado pelo provedor (403). Verifique se o domínio do remetente está verificado no Resend.",
        };
      }
      return { ok: false, erro: `Não foi possível enviar o e-mail (erro ${res.status}).` };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("[email] Erro de rede ou exceção ao chamar Resend:", err);
    return { ok: false, erro: "Falha de conexão com a API de e-mail." };
  }
}
