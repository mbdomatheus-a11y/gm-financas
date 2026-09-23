# Implementação de acesso, módulos, grupos e notificações

Data: 22/09/2026

## Entregas

1. Logo dinâmico no cabeçalho e no ícone do navegador, usando o mesmo arquivo enviado pela administração.
2. Regra global de login por CPF, e-mail ou ambos, refletida automaticamente na tela pública.
3. Segundo fator opcional por e-mail, com código de seis números, validade de dez minutos, uso único e cinco tentativas.
4. Sessão sem renovação silenciosa, limitada a uma hora, além do controle de inatividade já existente.
5. Aviso de alteração de senha com link emergencial de bloqueio e contato de privacidade.
6. Alertas marcados como lidos por pessoa, sem permanecer no contador, com histórico preservado.
7. Catálogo administrativo de módulos com regra global e exceções individuais. O administrador global nunca perde acesso.
8. Veículos como módulo e botão próprios na página inicial.
9. Convite entre contas existentes para união consciente do espaço de trabalho, com aviso explícito antes do aceite.
10. Relatório administrativo de grupos e respectivos membros, sem exposição de lançamentos.
11. Comunicados com expiração automática em 72 horas e encerramento manual pela administração.
12. Fluxo de caixa com filtros de receitas e despesas e escolha entre gráfico de barras ou linhas.

## Regras de segurança

- O limite de três tentativas e bloqueio por 15 minutos é validado no servidor.
- Códigos de 2FA e tokens de bloqueio são persistidos somente em formato hash.
- O link de bloqueio não pode desativar administrador global.
- A união de grupos exige e-mail autenticado igual ao destinatário do convite e só parte de um grupo individual. Toda a migração ocorre em uma única transação.
- As configurações administrativas são alteradas somente por funções protegidas que confirmam o registro em `site_admins`.
- Ocultar um módulo é uma regra de disponibilização do produto. O isolamento dos dados continua sendo responsabilidade das policies RLS por grupo.

## Operação do segundo fator

1. A pessoa informa identificador e senha.
2. O servidor valida o modo de login, o limite de tentativas, a senha e o status da conta.
3. Se o 2FA estiver ativo, nenhuma sessão é entregue ao navegador. Um código é enviado ao e-mail cadastrado.
4. Depois de conferir o código, o servidor gera um token de uso único e o navegador abre a sessão.
5. Após 60 minutos, o token não é renovado e a interface encerra o acesso.

## Banco de dados

A migração `20260922010000_configuracoes_acesso_modulos_grupos.sql` reúne as tabelas, políticas, índices e a função transacional desta entrega. Foi aplicada ao projeto Supabase oficial `wjapagkdgjlavonbmjdu` em 22/09/2026. A consulta de verificação confirmou as sete estruturas esperadas e os oito módulos cadastrados.
