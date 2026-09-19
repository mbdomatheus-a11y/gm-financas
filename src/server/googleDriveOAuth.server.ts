// OAuth do Google Drive executado apenas no servidor. Nunca enviar tokens ao navegador.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function settings() {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const redirectUri = process.env["GOOGLE_OAUTH_REDIRECT_URI"];
  const rawKey = process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!clientId || !clientSecret || !redirectUri || !rawKey) {
    throw new Error(
      "A conexão com o Google Drive ainda não foi configurada pela administração do site.",
    );
  }
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) throw new Error("A chave de proteção do Google Drive é inválida.");
  const url = new URL(redirectUri);
  if (
    url.pathname !== "/oauth/google-drive/return" ||
    (url.protocol !== "https:" && url.hostname !== "localhost")
  ) {
    throw new Error("O endereço de retorno do Google Drive está incorreto.");
  }
  return { clientId, clientSecret, redirectUri, key };
}

type OAuthState = { userId: string; expires: number; verifier: string };

function sealState(value: OAuthState, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

function openState(value: string, key: Buffer): OAuthState {
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29 || value.length > 2048) throw new Error("state inválido");
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"),
    ) as OAuthState;
  } catch {
    throw new Error("A autorização do Google expirou ou não pertence a esta sessão.");
  }
}

export function googleDriveAuthorizationUrl(userId: string, requestOrigin: string): string {
  const { clientId, redirectUri, key } = settings();
  if (new URL(redirectUri).origin !== requestOrigin) {
    throw new Error("Abra o site pelo endereço oficial para conectar o Google Drive.");
  }
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: sealState({ userId, expires: Date.now() + 10 * 60_000, verifier }, key),
  }).toString();
  return url.toString();
}

export async function exchangeGoogleDriveCode(
  userId: string,
  code: string,
  state: string,
): Promise<string> {
  const { clientId, clientSecret, redirectUri, key } = settings();
  const pending = openState(state, key);
  if (pending.userId !== userId || pending.expires < Date.now() || !pending.verifier || !code) {
    throw new Error("A autorização do Google expirou ou não pertence a esta conta.");
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: pending.verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokens = (await response.json()) as { refresh_token?: string; scope?: string };
  if (!response.ok || !tokens.refresh_token) {
    throw new Error("O Google não concedeu acesso permanente ao Drive. Tente conectar novamente.");
  }
  if (tokens.scope && !tokens.scope.split(" ").includes(SCOPE)) {
    throw new Error("A permissão para salvar arquivos no Google Drive não foi concedida.");
  }
  return tokens.refresh_token;
}

export async function googleDriveAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = settings();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokens = (await response.json()) as { access_token?: string };
  if (!response.ok || !tokens.access_token) {
    throw new Error("A conexão com o Google Drive expirou. Desconecte e conecte novamente.");
  }
  return tokens.access_token;
}

export async function revokeGoogleDrive(refreshToken: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  });
}

export async function googleDriveFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`https://www.googleapis.com${path}`, { ...init, headers });
}
