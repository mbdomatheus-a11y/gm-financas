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
    const googleAvailable = Boolean(
      process.env["GOOGLE_CLIENT_ID"] &&
      process.env["GOOGLE_CLIENT_SECRET"] &&
      process.env["GOOGLE_OAUTH_REDIRECT_URI"] &&
      process.env["APP_USER_CONNECTION_KEY_SECRET"],
    );
    if (!googleAvailable) return { connected: false, googleAvailable };
    try {
      const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
      const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
      return { connected: !!key, googleAvailable };
    } catch {
      return { connected: false, googleAvailable: false };
    }
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
  .handler(async ({ context }) => {
    const { data: perfil, error: perfilError } = await context.supabase
      .from("profiles")
      .select("grupo_id")
      .eq("id", context.userId)
      .single();
    if (perfilError || !perfil?.grupo_id) throw new Error("Grupo do usuário não encontrado.");
    const keys = [
      `${perfil.grupo_id}:comprovantes_pasta_url`,
      `${perfil.grupo_id}:drive_folder_id`,
    ];
    const { data, error } = await context.supabase
      .from("configuracoes_casal")
      .select("chave,valor")
      .eq("grupo_id", perfil.grupo_id)
      .in("chave", keys);
    if (error) throw error;
    const folderUrl = data?.find((item) => item.chave === keys[0])?.valor ?? null;
    const folderId = data?.find((item) => item.chave === keys[1])?.valor ?? null;
    return {
      folderId,
      folderUrl,
      provider: folderUrl ? identificarServico(folderUrl) : null,
    };
  });

export const setPastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { valor: string }) => input)
  .handler(async ({ data, context }) => {
    const valor = data.valor.trim();
    const { data: perfil, error: perfilError } = await context.supabase
      .from("profiles")
      .select("grupo_id")
      .eq("id", context.userId)
      .single();
    if (perfilError || !perfil?.grupo_id) throw new Error("Grupo do usuário não encontrado.");
    const urlKey = `${perfil.grupo_id}:comprovantes_pasta_url`;
    const folderKey = `${perfil.grupo_id}:drive_folder_id`;
    if (!valor) {
      const { error } = await context.supabase
        .from("configuracoes_casal")
        .delete()
        .eq("grupo_id", perfil.grupo_id)
        .in("chave", [urlKey, folderKey]);
      if (error) throw error;
      return { folderId: null, folderUrl: null, provider: null };
    }
    let pastaUrl: URL;
    try {
      pastaUrl = new URL(valor);
    } catch {
      throw new Error("Cole o link completo da pasta, começando com https://.");
    }
    if (pastaUrl.protocol !== "https:") {
      throw new Error("O endereço da pasta precisa usar HTTPS.");
    }

    const provider = identificarServico(pastaUrl.toString());
    const folderId = provider === "Google Drive" ? extrairFolderId(pastaUrl.toString()) : null;
    const { error } = await context.supabase.from("configuracoes_casal").upsert(
      {
        chave: urlKey,
        valor: pastaUrl.toString(),
        grupo_id: perfil.grupo_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chave" },
    );
    if (error) throw error;
    if (folderId) {
      const { error: folderError } = await context.supabase.from("configuracoes_casal").upsert(
        {
          chave: folderKey,
          valor: folderId,
          grupo_id: perfil.grupo_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "chave" },
      );
      if (folderError) throw folderError;
    } else {
      const { error: limparError } = await context.supabase
        .from("configuracoes_casal")
        .delete()
        .eq("grupo_id", perfil.grupo_id)
        .eq("chave", folderKey);
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
    if (!/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/.test(data.mimeType)) {
      throw new Error("Envie uma imagem ou um PDF.");
    }
    const nome = data.nome.replace(/[\\/\r\n]/g, "_").slice(0, 180);
    const { randomUUID } = await import("node:crypto");
    const salvarNoSite = async (aviso?: string) => {
      const path = `${data.notaId}/${randomUUID()}-${nome}`;
      const bucket = context.supabase.storage.from("comprovantes");
      const { error: uploadError } = await bucket.upload(path, fileBytes, {
        contentType: data.mimeType,
        upsert: false,
      });
      if (uploadError)
        throw new Error(`Não foi possível guardar o comprovante: ${uploadError.message}`);
      const { error: registroError } = await context.supabase.from("nota_arquivos").insert({
        nota_id: data.notaId,
        drive_file_id: `supabase:${path}`,
        link: null,
        thumbnail_link: null,
        mime_type: data.mimeType,
        nome,
        created_by: context.userId,
      });
      if (registroError) {
        await bucket.remove([path]);
        throw registroError;
      }
      return { ok: true as const, destino: "site" as const, fileId: path, aviso };
    };
    const googleConfigured = Boolean(
      process.env["GOOGLE_CLIENT_ID"] &&
      process.env["GOOGLE_CLIENT_SECRET"] &&
      process.env["GOOGLE_OAUTH_REDIRECT_URI"] &&
      process.env["APP_USER_CONNECTION_KEY_SECRET"],
    );
    if (!googleConfigured) return salvarNoSite();
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    let refreshToken: string | null;
    try {
      refreshToken = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    } catch {
      return salvarNoSite("O Google Drive não pôde ser consultado; o arquivo ficou salvo no site.");
    }
    if (!refreshToken) return salvarNoSite();
    const { googleDriveAccessToken, googleDriveFetch } =
      await import("@/server/googleDriveOAuth.server");
    let accessToken: string;
    try {
      accessToken = await googleDriveAccessToken(refreshToken);
    } catch {
      // O refresh token não funciona mais (revogado pelo usuário, senha do
      // Google trocada, ou — em app não verificado — expirou por inatividade).
      // Sem isso, TODO envio ia cair aqui pra sempre, em silêncio, com
      // driveStatus continuando a dizer "Conectado" indefinidamente. Remove a
      // conexão morta pra driveStatus passar a refletir a realidade e a
      // pessoa ser convidada a reconectar.
      try {
        const { deleteConnectionForUser } = await import("@/server/appUserConnections.server");
        await deleteConnectionForUser(context.userId, CONNECTOR_ID);
      } catch {
        /* mesmo se a limpeza falhar, segue com o fallback abaixo */
      }
      return salvarNoSite(
        "A conexão com o Google Drive expirou — reconecte em Notas Fiscais. Este arquivo ficou salvo no site.",
      );
    }
    // O escopo drive.file só garante acesso aos arquivos e pastas criados
    // pelo app OU escolhidos pela pessoa via um seletor do Google — não a
    // uma pasta qualquer colada por link. Por isso, se o grupo configurou
    // uma pasta em "Pasta dos comprovantes" (Configurações), tenta usar
    // essa pasta como destino; se o Drive recusar (pasta não criada pelo
    // app, sem esse acesso), cai pro fallback abaixo com aviso claro, em vez
    // de silenciosamente ignorar a escolha da pessoa e usar outra pasta.
    let destinoId: string;
    try {
      const { data: perfilGrupo } = await context.supabase
        .from("profiles")
        .select("grupo_id")
        .eq("id", context.userId)
        .maybeSingle();
      const grupoId = perfilGrupo?.grupo_id as string | undefined;
      const pastaEscolhidaId = grupoId
        ? ((
            await context.supabase
              .from("configuracoes_casal")
              .select("valor")
              .eq("grupo_id", grupoId)
              .eq("chave", `${grupoId}:drive_folder_id`)
              .maybeSingle()
          ).data?.valor as string | undefined)
        : undefined;
      if (pastaEscolhidaId) {
        destinoId = pastaEscolhidaId;
      } else {
        const rootId = await ensureFolder(accessToken, ROOT_FOLDER);
        destinoId = await ensureFolder(accessToken, SUB_FOLDER, rootId);
      }
    } catch {
      return salvarNoSite(
        "O Google Drive não pôde preparar a pasta; o arquivo ficou salvo no site.",
      );
    }

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
      return salvarNoSite(
        apiDesativada
          ? "A API do Google Drive está desativada; o arquivo ficou salvo no site."
          : `O Google Drive recusou o envio (${res.status}); o arquivo ficou salvo no site.`,
      );
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

    return { ok: true as const, destino: "google_drive" as const, fileId: file.id };
  });
