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

## Implementado parcialmente ou sem validação final

- [ ] Testar no site publicado a importação da mesma fatura por Matheus e Terezinha, verificando que cada conta vê somente seu grupo.
- [ ] Testar leitura e bloqueio de faturas e anexos entre duas contas reais de grupos distintos.
- [ ] Conferir visualmente simulador, seringa e layout em celular e desktop; as marcas foram realçadas, mas não foi criada uma nova escala clínica.
- [ ] Confirmar se a conta de teste Terezinha deve ser excluída agora. A busca anterior não a encontrou no banco oficial; depois foi informado que ela se cadastrou novamente. Nenhuma exclusão recente foi executada.
- [ ] Corrigir o envio de convites por e-mail: o Resend retornou 403. Falta remetente/domínio verificado ou alternativa escolhida pelo proprietário.
- [ ] Revisar o armazenamento da pasta manual de comprovantes em `configuracoes_casal`: a implementação antiga usa chave global e precisa ser isolada por grupo antes de ser tratada como compartilhamento seguro.

## Ainda não implementado

- [ ] Envio voluntário de fatura com layout desconhecido ao administrador, consentimento específico, descarte do documento e retenção somente do modelo anônimo.
- [ ] Aviso de privacidade e termos finais, aba pública, aceite versionado no cadastro e revisão jurídica. Falta o e-mail de privacidade da Control All LTDA.
- [ ] Formulário e fila administrativa de solicitações de exclusão, com aviso ao administrador, confirmação de identidade e histórico do atendimento.
- [ ] Banner de avisos administrativos para todos os usuários, aceite obrigatório e registro de leitura.
- [ ] Painel analítico com usuários totais/ativos, última atividade, tempo médio de uso e espaço ocupado por conta, sem conteúdo financeiro.
- [ ] Controle de inatividade configurável pelo administrador, padrão de 5 minutos, aviso no minuto final e encerramento da sessão.
- [ ] Reajuste mensal de receitas e despesas pela média escolhida de 6, 12 ou 24 meses, com opção manual.
- [ ] Orçamento anexado a um evento específico do veículo; hoje o anexo pertence ao veículo.
- [ ] Central de alertas com sininho para garantias, óleo, revisão, vencimentos do carro e compras aprovadas.
- [ ] Revisão completa dos gráficos e visões para escala, período, leitura em celular e acessibilidade.

O repositório público não deveria conter senhas ou chaves privadas. A chave publicável do Supabase pode estar no navegador, mas a proteção real depende das policies. A auditoria de segurança ainda não substitui teste externo nem varredura completa de segredos.
