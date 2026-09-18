# Conectar o Supabase existente sem criar banco

## Estado confirmado

- O projeto está atualmente apontando para `sjkmdsjcbifdzzgwtsgm`.
- Ele **não** está conectado ao Supabase solicitado: `wjapagkdgjlavonbmjdu` (`control+all`).
- O Supabase externo só fica disponível depois que o projeto Cloud atualmente anexado for desconectado.
- Não existe ferramenta no chat para realizar a autorização OAuth do Supabase externo em seu nome.
- Nenhuma configuração ou dado foi alterado nesta verificação.

## Passos seguros para você executar

1. Abra **Project Settings → Integrations** (ou **Cloud → Advanced**, conforme aparecer no painel).
2. Desconecte o projeto Cloud atual `sjkmdsjcbifdzzgwtsgm`.
   - Confirme cuidadosamente que o identificador exibido é esse.
   - Não selecione nenhuma opção para criar outro banco.
3. Volte a **Project Settings → Integrations → Supabase**.
4. Escolha **Connect existing project** / **I already have a Supabase project**.
5. Entre na conta Supabase com acesso à organização **mwathews**.
6. Selecione somente o projeto **control+all**, ID `wjapagkdgjlavonbmjdu`.
7. Confirme que a URL apresentada é `https://wjapagkdgjlavonbmjdu.supabase.co` antes de autorizar.

## Validação posterior

Quando você concluir e avisar, farei uma verificação sem criar banco:

- confirmar que cliente e funções de servidor apontam para `wjapagkdgjlavonbmjdu`;
- conferir o acesso às tabelas já existentes;
- testar criação e listagem de convites;
- testar a conexão e o envio para o Google Drive;
- informar qualquer pendência sem apagar ou migrar dados.

## Restrição obrigatória

Não ativar nem criar Lovable Cloud durante este processo. Não apagar, migrar, restaurar ou sobrescrever dados do Supabase `wjapagkdgjlavonbmjdu`.
