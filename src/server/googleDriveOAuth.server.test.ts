import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  exchangeGoogleDriveCode,
  googleDriveAccessToken,
  googleDriveAuthorizationUrl,
  googleDriveFetch,
} from "./googleDriveOAuth.server";

const originalFetch = globalThis.fetch;
const envNames = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "APP_USER_CONNECTION_KEY_SECRET",
] as const;
const oldEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

beforeEach(() => {
  process.env["GOOGLE_CLIENT_ID"] = "example-client";
  process.env["GOOGLE_CLIENT_SECRET"] = "example-secret";
  process.env["GOOGLE_OAUTH_REDIRECT_URI"] =
    "https://financas.example.com/oauth/google-drive/return";
  process.env["APP_USER_CONNECTION_KEY_SECRET"] = Buffer.alloc(32, 7).toString("base64");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    const previous = oldEnv[name];
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
});

test("gera URL Google com escopo mínimo, PKCE e retorno do site", () => {
  const url = new URL(googleDriveAuthorizationUrl("usuario-1", "https://financas.example.com"));
  expect(url.origin).toBe("https://accounts.google.com");
  expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("access_type")).toBe("offline");
  expect(url.searchParams.get("redirect_uri")).toBe(
    "https://financas.example.com/oauth/google-drive/return",
  );
  expect(url.toString()).not.toContain("example-secret");
});

test("rejeita retorno para usuário diferente antes de trocar o código", async () => {
  const state = new URL(
    googleDriveAuthorizationUrl("usuario-1", "https://financas.example.com"),
  ).searchParams.get("state")!;
  globalThis.fetch = (() => {
    throw new Error("Não deveria chamar o Google");
  }) as typeof fetch;
  await expect(exchangeGoogleDriveCode("usuario-2", "codigo", state)).rejects.toThrow(
    "não pertence a esta conta",
  );
});

test("troca o código sem enviar o segredo nem o refresh token ao navegador", async () => {
  const state = new URL(
    googleDriveAuthorizationUrl("usuario-1", "https://financas.example.com"),
  ).searchParams.get("state")!;
  globalThis.fetch = (async (_url, init) => {
    const body = new URLSearchParams(init?.body as string);
    expect(body.get("code_verifier")).toBeTruthy();
    expect(body.get("grant_type")).toBe("authorization_code");
    return Response.json({
      refresh_token: "refresh-test",
      scope: "https://www.googleapis.com/auth/drive.file",
    });
  }) as typeof fetch;
  expect(await exchangeGoogleDriveCode("usuario-1", "codigo", state)).toBe("refresh-test");
});

test("renova o token e usa a API oficial do Drive", async () => {
  const called: string[] = [];
  globalThis.fetch = (async (input, init) => {
    called.push(String(input));
    if (String(input).endsWith("/token")) {
      expect(new URLSearchParams(init?.body as string).get("grant_type")).toBe("refresh_token");
      return Response.json({ access_token: "access-test" });
    }
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer access-test");
    return Response.json({ files: [] });
  }) as typeof fetch;
  const accessToken = await googleDriveAccessToken("refresh-test");
  await googleDriveFetch(accessToken, "/drive/v3/files");
  expect(called).toEqual([
    "https://oauth2.googleapis.com/token",
    "https://www.googleapis.com/drive/v3/files",
  ]);
});
