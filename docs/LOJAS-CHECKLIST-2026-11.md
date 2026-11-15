# Fechamento para as lojas (bloco 7 da revisão final)

Levantado em 15/11/2026 lendo o código do app (controlall) e do site. Complementa `controlall/docs/play-store/ANDROID-PLAY.md`.

## Conferido no código (ok)
- Identificação: iOS `com.matheus.controlall` (build 21), Android `com.matheus.controlall` (versionCode 8), versão 1.0.0.
- Textos de permissão em português: câmera, microfone, fotos e Face ID. Android só com câmera, microfone, biometria e notificações; armazenamento e mídia bloqueados.
- Criptografia: `ITSAppUsesNonExemptEncryption` declarado.
- Entrar com a Apple ligado (exigido pela Apple quando há login social).
- Excluir conta dentro do app (Minha conta) e pelo site. Termos e Privacidade acessíveis no app.
- Senha salva: `webcredentials:www.controlall.com.br` no app.
- iPad: `supportsTablet` ligado, orientação livre.
- Android: menus e perguntas com alternativa própria (ActionSheetIOS e Alert.prompt não existem lá); ícones traduzidos para Material.
- Leitor de tela: varredura de botões só com ícone. App: 6 sem rótulo, corrigidos em 15/11 (documentos do veículo, enviar no ControlIA, subir e descer cartão do Início). Site: 6 sem rótulo, corrigidos (lixeiras de De-para e Importar, remover anexo no Suporte).

## Não conferido (precisa de aparelho)
- VoiceOver e TalkBack percorrendo as telas principais.
- iPad em paisagem e em tela dividida.
- Android com fonte grande do sistema e com gesto de voltar.
- Modo escuro em todas as telas.

## Só o Matheus faz (consoles)
App Store Connect:
1. Privacidade do app: mesmas respostas da seção "Segurança dos dados" do ANDROID-PLAY.md (contato, identificadores, informações financeiras, fotos, áudio; vinculados à conta; sem rastreamento; sem anúncios).
2. Conta de demonstração para a revisão: usar uma das contas de teste, resetada antes (Administração > Usuários > Contas de teste), sem 2FA.
3. Notas para o revisor: explicar que Open Finance só aparece para a administração e que a IA usa texto e áudio enviados pelo usuário.
4. Classificação etária, categoria Finanças, URL de suporte e de privacidade.
5. Capturas: iPhone 6,9" e iPad 13".
Google Play:
1. Itens 2 e 4 do ANDROID-PLAY.md (ficha, segurança dos dados, exclusão de conta, público 18+).
2. Teste fechado com 12 testadores por 14 dias antes de pedir produção (regra do Google para conta pessoal nova). É o item de maior prazo: começar já.

## Decisões pendentes antes do envio
- Cadastro: já é nativo no app desde 03/11 (a informação anterior deste documento estava desatualizada). Em 15/11, por decisão do Matheus de nada passar pelo site, "Esqueci minha senha" e a troca do e-mail de acesso também ficaram dentro do app, com código por e-mail. Falta publicar as Edge Functions `recuperar-senha` e `trocar-email` e rodar `docs/sql/2026-11-15-recuperar-senha-por-codigo.sql`.
- Ainda dependem do site no app: importar .xlsx no De-para, leitura automática de PDF ou imagem em Exames e Pets, link temporário, e a administração (usuários e alertas do sistema).
- Cobrança: a home mostra plano pago. Se houver assinatura dentro do app, a Apple e o Google exigem compra pelo sistema deles. Se o lançamento for gratuito, tirar do app qualquer menção a preço.
- Idiomas no app, OCR e "compartilhar como imagem" seguem fora (ver `controlall/docs/GAP-SITE-APP.md`).

## Segurança (auditoria de 01/11) que vale fechar antes
- Item 7: SQL pronto em `docs/sql/2026-11-15-auditoria-item-7.sql`.
- Itens 4 e 6: publicar `calendario-ics` com segredo próprio e `login-seguro` com o bloqueio por IP.
- Item 3: decidir o destino das 38 tabelas de backup no schema public.
- Item 2: proteção de senha vazada exige o plano Pro do Supabase.

## Textos da loja (rascunho)
- Nome: Control ALL
- Subtítulo (30): Quanto sobra no fim do mês
- Descrição curta (80): Fale um gasto e a IA lança. Faturas, parcelas e notas fiscais num lugar só.
- Descrição: Saiba quanto vai sobrar no fim do mês, sem planilha. Fale ou digite um gasto e a IA lança e classifica. Importe a fatura do cartão em PDF e veja quando cada parcela acaba. Guarde notas fiscais e acompanhe garantias. Crie caixinhas e limites de gastos, com aviso antes de estourar. Use sozinho ou com a família, no celular e no computador.
- Palavras-chave (iOS): finanças,gastos,orçamento,fatura,cartão,parcelas,nota fiscal,garantia,despesas,controle
