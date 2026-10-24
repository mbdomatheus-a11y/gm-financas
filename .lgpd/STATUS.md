# LGPD: estado da auditoria do Control ALL

Pipeline B (sistema em produção, retrofit), seguindo a skill `lgpd-audit` (goul4rt/lgpd-skills, MIT). Data: 24/10/2026.

Escopo: site gm-financas (www.controlall.com.br), app iOS controlall (Expo) e banco Supabase wjapagkdgjlavonbmjdu.

## Enquadramento
- Controlador: pessoa natural com fins econômicos (desenvolvedor responsável). Sem CNPJ.
- Agente de tratamento de pequeno porte (Res. CD/ANPD nº 2/2022): sim. Volume pequeno, sem larga escala.
- Alto risco (Res. 2/2022, art. 4º): critério específico presente (dados de saúde no módulo Exames, IA), mas o critério geral (larga escala ou afetar significativamente direitos) não. Conclusão: baixo risco hoje; reavaliar se passar de alguns milhares de usuários ou se o módulo Exames for liberado para todos.
- Encarregado: dispensado (Res. 2/2022, art. 11). Canal: privacidade@controlall.com.br (publicado na Política, item 11).
- Prazos com regime de pequeno porte: resposta ao titular pode ser em dobro (Res. 2/2022, art. 14), mas a Política promete 15 dias (LGPD art. 19, II). Incidente: 3 dias úteis (Res. 15/2024, art. 6º); em dobro para pequeno porte, salvo risco à integridade.

## Fases
- [x] L0 Setup `.lgpd/`
- [x] L1 Gap analysis: `gaps.md`
- [x] L2 Mapa de dados reverso: `ROPA.md`
- [x] L3 Base legal por atividade: tabela da Política (item 3) e `ROPA.md`
- [x] L4 Operadores: `vendors.md`
- [x] L5 Retenção: `retencao.md`
- [ ] L6 Anonimização das métricas (backlog)
- [x] L7 Canal do titular: formulário em /privacidade com protocolo, e-mail, exclusão de conta no site e no app
- [x] L8 Runbook de incidente: `incidentes/runbook.md` e `incidentes/log.md`
- [x] L9 Política de privacidade v2 (24/10/2026), Termos e Cookies: aguardando validação do Matheus
- [x] L10 ECA Digital: não aplicável (serviço para maiores de 18, cadastro bloqueia menor pela data de nascimento)
- [ ] L11 RIPD: não exigido hoje (baixo risco); fazer antes de liberar Exames para todos
- [x] L12 Encarregado: dispensado, canal publicado
