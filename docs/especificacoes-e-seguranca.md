# Control All: especificações, privacidade e segurança

## Revisão de 22/09/2026: acesso, módulos, grupos e alertas

- A identidade visual cadastrada pelo administrador passa a alimentar também o ícone exibido na aba do navegador. O arquivo continua centralizado no bucket público de identidade visual, sem duplicação manual de logos.
- O administrador global pode definir o acesso por CPF, por e-mail ou pelos dois. O rótulo, a orientação e a validação da tela de entrada acompanham a opção vigente. CPF continua sujeito à validação matemática.
- O segundo fator por e-mail é opcional e global. Depois de validar a senha, o sistema envia um código numérico de uso único, válido por 10 minutos e limitado a cinco tentativas. O código é armazenado somente como hash. O login só abre a sessão depois da validação do segundo fator.
- Três senhas incorretas bloqueiam novas tentativas para o mesmo identificador por 15 minutos. Essa proteção é executada no servidor, inclusive contra chamadas que contornem a tela.
- A sessão autenticada não é renovada silenciosamente e é encerrada em no máximo 60 minutos. O bloqueio por inatividade configurável permanece independente e pode encerrar antes desse limite.
- Toda alteração de senha dispara um aviso para o e-mail real da conta. O aviso inclui um link de emergência, válido por 24 horas, para bloquear uma conta não administrativa e orienta contato com `privacidade@controlall.com.br`. Contas administrativas exigem atendimento manual para evitar bloqueio malicioso do administrador global.
- Alertas de veículos, garantias e compras deixam o contador assim que o usuário os abre. A leitura fica registrada por usuário e o histórico continua acessível. A chave dos alertas de veículo usa a data ou a quilometragem de referência, evitando que o mesmo evento volte apenas porque o texto da contagem diária mudou.
- O administrador global pode liberar ou ocultar Finanças, Lista, Notas, Calculadora, Pet, Onde está?, Veículos e Exames para todos. Quando um módulo global está oculto, pode ser liberado para pessoas específicas. Administradores globais mantêm acesso integral. A proteção é aplicada na navegação e também ao abrir diretamente a rota do módulo.
- Convites de grupo são enviados apenas para contas já cadastradas. A pessoa convidada precisa aceitar conscientemente o aviso de que o espaço de trabalho passará a ser único e compartilhado. A união é transacional: qualquer conflito desfaz toda a operação. O administrador global vê somente a composição dos grupos e os dados básicos dos membros, sem conteúdo financeiro.
- Comunicados administrativos recebem validade padrão de 72 horas. O administrador pode encerrá-los antes e consultar a trilha de leitura.
- O gráfico de fluxo mensal permite alternar entre visão completa, somente receitas e somente despesas, além de escolher barras ou linhas.
- A migração `20260922010000_configuracoes_acesso_modulos_grupos.sql` foi aplicada no Supabase oficial em 22/09/2026. A verificação confirmou as tabelas de configuração, módulos, exceções, 2FA, leitura de alertas e convites, a função de aceite de grupo e os oito módulos iniciais.

## Revisão de 20/09/2026: exclusão e layouts

- Exclusão recuperável foi refeita: o usuário de autenticação e seus dados vinculados permanecem por até 90 dias, mas o acesso é banido, as sessões são revogadas e o perfil fica inativo e desvinculado do grupo. A restauração exige CPF válido, e-mail anterior e código aleatório enviado a esse e-mail, além de novo convite. O código é armazenado apenas como hash, expira em 15 minutos e admite no máximo cinco tentativas. O administrador do grupo pode solicitar a exclusão; o administrador global não. As migrações `20260920020000` e `20260920021000` foram aplicadas no banco oficial em 20/09/2026. Ainda falta testar o ciclo completo com conta descartável antes de afirmar recuperação integral em produção.
- A opção de exclusão irreversível foi retirada temporariamente da interface: 28 tabelas têm FK direta para grupos, muitas sem cascata, e os objetos de Storage precisam ser removidos pela API. O backend recusa essa modalidade até existir uma rotina transacional e testada. A expiração em 90 dias **ainda não apaga fisicamente** a conta nem os arquivos de um grupo vazio. Esta é uma pendência de privacidade de alta prioridade, não uma rotina já concluída.
- Decisão do proprietário: ao excluir um membro, preservar os lançamentos compartilhados para os demais. Se era o último membro do grupo, apagar os dados e arquivos do grupo após 90 dias sem recuperação.
- Administração de layouts: botão de abertura com URL assinada por 60 segundos, registro de acesso e remoção física do arquivo quando a solicitação é concluída ou descartada. A rota diária de descarte após 30 dias exige `CRON_SECRET`; a variável secreta foi configurada na Vercel Production em 20/09/2026 e o redeploy ficou pronto. A primeira execução agendada ainda não foi observada.
- A distinção entre administrador global (`site_admins`) e do grupo (`user_roles.admin`) foi revisada. A exclusão de administrador do grupo continua bloqueada até a migração segura acima; a do administrador global permanece proibida.
- Analytics administrativos passaram a registrar atividade enquanto a sessão é usada e a encerrá-la por logout ou inatividade. A média considera até a última interação; sessões anteriores à instrumentação podem aparecer com duração zero. A administração mostra última atividade e bytes de objetos atribuídos por usuário. Objetos criados via service role ficam separados como não atribuídos. A visualização SQL `admin_uso_arquivos` foi aplicada no Supabase oficial em 20/09/2026, sem modificar metadados de Storage.

Atualizado em 2026-09-19. Este documento registra o funcionamento verificado no código e as mudanças solicitadas. Itens marcados como pendentes não devem ser apresentados como entregues.

## Identidade e isolamento

- Projeto Supabase oficial: `wjapagkdgjlavonbmjdu`. Repositório público `mbdomatheus-a11y/gm-financas`.
- Cada conta convidada recebe grupo próprio. Somente membros do mesmo grupo compartilham finanças. Administrador do grupo não é administrador global do site.
- A administração global deve consultar apenas dados básicos de cadastro e métricas agregadas, nunca despesas, faturas ou documentos de outro grupo.
- O papel de administrador global é controlado pela tabela `site_admins`, não pelo papel `admin` em `user_roles`.
- Login por CPF válido ou e-mail. O usuário pode optar por lembrar apenas o identificador no dispositivo; o site não armazena a senha nesse recurso.

## Importação de faturas

- Duplicidade de PDF, despesa e parcela é avaliada dentro do mesmo grupo, não entre grupos.
- Classificações de categoria/subcategoria alteradas pelo usuário na revisão são gravadas como de-para depois de importar com sucesso. A classificação automática sem revisão manual não vira regra permanente por si só.
- Implementado no código: cadastro de banco/conta e cartão com final dentro da revisão da fatura; o novo destino é selecionado automaticamente sem sair da importação. Pendente validar no site publicado.
- Pendente: permitir envio voluntário de PDF com layout não reconhecido para modelagem pela administração. Antes do envio, explicar que o documento pode conter dados financeiros pessoais, exigir concordância específica, restringir acesso a administradores do site, registrar finalidade/prazo e eliminar o PDF após o uso. Conservar somente o modelo de layout sem dados identificáveis.

## Privacidade e direitos do titular

- Controladora informada pelo proprietário: Control All LTDA. Canal de privacidade: **a definir**. Não publicar aviso final nem exigir aceite de um texto com contato incompleto.
- O aviso deverá informar dados tratados (cadastro, lançamentos, PDFs, documentos, dados de sessão e registros técnicos), finalidades, bases legais avaliadas, retenção, direitos, canal de contato, medidas de segurança e prestadores técnicos.
- Não prometer ausência absoluta de compartilhamento: Supabase, hospedagem e serviço de e-mail podem tratar dados como prestadores necessários ao funcionamento. Diferenciar esse tratamento de venda de dados ou divulgação pública.
- A responsabilidade do usuário por guardar a senha e não compartilhar a conta não elimina as obrigações legais e técnicas da controladora.
- Pendente: tela pública de aviso e termos, aceite versionado no cadastro, canal autenticado de solicitação de exclusão, protocolo e fila administrativa com acesso restrito. Solicitar e-mail, telefone, CPF e motivo, mas evitar exigir motivo para exercer direito legal quando não for obrigatório. Confirmar a identidade antes de excluir.
- Pendente: revisão jurídica do texto por profissional habilitado antes da publicação final.
- A conexão opcional com Google Drive foi reimplementada para cada usuário autorizar a própria conta, com escopo `drive.file` e token de atualização criptografado. A ativação no site depende da configuração do cliente OAuth e do teste descritos em `docs/configurar-google-drive.md`; não considerar entregue em produção antes disso.
- Alternativa sem conta Google: comprovantes de notas fiscais ficam no bucket privado `comprovantes`, com caminho ligado à nota e autorização por grupo; links assinados expiram. A migração `20260919040000_comprovantes_privados.sql` foi aplicada no Supabase oficial em 2026-09-19: bucket privado, limite de 10 MiB e policy por grupo confirmados. Ainda falta teste funcional entre contas distintas.
- A pasta manual externa foi isolada por `grupo_id` e por chave de grupo. A policy de `configuracoes_casal` já existia no banco oficial. As duas linhas antigas sem grupo são preservadas, mas deixam de aparecer; é necessário cadastrar novamente o link para cada grupo.

Referências oficiais: [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [modelo de aviso da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/aviso-de-privacidade), [guia de segurança da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/anonimizado___guia_orientat-_seg_da_inf_p_atpp.pdf).

## Administração e comunicação

- Cadastro global de usuários: exibir apenas identidade, contato, status, grupo e datas pertinentes, com proteção das rotas no servidor.
- Pendente: banner de avisos criado pelo administrador global, confirmação de leitura por usuário com data, versão e trilha de auditoria.
- Pendente: painel de estatísticas com totais agregados, usuários ativos, última atividade e armazenamento por conta; não expor conteúdo financeiro individual. Definir o que é uma sessão e como medir tempo de uso antes de exibir médias.
- Preparado localmente: tempo máximo de inatividade configurável pelo administrador global, inicialmente 5 minutos, aviso durante o minuto final, opções de continuar ou sair e encerramento da sessão. A migração `20260919041000_tempo_inatividade.sql` foi aplicada no Supabase oficial em 2026-09-19; acesso SQL foi limitado a leitura por usuários autenticados e escrita pelo serviço administrativo. Faltam publicação e teste real. O temporizador é proteção de interface e sessão; não substitui expiração de tokens no servidor.

## Finanças, veículos e visualização

- Preparado localmente: média geométrica mensal dos últimos 6, 12 ou 24 meses de IPCA, INCC-DI, IGP-DI, IGP-M, CDI ou Selic a partir das séries SGS do Banco Central. O percentual resultante é aplicado mensalmente em receitas e despesas; entrada manual continua disponível. Dados insuficientes geram erro explícito. Falta validar em produção.
- Índices automáticos e entrada manual nos investimentos já constam no código anterior; falta testar em produção.
- Preparado localmente: orçamento anexado a um evento específico do veículo, com migração `20260919042000_orcamentos_por_evento.sql` aplicada no Supabase oficial em 2026-09-19. Coluna, vínculo e gatilho de validação foram confirmados; os anexos antigos continuam no nível do veículo e não são perdidos. Falta testar a interação no site.
- Preparado localmente: sininho de alertas agregando garantias próximas/vencidas, IPVA, seguro, revisão/óleo e compras aprovadas. Falta validar em produção e revisar ruído dos alertas.
- Pendente: revisar todos os gráficos quanto a significado, escala, unidade, períodos vazios, acessibilidade e visualização em celular.
- Implementado no código: o aviso de uso acadêmico saiu de cima dos campos e virou marca discreta fora da área útil; os traços intermediários já existentes ficaram mais visíveis sem criar graduações fictícias. Pendente validar visualmente em celular e desktop.

## Auditoria de segurança em andamento

- Corrigido no código: funções globais deixaram de aceitar qualquer `user_roles.admin`; agora exigem `site_admins` e perfil ativo. Consultas de perfis para módulos financeiros passaram a filtrar o grupo atual.
- Correção de banco aplicada em 2026-09-19 no Supabase oficial, conforme `supabase/migrations/20260919030000_isolamento_seguranca.sql`: o gatilho em `profiles` impede que usuários autenticados alterem diretamente identidade ou `grupo_id`, e os buckets privados `faturas` e `anexos` agora vinculam cada arquivo ao grupo do lote ou veículo.
- Verificação após a migração: gatilho ativo, policies novas presentes, policies antigas ausentes e os 8 arquivos de fatura preservados. Ainda falta teste funcional com duas contas de grupos diferentes para confirmar acesso permitido no próprio grupo e negado no outro.
- O repositório público contém uma chave Supabase publicável, prevista para uso no navegador. A chave não é segredo; sua segurança depende de RLS e policies corretas. A inspeção dos arquivos versionados e das mudanças do histórico não encontrou valor de chave de serviço ou de API privada. Isso não substitui um scanner de segredos completo e uma auditoria externa.
- O README antigo continha CPFs e uma senha inicial previsível. Os dados foram retirados da versão atual, mas ainda existem no histórico público. Trocar as senhas de qualquer conta que tenha usado aquele valor, sem reescrever o histórico publicado às cegas.
- A auditoria de dependências encontrou duas vulnerabilidades altas no pacote `xlsx@0.18.5`, usado para ler planilhas enviadas pelo usuário. Ele foi substituído por `read-excel-file@9.3.10` e um leitor CSV próprio. Restou um alerta moderado em versões de `esbuild` usadas por ferramentas de desenvolvimento; manter o servidor local fora de acesso público e planejar atualização dos pacotes que o trazem.
- O bloqueio de exclusão da conta compartilhada está atualmente apenas na interface, por CPF fixo. Isso não é uma barreira de segurança contra chamadas diretas à API do Supabase. É urgente criar uma regra no banco que impeça essa conta de deletar dados, inclusive por chamadas diretas, e remover a identificação pessoal do código cliente.
- Foram preparados cabeçalhos HTTP de proteção para Vercel em `vercel.json`: bloqueio de enquadramento por outros sites, bloqueio de tipos MIME inesperados e políticas de referência/permissões. A implantação ainda não foi feita; falta verificar os cabeçalhos no endereço público e planejar uma CSP completa que não quebre as integrações.
- Referências da troca do leitor de Excel: [alerta de prototype pollution no `xlsx`](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), [alerta de ReDoS no `xlsx`](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) e [documentação do novo leitor](https://github.com/catamphetamine/read-excel-file).
- Pendente: reativar proteção contra automação no cadastro por convite, verificar confirmação de e-mail, limites de tentativa, logs de acesso e retenção de arquivos.
- Risco residual: as migrações de comprovantes, inatividade e orçamento foram aplicadas, mas ainda faltam testes funcionais com contas de grupos diferentes. Não tratar a separação de dados como auditada apenas pela inspeção das policies.
