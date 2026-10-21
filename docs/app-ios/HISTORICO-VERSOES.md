# Control ALL iOS: histórico de versões

Como funciona a numeração:

- **Versão** (ex.: `1.1.0`): fica no arquivo `ios/VERSAO`. Sobe a cada pacote de mudanças.
  - 3º número (`1.1.x`): correções pequenas.
  - 2º número (`1.x.0`): recursos novos.
  - 1º número (`x.0.0`): mudança grande (ex.: publicação na App Store).
- **Build** (ex.: `17`): número da execução do GitHub Actions. Sobe sozinho a cada envio ao TestFlight.
- **Notas da versão**: o texto de `fastlane/notas-da-versao.txt` aparece no TestFlight, em "O que testar".
- **Dentro do app**: a versão e o build aparecem no rodapé do Menu.

Para lançar uma versão nova: atualizar `ios/VERSAO`, reescrever `fastlane/notas-da-versao.txt`,
registrar aqui embaixo e enviar para a branch `ios-app` (o GitHub Actions compila e envia ao TestFlight).
Mudanças de site (pasta `src/`) só chegam ao app depois do merge em `main` (deploy da Vercel),
porque o app carrega o site de produção.

## 1.2.0 (build 18 em diante): login, notificações, ajustes e acabamento
- Abertura animada do logo (continua a tela de abertura do iOS e sai com zoom quando a página carrega).
- Login travado como tela de app (sem rolar, sem cabeçalho do site), sugestões de e-mail tocáveis,
  olho para mostrar a senha, senha nas Senhas do iPhone (Associated Domains + apple-app-site-association).
- Login social pela janela do iOS (ASWebAuthenticationSession, retorno controlall://auth-callback).
- Notificações locais na tela de bloqueio (faturas, contas, garantias) e botão de teste.
- Agenda do iPhone automática depois de vinculada; botão só aparece se ainda não vinculou.
- Tela Ajustes do app; idioma padrão português e seletor só nos Ajustes (no site continua no topo).
- No app a visão é sempre de usuário; admin completo só no navegador.
- Home: widgets reordenados arrastando (@dnd-kit).
- Assistente da Home: dados extras não contam mais no limite de 500 caracteres da pergunta.
- Convite de amigos e aviso de cookies: dispensou, não volta; o admin pode redisparar (Administração).
- Transição de voltar entrando pela esquerda; menu e aviso de cookies respeitam a barrinha de início.

## 1.1.0 (build 17): agenda e controle de versões
- Sincronizar com a agenda do iPhone: calendário "Control ALL" com vencimentos de faturas em aberto
  e fim de garantias dos próximos 12 meses, lembrete na véspera às 9h. Sincronizar de novo atualiza
  e remove o que foi pago.
- Versão e build visíveis no Menu do app.
- Notas da versão no TestFlight ("O que testar").

## 1.0 (build 16), 21/10/2026: cara de app nativo, parte 2
- Primeira abertura pede câmera e microfone, com explicação.
- Teclado: a tela encolhe acima dele (sem pular) e a barra de baixo some.
- Telas de lançamento em tela cheia, com botão fechar de 44 px. *(site, PR #2)*
- Barra de baixo no estilo iOS, colada no rodapé; botão + em coluna própria no centro. *(site, PR #2)*

## 1.0 (build 15), 21/10/2026: ícone novo
- Ícone redesenhado em alta resolução (1024 px) e tela de abertura nova.

## 1.0 (build 14), 21/10/2026: cara de app nativo, parte 1
- Faixa sólida atrás da Dynamic Island, gesto de voltar deslizando, puxar para atualizar.
- Textos de permissão de câmera, microfone e fotos (antes o microfone dava erro).
- Downloads e "Baixar imagem" pela folha de compartilhar do iOS.
- Nome curto "Control ALL", só retrato no iPhone, abre direto no Início.
- Lista de despesas e receitas compacta, cabeçalho único, sem cartão "Em breve". *(site, PR #1)*

## 1.0 (build 13), 21/10/2026: área segura
- Conteúdo respeita a barra de status; sem prévia de links ao segurar.

## 1.0 (build 12), 20/10/2026: primeira versão no TestFlight
- App iOS (Capacitor) carregando o site www.controlall.com.br.
- Compilação e envio automáticos pelo GitHub Actions (fastlane), sem Mac.
