# Implementação comercial, Pet e Exames

Atualizado em 19/09/2026.

## Página pública

- A Home é comercial e mantém a identidade animada Control ALL.
- Recursos, Módulos, Demonstração, Preços, Termos e Privacidade ficam no menu superior.
- A demonstração usa exclusivamente valores e situações fictícias.
- Preço de lançamento apresentado: R$ 4,99 por mês. A cobrança ainda não está ativa.

## Analytics

- Vercel Web Analytics é iniciado no componente raiz por `inject()`.
- A função `beforeSend` descarta parâmetros de URL antes do envio, protegendo tokens de convite, recuperação e outros identificadores.
- Não foram criados eventos personalizados com CPF, e-mail, valor financeiro, resultado de exame ou identificador de usuário.

## Privacidade e alertas

- Solicitações de privacidade validam CPF no navegador e no servidor.
- A solicitação grava somente SHA-256 do CPF, nunca o CPF em texto claro.
- Comunicados exigem aceite, ficam no histórico do usuário e geram evento administrativo na publicação e no aceite.
- A administração exibe indicadores quantitativos, solicitações, faturas em modelagem e log administrativo. Ela não consulta lançamentos financeiros ou resultados clínicos.

## Pets

- Perfil com espécie, raça, sexo, data de nascimento, pelagem, restrições e observações.
- Carteira com vacina, lote, fabricante, validade, aplicação, próxima dose, veterinário e CRMV.
- Leitura por imagem produz uma prévia editável. Não há confirmação automática de dados manuscritos, etiquetas ou datas.
- Sugestões iniciais para cães e gatos são organizacionais. O calendário final deve ser confirmado pelo veterinário.

## Exames

- Importa PDF, JPG, PNG e WEBP para produzir resultados candidatos.
- Cada item pode ser corrigido, selecionado ou descartado antes do salvamento. Também há inclusão manual.
- Exames são privados por padrão. O compartilhamento familiar é opt-in por registro.
- O extrator não produz diagnóstico, recomendação médica nem interpretação clínica.

## Banco de dados

A migração `20260919110000_comercial_pet_exames_alertas.sql` adiciona colunas opcionais de Pet e Exames, a tabela de histórico de alertas e índices de consulta. Foi aplicada ao projeto Supabase oficial em 19/09/2026.

## Próximas configurações externas

- Ativar Web Analytics no painel da Vercel e publicar o deploy.
- Criar a conta comercial e as credenciais do Mercado Pago antes de habilitar cobrança real.
- Substituir o e-mail provisório de privacidade quando o domínio da Control ALL estiver pronto.
