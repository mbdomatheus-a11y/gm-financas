import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONNECTOR_ID = "google_drive_direct";
const ROOT_FOLDER = "Finanças do Casal";
const SUB_FOLDER = "Notas fiscais";

export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const request = getRequest();
    if (!request) throw new Error("Não foi possível iniciar a conexão com o Google.");
    const { googleDriveAuthorizationUrl } = await import("@/server/googleDriveOAuth.server");
    return {
      authorizationUrl: googleDriveAuthorizationUrl(context.userId, new URL(request.url).origin),
    };
  });

export const completeDriveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; state: string }) => input)
  .handler(async ({ data, context }) => {
    const { exchangeGoogleDriveCode } = await import("@/server/googleDriveOAuth.server");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const refreshToken = await exchangeGoogleDriveCode(context.userId, data.code, data.state);
    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, refreshToken);
    return { ok: true };
  });

export const driveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { connected: !!key };
  });

export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } =
      await import("@/server/appUserConnections.server");
    const { revokeGoogleDrive } = await import("@/server/googleDriveOAuth.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      try {
        await revokeGoogleDrive(key);
      } catch {
        // segue removendo localmente
      }
    }
    await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

async function ensureFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const q = [
    `name='${safeName}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(" and ");
  const { googleDriveFetch } = await import("@/server/googleDriveOAuth.server");
  const res = await googleDriveFetch(
    accessToken,
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
  );
  if (!res.ok) throw new Error(`Falha ao consultar pastas do Google Drive (${res.status}).`);
  const list = (await res.json()) as { files?: Array<{ id: string }> };
  const found = list.files?.[0]?.id;
  if (found) return found;
  const created = await googleDriveFetch(accessToken, "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!created.ok) {
    throw new Error(`Falha ao criar pasta no Google Drive (${created.status})`);
  }
  const body = (await created.json()) as { id: string };
  return body.id;
}

/** Aceita o ID puro ou o link completo da pasta compartilhada do Google Drive. */
function extrairFolderId(entrada: string): string {
  const texto = entrada.trim();
  const m =
    texto.match(/folders\/([A-Za-z0-9_-]{10,})/) ?? texto.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return (m?.[1] ?? texto).trim();
}

function identificarServico(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("drive.google.com")) return "Google Drive";
  if (
    host.includes("onedrive.live.com") ||
    host.includes("1drv.ms") ||
    host.includes("sharepoint.com")
  ) {
    return "OneDrive";
  }
  if (host.includes("mega.nz") || host.includes("mega.io")) return "MEGA";
  if (host.includes("icloud.com")) return "iCloud Drive";
  if (host.includes("dropbox.com")) return "Dropbox";
  return "Outro serviço";
}

export const getPastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("configuracoes_casal")
      .select("chave,valor")
      .in("chave", ["comprovantes_pasta_url", "drive_folder_id"]);
    const folderUrl = data?.find((item) => item.chave === "comprovantes_pasta_url")?.valor ?? null;
    const folderId = data?.find((item) => item.chave === "drive_folder_id")?.valor ?? null;
    return {
      folderId,
      folderUrl,
      provider: folderUrl ? identificarServico(folderUrl) : null,
    };
  });

export const setPastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { valor: string }) => input)
  .handler(async ({ data }) => {
    const valor = data.valor.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!valor) {
      const { error } = await supabaseAdmin
        .from("configuracoes_casal")
        .delete()
        .in("chave", ["comprovantes_pasta_url", "drive_folder_id"]);
      if (error) throw error;
      return { folderId: null, folderUrl: null, provider: null };
    }
    let pastaUrl: URL;
    try {
      pastaUrl = new URL(valor);
    } catch {
      throw new Error("Cole o link completo da pasta, começando com http:// ou https://.");
    }
    if (pastaUrl.protocol !== "https:" && pastaUrl.protocol !== "http:") {
      throw new Error("O endereço da pasta precisa ser um link válido.");
    }

    const provider = identificarServico(pastaUrl.toString());
    const folderId = provider === "Google Drive" ? extrairFolderId(pastaUrl.toString()) : null;
    const { error } = await supabaseAdmin.from("configuracoes_casal").upsert(
      {
        chave: "comprovantes_pasta_url",
        valor: pastaUrl.toString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chave" },
    );
    if (error) throw error;
    if (folderId) {
      const { error: folderError } = await supabaseAdmin
        .from("configuracoes_casal")
        .upsert(
          { chave: "drive_folder_id", valor: folderId, updated_at: new Date().toISOString() },
          { onConflict: "chave" },
        );
      if (folderError) throw folderError;
    } else {
      const { error: limparError } = await supabaseAdmin
        .from("configuracoes_casal")
        .delete()
        .eq("chave", "drive_folder_id");
      if (limparError) throw limparError;
    }
    return { folderId, folderUrl: pastaUrl.toString(), provider };
  });

export const uploadNotaArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      notaId: string;
      nome: string;
      mimeType: string;
      base64: string;
      competencia: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const refreshToken = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!refreshToken) throw new Error("Conecte sua conta Google para enviar arquivos.");
    const { data: nota, error: notaError } = await context.supabase
      .from("notas_fiscais")
      .select("id")
      .eq("id", data.notaId)
      .maybeSingle();
    if (notaError || !nota) throw new Error("Esta nota não pertence ao seu grupo.");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64) || data.base64.length > 14_000_000) {
      throw new Error("Arquivo inválido ou maior que o limite de 10 MB.");
    }
    const fileBytes = Buffer.from(data.base64, "base64");
    if (!fileBytes.length || fileBytes.length > 10 * 1024 * 1024) {
      throw new Error("Arquivo inválido ou maior que o limite de 10 MB.");
    }
    if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(data.mimeType)) {
      throw new Error("Envie uma imagem JPG, PNG, WebP ou um PDF.");
    }
    const nome = data.nome.replace(/[\\/\r\n]/g, "_").slice(0, 180);
    const { googleDriveAccessToken, googleDriveFetch } =
      await import("@/server/googleDriveOAuth.server");
    const accessToken = await googleDriveAccessToken(refreshToken);
    // O escopo drive.file só garante acesso aos arquivos e pastas criados pelo app.
    const rootId = await ensureFolder(accessToken, ROOT_FOLDER);
    const destinoId = await ensureFolder(accessToken, SUB_FOLDER, rootId);

    const { randomUUID } = await import("node:crypto");
    const boundary = `controlall${randomUUID().replace(/-/g, "")}`;
    const metadata = JSON.stringify({ name: nome, parents: [destinoId] });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\n\r\n`,
      ),
      fileBytes,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await googleDriveFetch(
      accessToken,
      "/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink,mimeType",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      const apiDesativada =
        res.status === 403 &&
        /Google Drive API has not been used|accessNotConfigured|SERVICE_DISABLED/i.test(text);
      console.error(`Google Drive upload failed [${res.status}]`);
      return {
        ok: false as const,
        code: apiDesativada ? "drive_api_disabled" : "drive_upload_failed",
        message: apiDesativada
          ? "A API do Google Drive está desativada no projeto Google desta conexão. Ative a Google Drive API no Google Cloud e tente novamente."
          : `O Google Drive recusou o envio (${res.status}). Tente novamente.`,
      };
    }
    const file = (await res.json()) as {
      id: string;
      name?: string;
      webViewLink?: string;
      thumbnailLink?: string;
      mimeType?: string;
    };

    const { error } = await context.supabase.from("nota_arquivos").insert({
      nota_id: data.notaId,
      drive_file_id: file.id,
      link: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      thumbnail_link: file.thumbnailLink ?? null,
      mime_type: file.mimeType ?? data.mimeType,
      nome: file.name ?? nome,
      created_by: context.userId,
    });
    if (error) throw error;

    return { ok: true as const, fileId: file.id };
  });
