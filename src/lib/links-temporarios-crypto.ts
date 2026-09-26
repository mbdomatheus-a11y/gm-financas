/**
 * Criptografia 100% no navegador para o link temporário com senha (item 6
 * do backlog). O servidor nunca recebe a senha nem o texto em claro nesse
 * caso — só o resultado desta função (cifrado + salt + iv em base64).
 *
 * PBKDF2 (200.000 iterações, SHA-256) deriva uma chave AES-256-GCM a partir
 * da senha; o salt e o IV são gerados aleatoriamente a cada criação e vão
 * junto (sem eles não é possível decifrar, mas eles sozinhos não revelam a
 * senha nem o conteúdo).
 */

const PBKDF2_ITERACOES = 200_000;

function paraBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

async function derivarChave(senha: string, salt: BufferSource): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERACOES, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function criptografar(
  texto: string,
  senha: string,
): Promise<{ conteudo: string; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await derivarChave(senha, salt);
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    chave,
    new TextEncoder().encode(texto),
  );
  return {
    conteudo: paraBase64(new Uint8Array(cifrado)),
    salt: paraBase64(salt),
    iv: paraBase64(iv),
  };
}

/** Lança erro se a senha estiver errada ou o conteúdo estiver corrompido (tag do GCM não confere). */
export async function descriptografar(
  conteudo: string,
  senha: string,
  salt: string,
  iv: string,
): Promise<string> {
  const chave = await derivarChave(senha, deBase64(salt) as BufferSource);
  const decifrado = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deBase64(iv) as BufferSource },
    chave,
    deBase64(conteudo) as BufferSource,
  );
  return new TextDecoder().decode(decifrado);
}
