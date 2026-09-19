# Validação do checklist de implementação

Atualizado em 2026-09-19. Status: **feito**, **parcial** ou **pendente**. “Feito” significa código e/ou banco implementados; teste entre duas contas reais e revisão jurídica continuam sendo validações separadas.

## 1. Importação de faturas

**Parcial.** Banco e fila administrativa privada, consentimento, prazo de descarte de 30 dias, status e notificação de correção foram criados. Falta expor o envio de arquivo pela tela de importação e automatizar o descarte físico após o prazo.

## 2. Aprendizado de categorias e De/Para

**Feito.** A classificação manual salva a regra, importa CSV/XLSX, permite editar ou excluir e aplica a regra em importações futuras. As regras são protegidas por RLS e pelo índice único `(grupo_id, estabelecimento_normalizado, tipo_regra)`, aplicado em produção. A correspondência aceita variações que contêm o estabelecimento, sem transformar textos apenas parecidos em regra exata.

## 3. Cadastro durante a importação

**Feito.** Banco e cartão podem ser cadastrados dentro da revisão e a importação preserva as linhas já processadas.

## 4. Cadastro, login e credenciais

**Feito com validação pendente.** E-mail ou CPF válido, sugestões de domínio, lembrança somente do identificador, recuperação de senha e bloqueio de 15 minutos após três falhas na interface foram implementados. Senhas não são salvas pelo site. Falta teste real de ponta a ponta.

## 5. Termos de Uso e LGPD

**Parcial.** Páginas públicas, aceite versionado no cadastro e registro no banco foram implementados. O contato provisório publicado é `mbdo.matheus@gmail.com`. Revisão jurídica independente continua necessária antes de alegar conformidade definitiva.

## 6. Solicitações de privacidade e exclusão

**Parcial.** O formulário pede e-mail, telefone, CPF e motivo, gera protocolo e cria uma fila administrativa. Falta procedimento operacional de validação de identidade e resposta dentro dos prazos aplicáveis.

## 7. Simulador e seringa

**Parcial.** O aviso acadêmico foi reposicionado como marca discreta e a escala ganhou marcas intermediárias visíveis. Falta conferência visual formal em celular e desktop e validação clínica, que não pode ser presumida pelo sistema.

## 8. Reajustes e despesas

**Parcial.** Índices automáticos, média geométrica mensal de 6, 12 ou 24 meses e preenchimento manual foram preparados para receitas e despesas, com testes de cálculo. Falta validação no site com as séries atuais e apresentação consistente de fonte, período e atualização em todos os módulos.

## 9. Isolamento dos dados por usuário

**Parcial crítico.** Consultas financeiras foram filtradas por grupo, RLS está ativo em todas as tabelas públicas e Storage passou a ter policies por grupo. A visualização administrativa foi reduzida. Ainda falta teste funcional de negação e permissão com duas contas reais e registro de acesso administrativo a dados pessoais.

## 10. Administração de usuários

**Parcial.** A tela e a revogação de convites existem. Falta suspensão/reativação, mascaramento uniforme de e-mail, último acesso e espaço usado, além de log completo de ações.

## 11. Comunicados e alertas administrativos

**Parcial.** Há criação de comunicado administrativo e tabela de aceite. Falta o banner modal para todos os usuários e leitura/aceite na interface do destinatário.

## 12. Analytics do sistema

**Parcial.** Painel agregado mostra contas, ativas e média de sessões concluídas sem expor dados financeiros. Falta cálculo de espaço por usuário e definição visual de atividade nos últimos 30 dias.

## 13. Investimentos

**Parcial.** O módulo permite índice automático e manual. Falta histórico imutável do índice usado por simulação, indicação visual uniforme do manual e tratamento visível de falha de fonte.

## 14. Inatividade e segurança da sessão

**Feito no código e banco.** Padrão de 5 minutos, aviso no último minuto, manter sessão, sair e bloqueio de tela foram implementados. Falta teste de uso real após login.

## 15. Veículos, documentos e alertas

**Parcial.** Orçamento foi vinculado ao evento por coluna, chave estrangeira e gatilho; sininho agrega alertas. Faltam preferências de antecedência/recorrência, marcar lido e teste em duas contas.

## 16. Gráficos e experiência visual

**Pendente.** Há melhorias pontuais, mas a revisão sistemática de todos os gráficos, responsividade e acessibilidade não foi concluída.

## 17. Versionamento e documentação

**Feito parcialmente.** Commits claros, testes e build precedem publicação; documentação técnica existe. Este arquivo consolida a validação. O deploy é confirmado por versão visível no endereço oficial, mas cada recurso autenticado ainda precisa de teste funcional.

## 18. Varredura de segurança

**Parcial.** Revisados RLS, Storage, headers, dependências e `.env`. O `.env` deixou de ser versionado, preservado localmente. Não foi encontrada chave de serviço nos arquivos atuais; há uma vulnerabilidade moderada transitiva de `esbuild` em ferramentas de desenvolvimento. Faltam teste de IDOR entre contas reais, rate limiting, revisão de logs e varredura completa do histórico com ferramenta dedicada.

## 19. Botão Salvar como regra

**Feito.** O botão agora alterna entre salvar e remover, bloqueia duplicidade e atualiza a lista na hora. A remoção respeita a permissão do perfil.

## 20. Correção de lançamentos duplicados

**Feito.** O alerta virou “Possível correspondência” e exige descrição normalizada, valor com tolerância máxima de 2%, mesmo cartão ou conta e competência compatível. Nunca usa categoria isoladamente. O usuário escolhe manter ambos, substituir somente a ocorrência do mês, ignorar a importação ou vincular sem alterar o valor. Há testes para valores e descrições conflitantes, cartões diferentes e parcelamento.

## 21. Convites e workspaces familiares

**Parcial.** Contas novas criadas por convite recebem espaço próprio e o compartilhamento é explícito por grupo. Há permissões de módulos e revogação de convite. Faltam modalidades distintas no convite, grupos de permissão configuráveis, múltiplos workspaces por usuário, troca de workspace e testes formais entre espaço pessoal e familiar.

## Contornos que exigem ação futura

- `emailadmin@nomedosite.com.br` é fictício e deve ser trocado por caixa postal real antes de publicar Termos ou Aviso de Privacidade.
- Google Drive direto depende de credenciais OAuth no Google Cloud. O fallback privado no Supabase funciona após as migrations já aplicadas.
- Resend continua dependente de domínio ou remetente verificado para enviar e-mails externos.
