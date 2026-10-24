# Gap analysis e plano de remediação (24/10/2026)

| Item | Status | Evidência | Severidade |
|---|---|---|---|
| Política de privacidade com os 7 elementos do art. 9º | GREEN | /privacidade v24/10/2026 (finalidade, forma e duração, controlador, contato, compartilhamento, responsabilidades, direitos do art. 18) | |
| Base legal documentada por atividade | GREEN | Política item 3 e ROPA.md | |
| Consentimento de cookies e métricas (opt-in) | GREEN (corrigido hoje) | Vercel Analytics e log próprio só com "Aceitar" | |
| Registro do aceite (versão e data) | GREEN (corrigido hoje) | user_metadata termos_versao, termos_aceitos_em | |
| Idade mínima | GREEN (corrigido hoje) | cadastro recusa menor de 18 pela data de nascimento | |
| Canal do titular e protocolo | GREEN | formulário /privacidade + consulta de protocolo | |
| Eliminação de conta | GREEN | carência de 90 dias, site e app | |
| Portabilidade (exportar meus dados) | RED | não há exportação self-service | alta |
| Retenção definida | YELLOW | prazos na Política; acessos_site_log sem expurgo automático | média |
| Runbook de incidente | GREEN (criado hoje) | incidentes/runbook.md | |
| Registro de incidentes por 5 anos | GREEN (criado hoje) | incidentes/log.md, com o caso Itaú duplicado | |
| DPAs com operadores | YELLOW | provedores têm DPA padrão; falta baixar e arquivar | média |
| Transferência internacional | YELLOW | informada na Política; depende das cláusulas dos provedores | média |
| Dados sensíveis (Exames) | YELLOW | aviso no módulo; RIPD pendente antes de liberar para todos | média |
| Acesso técnico do desenvolvedor ao banco | YELLOW | sem criptografia de ponta a ponta; informado na Política item 7 | baixa |
| App: textos de permissão (câmera, fotos, microfone, Face ID) | GREEN | app.json em português | |
| App Store: rótulo de privacidade | YELLOW | conferir em App Store Connect se bate com a Política | média |

## Ações
1. Publicar Termos, Política e Cookies v24/10/2026 depois da validação (feito no código).
2. Exportação dos dados do usuário em JSON/CSV na tela Conta (portabilidade, art. 18, V). Próximas 2 semanas.
3. Expurgo de `acessos_site_log` com mais de 12 meses (mudança no banco: pedir autorização). Próximas 2 semanas.
4. Baixar e arquivar DPAs: Supabase, Vercel, OpenAI, Resend, Pluggy, Oracle. Próximo mês.
5. RIPD do módulo Exames antes de liberar para todos.
6. Conferir o rótulo de privacidade do app na App Store.
