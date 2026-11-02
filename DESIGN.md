---
name: Control ALL
description: Finanças, compras e notas da casa, num painel sereno feito para o grupo.
colors:
  brand: "oklch(0.55 0.15 240)"
  brand-strong: "oklch(0.46 0.16 245)"
  background: "oklch(0.984 0.005 250)"
  foreground: "oklch(0.22 0.03 255)"
  card: "oklch(1 0 0)"
  secondary: "oklch(0.955 0.008 250)"
  muted: "oklch(0.958 0.006 250)"
  muted-foreground: "oklch(0.52 0.02 255)"
  accent: "oklch(0.945 0.02 250)"
  border: "oklch(0.91 0.008 250)"
  destructive: "oklch(0.58 0.21 25)"
  success: "oklch(0.6 0.14 155)"
  warning: "oklch(0.78 0.15 80)"
  warning-foreground: "oklch(0.25 0.05 80)"
  chart-2: "oklch(0.65 0.15 165)"
  chart-3: "oklch(0.72 0.15 60)"
  chart-4: "oklch(0.6 0.2 320)"
  chart-5: "oklch(0.62 0.19 20)"
  dark-background: "oklch(0.19 0.02 258)"
  dark-card: "oklch(0.235 0.022 258)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "12px"
  md: "14px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "28px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.background}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
    height: "36px"
  button-primary-large:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.background}"
    rounded: "{rounded.xl}"
    padding: "0 32px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.background}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  bottom-bar:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.2xl}"
    height: "64px"
  bottom-bar-plus:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    size: "56px"
---

# Design System: Control ALL

## Overview

**Creative North Star: "O Painel Sereno"**

O Control ALL é o lugar onde a família olha para o dinheiro sem ansiedade. A tela é clara e calma: fundo quase branco tingido de azul, duas luzes suaves da cor da marca no topo (o fundo "aurora"), cartões brancos com sombra difusa e números com algarismos tabulares para que valores se alinhem e se leiam de relance. Nada grita; a cor da marca aparece onde há ação, não como decoração.

É acolhedor e pessoal porque é da casa: o grupo escolhe tema claro ou escuro, uma de 14 paletas de marca e a fonte (Plus Jakarta Sans por padrão). O sistema é construído para que tudo derive de `--brand`, então qualquer paleta escolhida continua coerente. A densidade é de app de uso diário no celular: blocos grandes, alvos de toque generosos, barra de baixo fixa com o "+" no centro.

Os componentes são limpos e contidos: a forma macia e arredondada fica, sem brilho, halo ou gradiente. O botão principal é uma superfície chapada na cor da marca, igual no site e no app.

**Key Characteristics:**
- Neutros frios em OKLCH (matiz 250 a 258) com uma única cor de marca trocável.
- Cantos bem arredondados (base de 16px) em tudo, de botão a barra de navegação.
- Profundidade por sombras difusas e azuladas, nunca pretas e duras.
- Algarismos tabulares em todo o texto, para valores alinhados.
- Mobile primeiro: barra de baixo flutuante no site, encostada no app nativo.

## Colors

Uma marca azul serena sobre neutros frios quase brancos, com verde, âmbar e vermelho reservados para significado.

### Primary
- **Azul Sereno** (brand): a cor de ação. Botão principal, "+" central, item ativo da barra de baixo, anel de foco, primeira série dos gráficos, etiquetas de seção. É o token que as 14 paletas da Personalização substituem, além da padrão (azul, verde, roxo, laranja, rosa, grafite, turquesa, índigo, vinho, ouro, menta, coral, lavanda, oceano).
- **Azul Profundo** (brand-strong): par escuro da marca que cada paleta define. Hoje fica reservado; nenhum componente usa gradiente.

### Secondary
- **Verde Hortelã** (chart-2): segunda série dos gráficos e a segunda luz do fundo aurora, no canto superior direito.

### Neutral
- **Névoa Clara** (background): fundo de todas as telas no tema claro.
- **Papel Branco** (card): cartões, popovers, folhas.
- **Grafite Azulado** (foreground): texto principal.
- **Cinza Ardósia** (muted-foreground): texto de apoio, descrições, itens inativos da barra.
- **Bruma** (secondary, muted, accent): fundos de botão secundário, hover de ghost e outline, áreas de apoio.
- **Linha Fria** (border): bordas de cartão, input e divisores.
- **Noite Azulada** (dark-background) e **Ardósia Noturna** (dark-card): fundo e cartão do tema escuro.

### Semantic
- **Vermelho Alerta** (destructive): excluir, erro, valor negativo.
- **Verde Saldo** (success): confirmação, valor positivo.
- **Âmbar Aviso** (warning, com warning-foreground escuro): avisos e pendências.
- **Âmbar, Magenta e Coral** (chart-3, chart-4, chart-5): demais séries dos gráficos.

### Named Rules
**The Brand Derivation Rule.** Toda cor de destaque nova deriva de `--brand` ou `--brand-strong` (direto ou via `color-mix`). Nunca fixar um azul literal: a família pode ter escolhido rosa.

**The Meaning Colors Rule.** Verde, âmbar e vermelho só significam saldo, aviso e erro. Nunca usá-los como enfeite.

## Typography

**Display Font:** Plus Jakarta Sans (com ui-sans-serif, system-ui)
**Body Font:** Plus Jakarta Sans (o usuário pode trocar por Inter, Nunito ou Roboto)

**Character:** Uma sans geométrica e amigável, firme nos títulos (700 e 800) e neutra no texto. Algarismos tabulares (`tnum`) ligados globalmente para que valores em colunas se alinhem.

### Hierarchy
- **Display** (800, 2.25rem, 1.1): número ou título de destaque em telas de abertura e login.
- **Headline** (700, 1.5rem, 1.25): título de página.
- **Title** (700, 1.25rem, 1.3): título de seção e de cartão importante; é o tamanho mais usado.
- **Body** (400, 0.875rem, 1.5): texto de interface. Em input, 1rem no celular para o iPhone não dar zoom.
- **Label** (500, 10px): nomes dos itens da barra de baixo.

### Named Rules
**The Tabular Money Rule.** Todo valor em reais usa algarismos tabulares; não desligar `tnum` em tabelas, totais ou listas.

**The Bare Heading Rule.** Título não leva etiqueta, número de seção nem gradiente acima ou dentro dele; destaque é peso, tamanho ou a cor da marca chapada.

**The Tight Heading Rule.** h1, h2 e h3 usam tracking de -0.02em e `text-wrap: balance`.

## Layout

Mobile primeiro. No celular, o conteúdo ocupa a largura toda com a barra de baixo flutuante (8px das laterais, acima da área segura, 64px de altura, 5 colunas: Início, Notas, "+", Lista, Menu). No app nativo a barra encosta na borda, perde o arredondado e ganha vidro. No desktop (`lg`) a barra some e a navegação vai para a barra lateral.

O ritmo segue a escala do Tailwind em passos de 4px: 8px entre elementos próximos, 16px entre blocos, 24px de respiro interno de cartão. Palavras e valores longos quebram em vez de empurrar a largura da tela.

## Elevation & Depth

Sistema híbrido: superfícies tonais (névoa, branco, bruma) mais sombras difusas e frias, com tinta azulada (`oklch(0.2 0.03 250)`) em vez de preto. Vidro (`glass`: fundo 72% com blur de 14px) só em cabeçalhos e barras flutuantes.

### Shadow Vocabulary
- **Card** (`0 1px 2px oklch(0.2 0.03 250 / 0.04), 0 6px 18px -6px oklch(0.2 0.03 250 / 0.10)`): repouso de todo cartão.
- **Soft** (`0 1px 2px oklch(0.2 0.03 250 / 0.05), 0 12px 32px -8px oklch(0.2 0.03 250 / 0.14)`): hover de blocos clicáveis (`lift`, que também sobe 2px).

### Named Rules
**The Cool Shadow Rule.** Sombras são sempre azuladas e difusas. Nenhuma sombra preta, dura ou com deslocamento grande.

**The No Glow Rule.** Nenhum componente tem brilho colorido ou halo. A marca aparece pela cor chapada, não por luz em volta.

## Shapes

Forma macia e consistente a partir de um raio base de 16px: input e etiqueta 14px, botão 20px, cartão e barra de baixo 24px, botão "+" e avatares totalmente redondos. Bordas finas de 1px na Linha Fria, a 70% de opacidade nos cartões.

## Components

### Buttons
Macios e firmes, com leve aperto ao toque.
- **Shape:** cantos arredondados (20px); pequeno 16px.
- **Primary:** Azul Sereno chapado, texto claro, sombra pequena, 36px de altura (44px no grande). No hover a marca fica a 90% (clareia um pouco no tema claro, recua no escuro), sem mudar a cor do texto.
- **Press / Focus:** escala 0.98 ao apertar; anel de 2px na cor da marca a 50%.
- **Outline:** borda de input, fundo 80%, hover com borda da marca a 40% e fundo Bruma.
- **Secondary / Ghost / Link / Destructive:** Bruma; transparente com hover Bruma; texto da marca sublinhado no hover; Vermelho Alerta.

### Chips (Badges)
- **Style:** cantos 14px, 12px semibold, preenchido na marca, Bruma, vermelho ou só com contorno.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** Papel Branco (Ardósia Noturna no escuro).
- **Shadow Strategy:** sombra Card em repouso; `lift` para cartões clicáveis.
- **Border:** 1px Linha Fria a 70%.
- **Internal Padding:** 24px.

### Inputs / Fields
- **Style:** 1px Linha Fria, fundo transparente, 14px de canto, 36px de altura, 16px de texto no celular.
- **Focus:** anel de 1px na cor da marca.
- **Error / Disabled:** opacidade 50% quando desabilitado; senha com botão de mostrar (input-senha).

### Navigation
- **Barra de baixo:** fundo da tela, borda e sombra grande, 24px de canto, flutuando; ícones 20px com rótulo 10px; ativo na cor da marca, inativo Cinza Ardósia. Some com o teclado aberto no app.
- **Botão "+" central:** círculo de 56px na cor da marca, sobe 32px acima da barra com anel de 4px da cor do fundo; no app nativo fica com 48px e alinhado.
- **Desktop:** barra lateral com fundo Névoa, item ativo em Bruma.

### Brand Mark
Logo em quadrado de canto 0.8rem sobre azul claro, com uma faixa de luz que atravessa devagar (7s). Com movimento reduzido, a luz fica parada e mais fraca.

## Do's and Don'ts

### Do:
- **Do** derivar todo destaque de `--brand` e `--brand-strong` para funcionar nas 14 paletas e no tema escuro.
- **Do** manter algarismos tabulares em valores e o raio base de 16px.
- **Do** usar sombras frias e difusas (Card em repouso, Soft no hover) e `lift` só em blocos clicáveis.
- **Do** garantir alvos de toque grandes e texto de input com 16px no celular.
- **Do** respeitar `prefers-reduced-motion` em toda animação nova, como já fazem a marca e as transições de tela.
- **Do** espelhar qualquer mudança visual no app iOS e Android.

### Don't:
- **Don't** usar glow, halo pulsante ou gradiente em botões, ícones, títulos e componentes: eles são limpos e contidos. Destaque em título é a cor da marca chapada.
- **Don't** colocar etiqueta em caixa alta ("eyebrow") nem numeração de seção acima de títulos: o título fala sozinho.
- **Don't** fixar cores literais de marca (um azul em hex) no lugar dos tokens.
- **Don't** usar verde, âmbar ou vermelho como decoração.
- **Don't** usar sombras pretas ou duras, nem cantos retos em cartões e botões.
- **Don't** usar travessão em textos de interface.
