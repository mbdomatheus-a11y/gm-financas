# Registro das operações de tratamento (LGPD art. 37), versão simplificada de pequeno porte

| Atividade | Titulares | Dados | Base legal | Onde fica | Operadores | Retenção |
|---|---|---|---|---|---|---|
| Cadastro e login | usuários | nome, CPF, e-mail, telefone, nascimento, senha (hash), aceite | contrato (art. 7º, V) | Supabase Auth e profiles | Supabase | enquanto houver conta |
| Lançamentos e módulos financeiros | usuários e grupo | despesas, receitas, cartões (4 dígitos), bancos, investimentos | contrato | Supabase | Supabase | enquanto houver conta |
| Importação de faturas | usuários | arquivos de fatura, lançamentos extraídos | contrato | Supabase, Oracle | Supabase, Oracle, OpenAI (quando usa IA) | lançamentos: conta; layout: 30 dias |
| Open Finance | usuários autorizantes | contas, saldos, transações, investimentos | consentimento (art. 7º, I) + contrato | Supabase (pluggy_*) | Pluggy | enquanto houver conta ou até excluir |
| Notas fiscais e garantias | usuários | chave, itens, comprovantes | contrato | Supabase, Oracle, Google Drive do usuário | SEFAZ (consulta), Oracle, Google | enquanto houver conta |
| Assistente de IA | usuários | texto, áudio, resumo de totais | contrato | não persiste no banco | OpenAI | não guardado |
| Exames | usuários e familiares | dados de saúde | consentimento específico (art. 11, I) | Supabase | Supabase | enquanto houver conta |
| Segurança e alertas | usuários e visitantes | IP, aparelho, local aproximado, logs | legítimo interesse (art. 7º, IX) e segurança (art. 11, II, g) | Supabase | Vercel, Resend | mínimo 6 meses (Marco Civil art. 15) |
| Métricas de acesso | visitantes que aceitam | página, origem, sessão anônima | consentimento | Supabase, Vercel | Vercel | até 12 meses (planejado) |
| Suporte e direitos do titular | usuários e visitantes | contato, CPF, mensagens | obrigação legal e contrato | Supabase | Resend | tempo necessário para comprovar o atendimento |
