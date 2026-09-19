# Checklist dos pedidos do Control All

Conferência em 2026-09-19. "No código" significa implementado no repositório, não necessariamente validado no site publicado. O proprietário pode marcar aqui o que ainda não aparece ou não funciona para priorizarmos a próxima entrega.

## Implementado no código ou no banco

- [x] Início separado em Finanças, Lista, Notas e Calculadora, sem a calculadora de datas na Home; navegação de retorno para Início e atalhos gerais.
- [x] Tela administrativa de usuários cadastrados, dados básicos e convites, com revogação de convite ainda não usado pelo administrador principal.
- [x] Exclusão de conta comum com `DELETAR` e `Confirmo Delete`; administradores protegidos; recuperação opcional por até 90 dias e opção sem recuperação. A tabela `contas_excluidas` foi criada no Supabase oficial.
- [x] Índices de duplicidade de faturas, despesas e parcelas por grupo, permitindo a mesma fatura em grupos diferentes.
- [x] Importação aprende de-para após classificação manual e permite cadastrar banco e cartão dentro da revisão.
- [x] Login por e-mail ou CPF validado, sugestões de domínio e opção de lembrar somente o identificador, nunca a senha.
- [x] Restrição das operações administrativas globais a `site_admins`, lista de perfis filtrada por grupo e bloqueio de mudança direta do grupo pelo próprio usuário. Policies de faturas e anexos restritas ao grupo foram aplicadas no banco.
- [x] Aviso acadêmico do simulador fora da área útil e marcas intermediárias já existentes mais visíveis.
- [x] Busca automática dos índices atuais de reajuste; projeção de investimento com CDI, Selic e IPCA vigentes, além de taxa fixa manual.
- [x] Código de conexão individual com Google Drive preparado com OAuth direto, token criptografado e escopo `drive.file`. **Ainda não ativo para usuários finais:** precisa da configuração do Google Cloud e do deploy descritos em [configurar-google-drive.md](configurar-google-drive.md).
- [x] O build local foi desvinculado dos pacotes e rotas do Lovable; produção Vercel compilou localmente.
- [x] A leitura de de-para usa uma biblioteca mantida para XLSX e leitor CSV próprio. A biblioteca `xlsx` vulnerável foi removida. Arquivos `.xls` antigos devem ser convertidos para `.xlsx` ou CSV.

## Implementado parcialmente ou sem validação final

- [ ] Testar no site publicado a importação da mesma fatura por Matheus e Terezinha, verificando que cada conta vê somente seu grupo.
- [ ] Testar leitura e bloqueio de faturas e anexos entre duas contas reais de grupos distintos.
- [ ] Conferir visualmente simulador, seringa e layout em celular e desktop; as marcas foram realçadas, mas não foi criada uma nova escala clínica.
- [ ] Confirmar se a conta de teste Terezinha deve ser excluída agora. A busca anterior não a encontrou no banco oficial; depois foi informado que ela se cadastrou novamente. Nenhuma exclusão recente foi executada.
- [ ] Corrigir o envio de convites por e-mail: o Resend retornou 403. Falta remetente/domínio verificado ou alternativa escolhida pelo proprietário.
- [ ] Publicar e validar o isolamento da pasta manual de comprovantes. O código agora usa chave por grupo e a policy existente do banco já restringe `grupo_id`. Duas configurações antigas sem grupo permanecem preservadas, mas invisíveis; seus donos precisarão cadastrar novamente o link.
- [ ] **Aguardando autorização específica para alteração de permissões no Supabase oficial:** criar bucket privado `comprovantes` com policy por grupo. O código local já tem fallback quando o Google Drive está indisponível, mas não pode ser publicado antes dessa migração. A tentativa de executar a migração foi barrada pela revisão de segurança; não houve mudança no banco.
- [ ] Aplicar no banco as migrações `20260919041000_tempo_inatividade.sql` e `20260919042000_orcamentos_por_evento.sql` antes de publicar o código correspondente.
- [ ] Validar em duas contas reais o envio, a abertura e a negação de acesso a comprovantes de outros grupos.

## Ainda não implementado

- [ ] Envio voluntário de fatura com layout desconhecido ao administrador, consentimento específico, descarte do documento e retenção somente do modelo anônimo.
- [ ] Aviso de privacidade e termos finais, aba pública, aceite versionado no cadastro e revisão jurídica. Falta o e-mail de privacidade da Control All LTDA.
- [ ] Formulário e fila administrativa de solicitações de exclusão, com aviso ao administrador, confirmação de identidade e histórico do atendimento.
- [ ] Banner de avisos administrativos para todos os usuários, aceite obrigatório e registro de leitura.
- [ ] Painel analítico com usuários totais/ativos, última atividade, tempo médio de uso e espaço ocupado por conta, sem conteúdo financeiro.
- [ ] Controle de inatividade: código local preparado com padrão de 5 minutos, aviso no minuto final e edição pelo admin; falta aplicar migração, publicar e testar em navegador.
- [ ] Reajuste mensal: código local preparado com média de 6, 12 ou 24 meses do Banco Central e entrada manual; falta publicar e validar os índices reais.
- [ ] Orçamento por evento: código local preparado, mantendo anexos antigos; falta aplicar migração, publicar e testar.
- [ ] Central de alertas: sininho local agrega garantias, óleo, revisão, IPVA, seguro e compras aprovadas; falta publicar e testar.
- [ ] Revisão completa dos gráficos e visões para escala, período, leitura em celular e acessibilidade.

O README antigo continha CPFs e uma senha inicial de exemplo. Foi removido da versão atual, mas permanece no histórico público. Trocar imediatamente qualquer senha que ainda corresponda ao exemplo. A chave publicável do Supabase pode estar no navegador, mas a proteção real depende das policies. A auditoria de dependências ainda aponta `esbuild` vulnerável em ferramentas de desenvolvimento, severidade moderada. A proibição de exclusão para uma conta específica está hoje no cliente e pode ser burlada por acesso direto à API; precisa de reforço no banco antes de ser considerada proteção real. Uma auditoria externa e teste entre contas ainda são necessários.
