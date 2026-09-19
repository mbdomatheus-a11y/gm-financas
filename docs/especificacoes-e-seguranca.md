# Control All: especificações, privacidade e segurança

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

Referências oficiais: [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [modelo de aviso da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/aviso-de-privacidade), [guia de segurança da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/anonimizado___guia_orientat-_seg_da_inf_p_atpp.pdf).

## Administração e comunicação

- Cadastro global de usuários: exibir apenas identidade, contato, status, grupo e datas pertinentes, com proteção das rotas no servidor.
- Pendente: banner de avisos criado pelo administrador global, confirmação de leitura por usuário com data, versão e trilha de auditoria.
- Pendente: painel de estatísticas com totais agregados, usuários ativos, última atividade e armazenamento por conta; não expor conteúdo financeiro individual. Definir o que é uma sessão e como medir tempo de uso antes de exibir médias.
- Pendente: tempo máximo de inatividade configurável pelo administrador, inicialmente 5 minutos, aviso durante o minuto final, opções de continuar ou sair e bloqueio ao encerrar a sessão.

## Finanças, veículos e visualização

- Pendente: média móvel de 6, 12 ou 24 meses de índice para reajuste mensal de receitas e despesas, mantendo valor manual como alternativa. Definir fonte e tratamento de meses sem série antes de calcular.
- Pendente: índices automáticos e entrada manual nos investimentos.
- Pendente: orçamento anexado ao evento do veículo, não ao veículo inteiro.
- Pendente: centro de alertas com sininho para garantias, IPVA, seguro, revisão, óleo e itens de compra aprovados.
- Pendente: revisar todos os gráficos quanto a significado, escala, unidade, períodos vazios, acessibilidade e visualização em celular.
- Implementado no código: o aviso de uso acadêmico saiu de cima dos campos e virou marca discreta fora da área útil; os traços intermediários já existentes ficaram mais visíveis sem criar graduações fictícias. Pendente validar visualmente em celular e desktop.

## Auditoria de segurança em andamento

- Corrigido no código: funções globais deixaram de aceitar qualquer `user_roles.admin`; agora exigem `site_admins` e perfil ativo. Consultas de perfis para módulos financeiros passaram a filtrar o grupo atual.
- Correção de banco preparada, ainda não aplicada: impedir edição direta de identidade/grupo no próprio perfil e restringir objetos dos buckets privados `faturas` e `anexos` ao grupo dono.
- Risco urgente verificado em produção antes dessa migração: as policies de `storage.objects` filtravam apenas por bucket, sem grupo. A policy de atualização do próprio perfil permitia trocar `grupo_id`. Essas duas falhas precisam ser encerradas e testadas com contas de grupos distintos.
- O repositório público contém uma chave Supabase publicável, prevista para uso no navegador. A chave não é segredo; sua segurança depende de RLS e policies corretas. A inspeção dos arquivos versionados e das mudanças do histórico não encontrou valor de chave de serviço ou de API privada. Isso não substitui um scanner de segredos completo e uma auditoria externa.
- Pendente: reativar proteção contra automação no cadastro por convite, verificar confirmação de e-mail, limites de tentativa, logs de acesso e retenção de arquivos.
