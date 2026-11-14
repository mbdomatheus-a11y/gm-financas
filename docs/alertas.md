# Alertas do sistema (14/11/2026)

Configuração central dos alertas (push, caixa de avisos e e-mail), editada pelo admin em
Administração > Site e módulos > Alertas (`/administracao?aba=alertas`). No app, Configurações >
Administração > "Alertas do sistema" abre a mesma página do site.

## Peças

| Peça | Onde |
| --- | --- |
| Tabela e gatilhos | `supabase/migrations/20261114110000_config_alertas.sql` |
| Catálogo (nome, descrição, padrões) | `src/lib/alertas-catalogo.ts` |
| Leitura da configuração, momento do resumo | `src/lib/config-alertas.server.ts` |
| Geração e despacho | `src/lib/avisos.server.ts` (`gerarAvisosDeData`, `despacharAvisos`, `despacharLotes`) |
| E-mails de retenção | `src/lib/retencao-emails.server.ts` (`rodarEmailsRetencao`) |
| Funções do painel | `src/lib/config-alertas.functions.ts` |
| Tela | `src/components/AlertasAdmin.tsx` |

## Tabela `public.config_alertas`

Uma linha por tipo: `ativo`, `frequencia` (na_hora, diaria, semanal, quinzenal, mensal), `dia_semana`
(0 domingo), `dia_mes`, `hora` (Brasília), `antecedencia_dias`, `canais` (push, app, email),
`titulo_modelo` (`{n}` = quantidade), `atualizado_por`, `atualizado_em` (carimbados por gatilho).
RLS: leitura para autenticados; gravação só `private.is_admin(auth.uid())`.

O seed repete o comportamento anterior: nada muda até o admin alterar. "Parcelas que terminam" vem
desligado (semanal, segunda 9h, 7 dias). Sem a tabela (migration pendente) o servidor usa os padrões
do catálogo.

## Como funciona

1. **Gravação** (`notificacoes_usuario`): o gatilho `trg_notificacoes_usuario_config` calcula `alerta`
   e aplica a configuração. Tipo desligado: não grava. Sem canal push: `push_status = ignorado`. Sem
   canal app: vai direto para arquivados. Frequência diferente de na_hora: `push_status = lote`.
   `gravarAvisos` também descarta tipos desligados.
2. **Cron de hora em hora** (`/api/cron/alertas`): `gerarAvisosDeData` usa a antecedência e a hora de
   cada tipo (parcela vence, fatura fecha e vence, garantia, parcelas que terminam); depois
   `despacharAvisos` (na hora) e `despacharLotes` (resumos).
3. **Resumo**: no dia e hora configurados, cada pessoa recebe um push só com o título do modelo (ex.:
   "3 parcelas terminam nesta semana"); com um aviso só, vai o próprio aviso. Quinzenal: `dia_mes` e
   15 dias depois (padrão 1 e 16). Mensal: `dia_mes` (último dia em meses curtos).
4. **Preferências da pessoa** continuam valendo: push desligado, tipo desligado em `lembretes`, modo
   de horário "desligado" (ignora) ou "janela" (guarda e entrega no início da janela).
5. **E-mails** (cron diário): liga/desliga, antecedência de "vence em breve" e dia do resumo semanal.

## Painel

Por linha: liga/desliga, frequência, dia/hora, antecedência (só tipos com data), canais, título do
resumo, "Enviar teste para mim" (push para os seus aparelhos ou e-mail nos tipos de e-mail, sem filtro
de preferência) e Salvar. Mostra quem alterou e quando; cada gravação vai para `admin_audit_logs`.

## Pendências

- Aplicar a migration 20261114110000 no Supabase.
- Novo tipo de alerta: incluir no catálogo, no seed e, se o tipo do aviso for diferente, no `case` do
  gatilho e em `alertaDoAviso`.
