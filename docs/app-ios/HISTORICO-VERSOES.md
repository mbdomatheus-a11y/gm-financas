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

## 1.1.0 (build 17 em diante): agenda e controle de versões
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
