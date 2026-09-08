import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_drive";
const ROOT_FOLDER = "Finanças do Casal";
const SUB_FOLDER = "Notas fiscais";

export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientApiKey = process.env["GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientApiKey) {
      throw new Error("GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY is not set");
    }
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google-drive/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const existing = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientApiKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: {
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      },
    });
    return { authorizationUrl };
  });

export const completeDriveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) throw new Error("OAuth completion returned the wrong connector");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
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
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CONNECTOR_ID,
        });
      } catch {
        // segue removendo localmente
      }
    }
    await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

async function driveFetch(connectionAPIKey: string, path: string, init?: RequestInit) {
  const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path,
    init,
  });
}

async function ensureFolder(
  connectionAPIKey: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const q = [
    `name='${safeName}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(" and ");
  const res = await driveFetch(
    connectionAPIKey,
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
  );
  if (res.ok) {
    const body = (await res.json()) as { files?: Array<{ id: string }> };
    const found = body.files?.[0]?.id;
    if (found) return found;
  }
  const created = await driveFetch(connectionAPIKey, "/drive/v3/files?fields=id", {
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
  const m = texto.match(/folders\/([A-Za-z0-9_-]{10,})/) ?? texto.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return (m?.[1] ?? texto).trim();
}

export const getPastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("configuracoes_casal")
      .select("valor")
      .eq("chave", "drive_folder_id")
      .maybeSingle();
    return { folderId: data?.valor ?? null };
  });

export const setPastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { valor: string }) => input)
  .handler(async ({ data }) => {
    const folderId = extrairFolderId(data.valor);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!folderId) {
      const { error } = await supabaseAdmin
        .from("configuracoes_casal")
        .delete()
        .eq("chave", "drive_folder_id");
      if (error) throw error;
      return { folderId: null };
    }
    const { error } = await supabaseAdmin
      .from("configuracoes_casal")
      .upsert(
        { chave: "drive_folder_id", valor: folderId, updated_at: new Date().toISOString() },
        { onConflict: "chave" },
      );
    if (error) throw error;
    return { folderId };
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
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) throw new Error("Google Drive não está conectado para este usuário");

    // Pasta compartilhada única do casal, quando configurada; senão, cria a estrutura padrão.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("configuracoes_casal")
      .select("valor")
      .eq("chave", "drive_folder_id")
      .maybeSingle();
    let destinoId = cfg?.valor ?? null;
    if (!destinoId) {
      const rootId = await ensureFolder(key, ROOT_FOLDER);
      destinoId = await ensureFolder(key, SUB_FOLDER, rootId);
    }

    const boundary = `lovable${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify({ name: data.nome, parents: [destinoId] });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`,
      ),
      Buffer.from(data.base64),
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await driveFetch(
      key,
      "/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink,mimeType",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha no upload para o Drive (${res.status}): ${text.slice(0, 200)}`);
    }
    const file = (await res.json()) as {
      id: string;
      name?: string;
      webViewLink?: string;
      thumbnailLink?: string;
      mimeType?: string;
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("nota_arquivos").insert({
      nota_id: data.notaId,
      drive_file_id: file.id,
      link: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      thumbnail_link: file.thumbnailLink ?? null,
      mime_type: file.mimeType ?? data.mimeType,
      nome: file.name ?? data.nome,
      created_by: context.userId,
    });
    if (error) throw error;

    return { ok: true, fileId: file.id };
  });
