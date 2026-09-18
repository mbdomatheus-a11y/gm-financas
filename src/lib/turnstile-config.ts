/**
 * Interruptor do Cloudflare Turnstile no cadastro por convite.
 *
 * Histórico: desativado em 2026-09-18 porque o desafio do Turnstile estava
 * bloqueando o cadastro de convidados (o site estava com o backend preso
 * num Supabase errado/desconectado nessa época, ver
 * claude/status-migracao-supabase.md). Reativado em 2026-09-18, depois de
 * conectar o Supabase externo `wjapagkdgjlavonbmjdu` no Lovable.
 *
 * Antes de reativar de novo (se for desligado no futuro), confirme que
 * `TURNSTILE_SECRET_KEY` está configurada nos Secrets do Lovable — sem ela
 * `verificarTurnstileToken` sempre falha (ver src/lib/turnstile.functions.ts).
 */
export const TURNSTILE_ATIVO = true;
