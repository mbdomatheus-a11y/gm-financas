/**
 * Interruptor temporário do Cloudflare Turnstile no cadastro por convite.
 *
 * Desativado em 2026-09-18: o desafio do Turnstile estava bloqueando o
 * cadastro de convidados ("Não foi possível conectar ao site" / erro do
 * Cloudflare na tela de criar conta).
 *
 * REATIVAR em ~2026-09-23: voltar `TURNSTILE_ATIVO` para `true`, validar
 * (`tsc --noEmit`, `bun test`, `bun run build`) e entregar de novo.
 */
export const TURNSTILE_ATIVO = false;
