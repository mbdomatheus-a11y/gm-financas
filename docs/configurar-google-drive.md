# Conexão do Google Drive por usuário

O botão em Notas fiscais usa OAuth diretamente com o Google. Cada usuário autoriza a própria conta. O aplicativo solicita somente `drive.file`, suficiente para criar sua pasta de comprovantes e enviar arquivos criados por ele. O token de atualização fica criptografado no servidor, na tabela `app_user_connections`, nunca no navegador ou no GitHub. Desconectar tenta revogar o acesso no Google e remove a conexão local. Conexões anteriores feitas pelo serviço do Lovable não são migradas; cada usuário precisará autorizar novamente.

## Ativação pelo proprietário

1. No Google Cloud, crie ou escolha um projeto, ative a Google Drive API e configure a tela de consentimento OAuth.
2. Crie um cliente OAuth do tipo **Aplicativo da Web**. Cadastre como URI de redirecionamento autorizada exatamente `https://SEU-DOMINIO/oauth/google-drive/return`, usando o endereço oficial em que o usuário acessa o site. Não use URL de prévia do Lovable.
3. Configure somente no ambiente de servidor da hospedagem: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` com a URI exata do passo anterior, `APP_USER_CONNECTION_KEY_SECRET` (32 bytes em base64, estável entre deploys) e `SUPABASE_SERVICE_ROLE_KEY`. Nunca use prefixo `VITE_` nesses segredos, nem os coloque no repositório ou no chat.
4. Faça novo deploy e teste com uma conta autorizada: conectar, aceitar no Google, salvar uma nota com foto, verificar a pasta `Finanças do Casal/Notas fiscais` na conta Google escolhida e desconectar. Depois repita com uma segunda conta do site e outra conta Google para verificar o isolamento.

Enquanto o aplicativo OAuth do Google estiver em modo de teste, somente usuários incluídos como testadores conseguirão conectar. Para liberar ao público, conclua as exigências atuais de publicação do Google, inclusive domínio, página pública e política de privacidade quando exigidas. O aviso de privacidade do Control All ainda está em rascunho por falta do canal de contato da controladora; portanto, **não anunciar a conexão como disponível a todos antes dessa etapa**.

Se as variáveis não estiverem configuradas, o site mostra uma mensagem compreensível em vez de erro técnico. O link manual de pasta continua sendo uma opção separada; por segurança, o envio automático não usa uma pasta colada por URL, pois o escopo `drive.file` não garante acesso a pastas arbitrárias de terceiros.

Referências oficiais: [OAuth para aplicativos web](https://developers.google.com/identity/protocols/oauth2/web-server), [escopos do Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [criação de arquivos](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create).
