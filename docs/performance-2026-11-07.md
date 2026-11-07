# Auditoria de performance, 2026-11-07

Escopo: checklist de 25 itens. Corrigido só o que era seguro. `tsc --noEmit` passou sem erros.

| # | Item | Status | Evidência | Impacto | Esforço |
|---|------|--------|-----------|---------|---------|
| 01 | Skeleton | OK | `src/components/CartaoCarregando.tsx`, usado como fallback dos gráficos lazy | Médio | Baixo |
| 02 | Imagens WebP/AVIF no tamanho exibido | FALTA | `public/brand/logo-control-all.png`, `og-cover.png`, `icons/icon-512.png` (>150 KB), `control-all-network.jfif` | Médio | Baixo |
| 03 | Chamadas duplicadas | OK | `configuracao-acesso-publica` em 12 componentes, mesma queryKey e mesma função (React Query junta). Sem `staleTime` global em `src/router.tsx:6` | Médio | Baixo |
| 04 | Debounce | CORRIGIDO | `src/hooks/useValorAdiado.ts`; usado em `despesas.tsx`, `receitas.tsx`, `notas.tsx` (250 ms). Buscas de seletores pequenos ficam sem debounce (listas curtas) | Médio | Baixo |
| 05 | Paginação | FALTA | `src/hooks/useFinance.ts:10-35` (`buscarTudo` baixa receitas, despesas e parcelas inteiras) | Alto | Alto |
| 08 | N+1 | CORRIGIDO / FALTA | Corrigido: `configuracoes-site.functions.ts:~342` (upsert em lote). Falta: `retencao-emails.server.ts:105` (1 consulta por grupo, cron), `pluggy-categoria.server.ts:117` (1 chamada por pendente), `importar.tsx:1439` (upsert por correção) | Médio | Médio |
| 11 | Dependências não usadas | CONFERIR | Sem import em `src/`: `@hookform/resolvers`, `date-fns` (peer do react-day-picker), `@zxing/library` (peer do browser), `drizzle-orm`, `eslint-config-prettier`, `@capacitor/*` (nativo). Só `@hookform/resolvers` parece removível | Baixo | Baixo |
| 12 | Timeout em APIs externas | CORRIGIDO | `AbortSignal.timeout` em: `pluggy-api.server.ts`, `pluggy.functions.ts`, `api/pluggy/conectar.ts`, `bancos-logos.functions.ts`, `depara-web.functions.ts` (OpenAI), `email.server.ts` (Resend), `indices.functions.ts` (BCB), `push.server.ts`, `turnstile.functions.ts`, `googleDriveOAuth.server.ts` (token e revoke). Já existiam em `lancamento-ia.functions.ts`, `pix.functions.ts`, `nfe.functions.ts`. Sem timeout de propósito: `googleDriveFetch` (upload grande) | Alto | Baixo |
| 13 | Streaming da IA | FALTA | `lancamento-ia.functions.ts:177,399` esperam a resposta inteira (respostas curtas em JSON, ganho pequeno) | Baixo | Alto |
| 14 | UI otimista | FALTA | Nenhum `onMutate` com `setQueryData` nas ações simples (marcar paga, lista de compras) | Médio | Médio |
| 15 | Lazy nas imagens | CORRIGIDO | `administracao.tsx:~1806`. Demais `<img>` já tinham `loading="lazy"`. Avatares do cabeçalho ficam eager de propósito | Baixo | Baixo |
| 16 | Promise.all | CORRIGIDO | `admin.functions.ts:~96`, `grupos.functions.ts:~93`, `oracle-storage.server.ts:~135` | Médio | Baixo |
| 17 | Índices | CORRIGIDO (arquivo; falta aplicar) | `supabase/migrations/20261107210000_indices_performance.sql` | Alto | Baixo |
| 20 | SSR nas páginas públicas | OK | Só `_authenticated/route.tsx:26` e `oauth/google-drive/return.tsx:5` usam `ssr: false` | Médio | n/a |
| 21 | Scripts de terceiros após o load | OK | Turnstile injetado sob demanda (`TurnstileWidget.tsx:37`); `@vercel/analytics` em `useEffect` (`__root.tsx:143`) | Baixo | n/a |
| 22 | Code splitting | CORRIGIDO | `React.lazy` + `Suspense` para `GraficoHome`, `VisaoGeralHome` (`HomeWidgets.tsx`) e `ResumoPrevisaoHome`, `VisaoGeralHome` (`inicio.tsx`). `pdfjs` e `tesseract` já são `import()` dinâmico; `driver.js` (`TourGuiado`) segue estático em `_authenticated/route.tsx` | Médio | Baixo |
| 24 | `select('*')` em listagens | FALTA | 44 ocorrências. Principais: `useFinance.ts:12,62,75,120,149,161`, `useContas.ts:151,223`, `importar.tsx` (9). Não alterado: despesas, parcelas e receitas têm dezenas de consumidores, parte com `as any`, e o `tsc` não pega coluna faltando | Médio | Médio |
| 26 | Re-render | CONFERIR NO PAINEL | Usar React DevTools Profiler em despesas e dashboard. `lista` em `despesas.tsx` é recalculada a cada render, sem `useMemo` | Médio | Médio |
| 27 | Cache-control de estáticos | CONFERIR NO PAINEL | `/assets/*` com hash recebe cache longo da Vercel. `public/brand` e `public/icons` não têm header; `vercel.json` não foi alterado | Baixo | Baixo |
| 29 | Fontes | CORRIGIDO | `__root.tsx:~109`: removida a família Poppins (nenhuma tela a usa; seletor oferece só Plus Jakarta Sans, Inter, Nunito e Roboto). Self-host das demais segue como próximo passo | Médio | Baixo |
| 30 | Speed Insights | FALTA | `@vercel/speed-insights` não está no `package.json` (só `@vercel/analytics`). Não instalado por regra | Baixo | Baixo |

## O que foi alterado
- Novos: `src/hooks/useValorAdiado.ts`, `src/lib/opcao-grafico.ts` (opções do gráfico fora do componente, para o recharts não entrar no bundle inicial), a migração de índices e este documento.
- Editados: `inicio.tsx`, `HomeWidgets.tsx`, `GraficoHome.tsx`, `despesas.tsx`, `receitas.tsx`, `notas.tsx`, `administracao.tsx`, `__root.tsx`, `admin.functions.ts`, `grupos.functions.ts`, `oracle-storage.server.ts`, `configuracoes-site.functions.ts` e os arquivos de fetch listados no item 12.
- Nada de commit, push, SQL ou instalação de pacote. A migração ainda NÃO foi aplicada no banco.

## O que você confere
1. Lighthouse mobile (aba anônima, Slow 4G) em `/inicio`, antes e depois do deploy: LCP, TBT e tamanho de JS. Esperado: menos JS inicial na Início e uma família de fonte a menos.
2. Network em `/inicio`: o chunk do recharts deve aparecer depois do primeiro render, com o skeleton no lugar por um instante.
3. Digitar na busca de despesas: a lista atualiza ~250 ms depois da última tecla.
4. Aplicar a migração (SQL Editor) e rodar os `explain (analyze, buffers)` comentados no fim do arquivo (só SELECT). Esperado: Index Scan nos filtros por `grupo_id`, `despesa_id` e `cartao_id`.
5. Trocar a fonte em Personalização (Plus Jakarta Sans, Inter, Nunito, Roboto) e ver se aparece normal.
6. Fluxos com timeout (IA, Pluggy, e-mail): testar um de cada. Se algum estourar, o limite está nos arquivos do item 12.

## Próximos passos (por impacto)
1. `staleTime` global (30 a 60 s) no `QueryClient` em `src/router.tsx` e paginação ou janela de datas em `buscarTudo`. Hoje cada montagem de `useDespesas`, `useParcelas` e `useReceitas` rebaixa tudo.
2. Colunas explícitas nas queries de despesas, parcelas e receitas (item 24), uma tela por vez.
3. Converter `logo-control-all.png`, `og-cover.png` e `icon-512.png` para WebP/AVIF (manter PNG só onde o iOS e o og:image exigem).
4. Self-host das fontes (`@fontsource`) ou `font-display: swap` com preload da fonte padrão; hoje são 4 famílias via Google Fonts, carregadas mesmo que o usuário use só uma.
5. Headers `Cache-Control` imutáveis para `/brand/*` e `/icons/*` no `vercel.json`.
6. UI otimista em marcar parcela paga e itens da lista de compras.
7. Instalar `@vercel/speed-insights` e montar `<SpeedInsights />` no root.
8. N+1 restantes: `retencao-emails.server.ts` (agrupar parcelas com `.in("grupo_id", ...)`) e `pluggy-categoria.server.ts`.
9. `useMemo` em `lista` de `despesas.tsx` e lazy do `TourGuiado`.


## Ajuste final (07/11/2026)
- 19: vercel.json com "regions": ["gru1"] (funções em São Paulo, mesma região do Supabase sa-east-1).
- 03/05: QueryClient com staleTime de 30 s em src/router.tsx. Trocar de tela não rebaixa despesas, parcelas e receitas; gravações seguem atualizando por invalidateQueries.
