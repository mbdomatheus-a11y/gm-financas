/**
 * Integração com Oracle Cloud Object Storage (API compatível com S3),
 * usada como destino preferencial de comprovantes de Notas Fiscais para
 * grupos que o admin do site habilitar (2026-09-26).
 *
 * Como funciona: cada grupo habilitado tem uma cota fixa (padrão 1 GB,
 * ver `grupos.oracle_storage_cota_bytes`), controlada pela soma dos
 * registros em `oracle_storage_arquivos`. Antes de cada upload, checamos
 * se o grupo está habilitado e se ainda cabe o arquivo na cota; se não
 * couber ou o Oracle falhar, quem chamou (`uploadNotaArquivo` em
 * drive.functions.ts) segue para o próximo destino da cadeia (Google
 * Drive do usuário, depois Supabase Storage do site).
 *
 * Variáveis de ambiente necessárias (ver README/plano no projeto para o
 * passo a passo de como gerá-las no console do Oracle):
 * - ORACLE_S3_ENDPOINT        (ex.: https://<namespace>.compat.objectstorage.sa-saopaulo-1.oraclecloud.com)
 * - ORACLE_S3_REGION          (ex.: sa-saopaulo-1)
 * - ORACLE_S3_ACCESS_KEY_ID
 * - ORACLE_S3_SECRET_ACCESS_KEY
 * - ORACLE_S3_BUCKET          (ex.: controlall-comprovantes)
 */

export function oracleStorageConfigurado(): boolean {
  return Boolean(
    process.env["ORACLE_S3_ENDPOINT"] &&
    process.env["ORACLE_S3_REGION"] &&
    process.env["ORACLE_S3_ACCESS_KEY_ID"] &&
    process.env["ORACLE_S3_SECRET_ACCESS_KEY"] &&
    process.env["ORACLE_S3_BUCKET"],
  );
}

async function getClient() {
  // Import dinâmico: só carrega o SDK da AWS quando o Oracle está de fato
  // configurado e em uso, evitando peso extra no bundle quando não usado.
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: process.env["ORACLE_S3_REGION"]!,
    endpoint: process.env["ORACLE_S3_ENDPOINT"]!,
    credentials: {
      accessKeyId: process.env["ORACLE_S3_ACCESS_KEY_ID"]!,
      secretAccessKey: process.env["ORACLE_S3_SECRET_ACCESS_KEY"]!,
    },
    // O Object Storage do Oracle (como a maioria dos S3-compatible que não
    // são a AWS) precisa de path-style ("endpoint/bucket/key"), não do
    // virtual-hosted-style padrão da AWS ("bucket.endpoint/key").
    forcePathStyle: true,
  });
}

/**
 * Envia o arquivo pro Oracle e registra o uso em oracle_storage_arquivos.
 * Lança erro se o grupo não tiver cota livre suficiente, ou se o envio
 * falhar — quem chama decide o que fazer (cair para o próximo destino).
 */
export async function uploadParaOracle(params: {
  supabase: any; // client com service role (mesmo usado em uploadNotaArquivo)
  grupoId: string;
  notaId: string;
  nome: string;
  mimeType: string;
  bytes: Buffer;
  userId: string;
}): Promise<{ objectKey: string; bytes: number }> {
  const { supabase, grupoId, notaId, nome, mimeType, bytes, userId } = params;

  const { data: grupo, error: grupoError } = await supabase
    .from("grupos")
    .select("oracle_storage_habilitado, oracle_storage_cota_bytes")
    .eq("id", grupoId)
    .maybeSingle();
  if (grupoError) throw new Error(grupoError.message);
  if (!grupo?.oracle_storage_habilitado) {
    throw new Error("Armazenamento Oracle não habilitado para este grupo.");
  }

  const { data: usoAtual, error: usoError } = await supabase
    .from("oracle_storage_arquivos")
    .select("bytes")
    .eq("grupo_id", grupoId);
  if (usoError) throw new Error(usoError.message);
  const usadoBytes = (usoAtual ?? []).reduce((s: number, r: any) => s + Number(r.bytes ?? 0), 0);
  const cota = Number(grupo.oracle_storage_cota_bytes ?? 1_073_741_824);
  if (usadoBytes + bytes.length > cota) {
    throw new Error("Cota de armazenamento Oracle deste grupo esgotada.");
  }

  const { randomUUID } = await import("node:crypto");
  const objectKey = `${grupoId}/${randomUUID()}-${nome}`;

  const client = await getClient();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await client.send(
    new PutObjectCommand({
      Bucket: process.env["ORACLE_S3_BUCKET"]!,
      Key: objectKey,
      Body: bytes,
      ContentType: mimeType,
    }),
  );

  const { error: registroError } = await supabase.from("oracle_storage_arquivos").insert({
    grupo_id: grupoId,
    object_key: objectKey,
    bytes: bytes.length,
    mime_type: mimeType,
    criado_por: userId,
  });
  if (registroError) {
    // Melhor um registro órfão no bucket do que perder o controle de cota —
    // mas ainda assim reportamos, pra investigar depois se acontecer muito.
    console.error("Falha ao registrar uso do Oracle Storage:", registroError.message);
  }

  return { objectKey, bytes: bytes.length };
}

/** Gera uma URL assinada e temporária (1h) para abrir/baixar o arquivo. */
export async function urlAssinadaOracle(objectKey: string): Promise<string> {
  const client = await getClient();
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const command = new GetObjectCommand({
    Bucket: process.env["ORACLE_S3_BUCKET"]!,
    Key: objectKey,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/** Soma o uso atual do grupo, para exibir na tela de administração. */
export async function usoOracleDoGrupo(
  supabase: any,
  grupoId: string,
): Promise<{ usadoBytes: number; cotaBytes: number }> {
  const { data: grupo } = await supabase
    .from("grupos")
    .select("oracle_storage_cota_bytes")
    .eq("id", grupoId)
    .maybeSingle();
  const { data: arquivos } = await supabase
    .from("oracle_storage_arquivos")
    .select("bytes")
    .eq("grupo_id", grupoId);
  const usadoBytes = (arquivos ?? []).reduce((s: number, r: any) => s + Number(r.bytes ?? 0), 0);
  return {
    usadoBytes,
    cotaBytes: Number(grupo?.oracle_storage_cota_bytes ?? 1_073_741_824),
  };
}
