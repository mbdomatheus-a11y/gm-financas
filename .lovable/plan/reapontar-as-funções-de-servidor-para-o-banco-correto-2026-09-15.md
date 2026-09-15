# Reapontar as funções de servidor para o banco correto

## Conclusão antes da execução

- **Não vou executar `rebind_secrets` agora.** Neste projeto, essa ação recuperaria a configuração canônica do Lovable Cloud atualmente vinculado — o banco antigo — e não escolheria livremente o projeto novo.
- **Não há uma tela de autoatendimento documentada para trocar o banco de um projeto que já usa Lovable Cloud.** Alterar somente `.env` também não resolve, porque as variáveis reservadas do servidor e a credencial administrativa são geridas pela plataforma.
- **Não remover/desativar o Lovable Cloud.** Isso não reaponta este projeto para o banco novo e pode colocar dados em risco.
- Portanto, o caminho seguro é pedir ao suporte da Lovable uma **correção interna do vínculo do backend**, preservando integralmente o projeto novo e deixando o antigo desconectado.

## Ação manual do proprietário

1. Abra **https://lovable.dev/support**.
2. Clique em **Contact us**.
3. Selecione este projeto no formulário.
4. Informe que o navegador está autenticando no projeto novo, mas as variáveis reservadas de servidor `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` continuam vinculadas ao backend antigo.
5. Peça explicitamente para **reapontar/revincular o backend gerenciado e as variáveis reservadas do servidor ao projeto novo**, sem excluir, restaurar, migrar ou resetar dados em nenhum dos dois bancos.
6. Inclua no chamado os dois identificadores de projeto e deixe claro qual é o **destino novo** e qual é o **antigo a desconectar**. Não envie chaves privadas nem senhas.
7. Peça confirmação de que a credencial administrativa do projeto novo também será vinculada; copiar apenas URL e chave pública não basta para as funções administrativas.

Se a conta for Enterprise, o mesmo chamado pode ser aberto pelo botão **+** ao lado da conversa → **Help & support** → **Contact support**.

## Validação depois da confirmação do suporte

1. Executar a ação segura de atualização das variáveis gerenciadas do projeto.
2. Reiniciar o ambiente de prévia para carregar o vínculo atualizado.
3. Confirmar que uma função autenticada simples reconhece o usuário atual.
4. Testar com usuário comum e administrador: criar convite e iniciar conexão com Google Drive.
5. Confirmar que dashboard, receitas, despesas, veículos e demais dados continuam vindo do projeto novo.
6. Não alterar schema, não migrar registros e não apagar dados durante essa validação.

## Critério de conclusão

- Chamadas autenticadas deixam de retornar `Unauthorized: Invalid token`.
- Funções administrativas e comuns usam o mesmo projeto que o navegador.
- Nenhum dado do projeto novo é removido ou recriado.
- O banco antigo fica apenas desconectado, sem migração.
