# Checklist dos pedidos do Control All

Conferência atualizada em 23/09/2026. "No código" significa implementado no repositório. O proprietário pode validar no ambiente de produção Vercel/Supabase.

## Implementado no código e no banco

- [x] Início separado em Finanças, Lista, Notas e Calculadora, sem a calculadora de datas na Home; navegação de retorno para Início e atalhos gerais.
- [x] Tela administrativa de usuários cadastrados, dados básicos e convites, com revogação de convite ainda não usado pelo administrador principal.
- [x] Exclusão de conta com recuperação integral por 90 dias. A versão atual retém o usuário de autenticação, exige código enviado ao e-mail anterior para recuperar e bloqueia o acesso durante a janela. Migrações aplicadas em 20/09/2026.
- [x] Formulário público/autenticado de solicitação de privacidade LGPD (`LegalDialogs.tsx`) integrado à fila administrativa (`/administracao`) e tabela `solicitacoes_privacidade`.
- [x] Envio voluntário de fatura com layout desconhecido ao administrador (`importar.tsx`), descarte em até 30 dias e retenção somente do modelo.
- [x] Banner de avisos administrativos (comunicados) com aceite obrigatório, expiração automática de 72h e encerramento manual na administração.
- [x] Central de alertas no topo (`AlertsBell.tsx`) integrando garantias, óleo, revisão, IPVA, seguro, compras aprovadas e versões de build do site.
- [x] Controle de inatividade em segundo plano (`InactivityGuard.tsx`), padrão de 5 minutos, aviso visual no minuto final e encerramento automático da sessão.
- [x] Orçamento por evento em veículos (`veiculos.tsx`), vinculando uploads de orçamentos e comprovantes aos eventos de manutenção.
- [x] Reajuste de valores atrelado a índices do Banco Central (`IPCA`, `IGP-M`, `CDI`, `SELIC`, `INCC-DI`), com médias de 6, 12 ou 24 meses (`indices.functions.ts`).
- [x] Tratamento gracioso e diagnóstico do envio de e-mails via Resend (`email.server.ts`), informando causa de erro HTTP 403 quando o domínio do remetente não está verificado.
- [x] Índices de duplicidade de faturas, despesas e parcelas por grupo, permitindo a mesma fatura em grupos diferentes.
- [x] Importação aprende de-para após classificação manual e permite cadastrar banco e cartão dentro da revisão.
- [x] Login por e-mail ou CPF validado, sugestões de domínio e opção de lembrar somente o identificador, nunca a senha.
- [x] Restrição das operações administrativas globais a `site_admins`, lista de perfis filtrada por grupo e bloqueio de mudança direta do grupo pelo próprio usuário. Policies de faturas e anexos restritas ao grupo foram aplicadas no banco.
- [x] Busca automática dos índices atuais de reajuste; projeção de investimento com CDI, Selic e IPCA vigentes, além de taxa fixa manual.
- [x] Código de conexão individual com Google Drive preparado com OAuth direto, token criptografado e escopo `drive.file`. **Ainda não ativo para usuários finais:** precisa da configuração do Google Cloud e do deploy descritos em [configurar-google-drive.md](configurar-google-drive.md).
- [x] O build local foi desvinculado dos pacotes e rotas do Lovable; produção Vercel compilou localmente.
- [x] Migrações `20260919040000_comprovantes_privados.sql`, `20260919041000_tempo_inatividade.sql`, `20260919042000_orcamentos_por_evento.sql` e `20260923010000_totais_fatura_limites_versoes.sql` aplicadas.

## Validação no ambiente publicado (Produção)

- [ ] Validar no site publicado o envio de e-mails de convite e recuperação após a adição das chaves DNS do domínio no Resend (`RESEND_FROM_EMAIL`).
- [ ] Testar no site publicado a importação da mesma fatura por duas contas de grupos distintos, verificando o isolamento de dados.
- [ ] Conferir visualmente o comportamento dos componentes em dispositivos móveis e desktop.
- [ ] Conectar as credenciais do Google Cloud para habilitar o atalho do Google Drive no ambiente público.

## Pendências de longo prazo / Roadmap

- [ ] Importação inteligente — Etapas 5 a 9 (revisão compacta, gravação atômica, duplicidades e aprendizado controlado).
- [ ] Limpeza física automática das contas excluídas há mais de 90 dias via cron job programado.
