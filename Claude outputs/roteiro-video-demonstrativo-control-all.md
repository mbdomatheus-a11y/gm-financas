# Roteiro — Vídeo demonstrativo do Control ALL (3–5 min, até 100MB)

Prompt/roteiro para gravação de tela real do site (não vídeo gerado por IA).
Feito para divulgação externa (redes sociais, WhatsApp, apresentações),
mas o arquivo final também pode ser subido depois em Administração →
Personalização (campo de vídeo de demonstração, aparece na home pública em
`#demonstracao`).

---

## 1. Especificações técnicas (para caber em ~100MB)

- **Duração alvo**: 3:30 a 4:30 min. Cada minuto a mais custa muito espaço —
  prefira cortar cena a espremer bitrate.
- **Resolução de gravação**: 1920×1080 (Full HD). Não precisa de 4K — arquivo
  fica gigante à toa e o WhatsApp/redes recomprimem de qualquer jeito.
- **Taxa de quadros**: 30fps é suficiente (interface de site não precisa de 60fps).
- **Formato de exportação**: MP4, codec H.264, áudio AAC.
- **Bitrate de vídeo alvo**: ~2.800–3.200 kbps de vídeo + ~128 kbps de áudio.
  Isso dá, para 4 minutos: (2.900 + 128) kbps × 240s / 8 = ~90MB — com folga
  dentro do limite de 100MB. Ferramentas de edição (CapCut, DaVinci Resolve,
  Premiere, Clipchamp) permitem digitar bitrate-alvo ou "tamanho de arquivo
  alvo" direto na exportação — prefira usar essa opção e apontar 95MB, com o
  próprio programa calculando o bitrate.
- **Zoom do navegador durante a gravação**: 100% (não reduza a página para
  "caber mais coisa" — fica ilegível no vídeo final, principalmente em
  celular).
- **Cursor**: mantenha visível e com destaque (a maioria das gravadoras de
  tela tem opção de "highlight de clique" — ative, ajuda muito a acompanhar).

## 2. Ferramenta de gravação sugerida

Qualquer uma serve, mas para facilitar cortes e ficar leve:
- **OBS Studio** (gratuito, grava local, ótimo controle de bitrate) — recomendado.
- Alternativas: ScreenPal, Loom (plano gratuito tem limite de tempo), ShareX (Windows).

Grave em blocos curtos por cena (ver seção 4) em vez de um take único de 4
minutos — é muito mais fácil regravar só a cena que errou.

## 3. Preparação do conteúdo ANTES de gravar (importante)

O vídeo mostra dados reais do seu uso — revise antes:

1. **Popule com dados de exemplo bons**: tenha ao menos 5–6 lançamentos de
   receita/despesa no mês atual, 2–3 categorias diferentes, um cartão
   cadastrado, para o Dashboard não aparecer vazio ou pobre.
2. **Nota fiscal de exemplo**: tenha pelo menos uma nota fiscal com foto/PDF
   já enviada (pode ser uma de teste, mas com nome de produto real tipo
   "Liquidificador Philips" em vez de "teste123") para mostrar a prévia da
   imagem funcionando (a que acabamos de corrigir).
3. **Lista de compras**: 3–4 itens, pelo menos um com link de referência.
4. **Módulo Pet ou Onde está?**: se usar, tenha 1–2 registros de exemplo com
   nome real (ex.: nome do pet de verdade, ou um item real guardado em algum
   lugar da casa).
5. **Oculte valores sensíveis se preferir**: o site tem um toggle de
   "ocultar valores" (ícone de olho, usado em várias telas) — se não quiser
   mostrar números reais de dinheiro, ative antes de gravar essas partes, ou
   troque temporariamente os valores por números redondos fictícios.
6. **Feche notificações/toasts irrelevantes** e качели do navegador (extensões,
   abas de trabalho, barra de favoritos) antes de começar — no OBS, capture
   só a janela/aba do Chrome, não a tela inteira.
7. **Modo claro ou escuro**: escolha um e mantenha consistente do início ao
   fim (o site tem os dois — ver Personalização).

## 4. Roteiro cena a cena

Tempos são um guia, não trave a edição neles — o importante é a ordem e o
que cada cena precisa mostrar. Fale com naturalidade, como se estivesse
mostrando para um amigo, não lendo script robótico.

### CENA 1 — Abertura / landing pública (0:00–0:25)

Abra `https://www.controlall.com.br/` deslogado.

- Mostre o topo da página (o header fixo com o logo e menu).
- Deixe a headline aparecer: **"A vida da sua família organizada em um só lugar."**
- Narração sugerida:
  > "Você lida com contas, notas fiscais, remédio do pet, exame médico, e cada coisa fica espalhada num app diferente. O Control ALL junta tudo isso num lugar só, com privacidade e sem depender de planilha."
- Role devagar até a seção "RECURSOS" (privacidade, importe e confira, não deixe passar) — 3-4 segundos parado ali, sem precisar ler tudo em voz alta.

### CENA 2 — Visão geral dos módulos na landing (0:25–0:50)

Role até a seção "MÓDULOS" (cards: Finanças, Lista de Compras, Notas
fiscais, Pet, Onde está?, Exames).

- Narração sugerida:
  > "São seis áreas da vida cobertas: finanças, lista de compras, notas fiscais com garantia, cuidados do pet, onde cada coisa está guardada em casa, e até exames médicos, com privacidade total."
- Pode clicar em "Ver detalhes" de 1 ou 2 cards pra mostrar que expande (não precisa abrir todos).

### CENA 3 — Login (0:50–1:00)

Clique em "Entrar" (ou "Começar agora").

- Mostre rapidamente a tela de login (CPF + senha) — não precisa narrar o
  processo de digitar senha em detalhe, corte direto (na edição) do clique
  no botão até já estar logado em `/inicio`, ou grave o login normal e
  acelere esse trecho 2x na edição.

### CENA 4 — Início (o hub) (1:00–1:30)

Tela `/inicio`, já logado.

- Narração sugerida:
  > "Essa é a tela inicial: os módulos que você usa, um resumo do mês, alertas de garantia vencendo, e a visão de quanto da sua renda já foi comprometida esse mês."
- Aponte (com o cursor) para: os cards de atalho, o gráfico de linha do
  tempo (VisaoGeralHome) na parte de baixo, e o badge de "% da renda
  comprometida" se estiver visível.

### CENA 5 — Módulo Finanças: Dashboard (1:30–2:10)

Vá em Finanças → Dashboard.

- Narração sugerida:
  > "No Dashboard financeiro você vê receitas e despesas do mês, o que é fixo e o que é variável, gasto por categoria, por cartão, por pessoa da casa — e a diferença entre o mês atual e a média dos últimos três meses."
- Mostre: o gráfico de pizza por categoria (clique em uma fatia pra mostrar
  o drill-down se der tempo), e o gráfico de barras empilhadas mensal.

### CENA 6 — Módulo Finanças: Despesas / Importar Faturas (2:10–2:40)

Vá em Despesas, mostre rapidamente uma despesa fixa parcelada, depois vá em
Importar Faturas.

- Narração sugerida:
  > "Você pode lançar manualmente, com parcelamento e reajuste automático, ou importar direto a fatura do cartão em PDF — o sistema lê e categoriza sozinho, você só confirma antes de salvar."
- Não precisa completar uma importação real na gravação — mostrar a tela de
  upload/preview já ilustra a ideia.

### CENA 7 — Notas fiscais (2:40–3:10)

Vá no módulo Notas.

- Narração sugerida:
  > "Cada nota fiscal fica guardada com foto ou PDF do comprovante, com data de compra e prazo de garantia — o sistema avisa quando a garantia está perto de vencer."
- Abra uma nota de exemplo com foto já anexada e mostre a prévia da imagem
  aparecendo (isso é importante mostrar funcionando).

### CENA 8 — Um módulo "de vida" (Pet OU Onde está?) (3:10–3:35)

Escolha o módulo mais preenchido/pronto entre os dois para essa cena única
(não precisa dos dois se o tempo estiver apertado).

Se for Pet:
> "Cada pet tem sua carteirinha digital: vacinas, vermífugo, histórico de saúde — com alerta antes da próxima dose vencer."

Se for Onde está?:
> "E pra nunca mais perder tempo procurando onde guardou aquele parafuso ou aquele documento: você cadastra local, cômodo e gaveta, e busca pelo nome do item depois."

### CENA 9 — Lista de compras (3:35–3:50, opcional se o tempo apertar)

- Narração sugerida:
  > "A lista de compras é compartilhada entre todo mundo de casa, com aprovação antes de marcar como comprado, e até link do produto que você quer comprar."

### CENA 10 — Fechamento / call to action (3:50–4:15)

Volte para a landing pública `/` (ou fique na última tela), role até a
seção de preço.

- Narração sugerida:
  > "Tudo isso com privacidade por padrão — os dados são só seus, compartilhados apenas com quem você escolher. O Control ALL já está disponível, com um plano simples e acessível. Vem organizar sua vida com a gente."
- Mostre o card de preço (R$ 4,99/mês) e o botão "Criar conta".
- Termine com a tela do logo/nome do produto por 1-2 segundos (bom para
  quem for cortar isso como thumbnail/encerramento).

## 5. Narração — dicas gerais

- Grave a narração junto com a tela (fala natural guiando o mouse) OU grave
  a tela muda e narre depois assistindo de volta — o segundo método costuma
  sair mais limpo porque você não erra a mão tentando falar e clicar ao
  mesmo tempo.
- Use um microfone externo ou fone com microfone se tiver — o microfone
  embutido do notebook capta muito ruído de ambiente.
- Fale um pouco mais devagar do que no dia a dia; ajuda a legibilidade em
  quem for assistir com som baixo/no trabalho.
- Considere adicionar legendas na edição (a maioria assiste vídeo de rede
  social sem som no início) — CapCut e Premiere geram automaticamente a
  partir do áudio, revise antes de publicar.

## 6. Checklist final antes de exportar

- [ ] Duração entre 3:30 e 4:30 min
- [ ] Sem dados sensíveis reais visíveis (CPF, valores que não queira mostrar, nome completo de terceiros sem autorização)
- [ ] Sem cursor "perdido" navegando sem propósito por mais de 2-3 segundos
- [ ] Áudio sem ruído de fundo, volume consistente do início ao fim
- [ ] Exportado como MP4 (H.264 + AAC), testado o tamanho final antes de enviar (ficar abaixo de 100MB com folga, ideal 85-95MB)
- [ ] Assistido uma vez inteiro antes de publicar/enviar
