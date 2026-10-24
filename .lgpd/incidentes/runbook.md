# Runbook de incidente de segurança (LGPD art. 48 e Res. CD/ANPD nº 15/2024)

1. Conter: revogar chaves expostas (Supabase service role, Pluggy, OpenAI, Resend), bloquear contas afetadas, tirar do ar a função com falha.
2. Registrar em `log.md` na hora: data em que soube, o que aconteceu, dados e titulares afetados.
3. Avaliar se é notificável (Res. 15/2024, art. 5º, cumulativo): risco ou dano relevante E pelo menos uma categoria: sensíveis (exames), financeiros, autenticação (senhas, tokens), larga escala, crianças/idosos, sigilo.
4. Se notificável: comunicar a ANPD em 3 dias úteis (pequeno porte: prazo em dobro, salvo risco à integridade física ou moral) pelo formulário do site da ANPD, com os itens do art. 6º, § 2º.
5. Comunicar os titulares no mesmo prazo, em linguagem simples (art. 9º): o que houve, dados envolvidos, riscos, medidas tomadas, o que a pessoa pode fazer, contato (privacidade@controlall.com.br).
6. Corrigir a causa e registrar a lição em `log.md` e no vault (06 - APRENDIZADOS).
7. Guardar o registro por 5 anos, notificado ou não (art. 10).
