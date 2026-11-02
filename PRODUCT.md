# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

O site (este repositório) é web. O mesmo produto existe como app nativo em Expo (iPhone e Android) em `C:\Users\Usúario\Desktop\controlall`, com espelhamento total obrigatório: toda tela, botão, texto e comportamento existe nas três plataformas na mesma entrega (ver CLAUDE.md).

## Users

Famílias e casais que organizam o dinheiro da casa juntos, num grupo compartilhado. Usam no dia a dia para lançar gastos, acompanhar o mês, montar a lista de compras e guardar notas fiscais. 74% do acesso é pelo celular.

## Product Purpose

Control ALL reúne num só lugar a vida financeira e doméstica do grupo: despesas e receitas, cartões e bancos, previsão do mês, lista de compras, notas fiscais, notas e ferramentas. Sucesso é o grupo lançar o primeiro gasto rápido (meta de 30 segundos), voltar com hábito e entender o saldo previsto do mês sem esforço.

## Positioning

- **Tudo num lugar só:** finanças, compras, notas fiscais, notas e ferramentas no mesmo app, em vez de vários apps soltos.
- **Feito para o grupo:** os dados são do grupo, com permissões por pessoa e módulo, categorias e regras de-para do próprio grupo, e ciclo do mês com dia de virada próprio.

## Operating Context

- Uso principal no celular, em momentos curtos (depois de uma compra, no mercado, conferindo a fatura).
- Open Finance via Pluggy importa movimentos e categoriza automaticamente (de-para do grupo, depois categoria da Pluggy, depois marcas). Hoje restrito ao admin principal.
- ControlIA: assistente que resume o mês e responde sobre a previsão.
- Login por e-mail, Google, Microsoft e Apple. Avisos, resumo semanal por e-mail e push no celular.
- Site na Vercel, dados no Supabase com isolamento por grupo (RLS).

## Capabilities and Constraints

- Espelhamento total site, iPhone e Android (exceção parcial: módulos de administração).
- Antes de entregar, conferir: barra de baixo, Início, Menu/Mais, Configurações, Minha conta e foto, avisos, ControlIA, login.
- Termos do produto: grupo, ciclo/dia de virada, previsão do mês, economia conquistada (fica fora dos totais), de-para, Open Finance (bancos).
- Dados financeiros sensíveis: nada de chave privada no cliente; testar isolamento por grupo com duas contas.

## Brand Commitments

- Nome: **Control ALL**; assistente: **ControlIA**.
- Idioma: português brasileiro, linguagem simples, sem jargão financeiro, sem travessão.
- Logos oficiais dos bancos (tabela `bancos_logos`) aparecem em Cartões e Bancos e Despesas.

## Evidence on Hand

- Uso real: 16 usuários reais em 31/10/2026, 4 ativados; maior perda foi gente tentando entrar com e-mail não cadastrado.
- Pesquisa por tela "Está gostando desta tela?" (tabela `avaliacoes_tela`).
- Catálogo de 153 logos de bancos.
- Não há depoimentos, clientes de referência, imprensa ou preços publicados: não inventar.

## Product Principles

1. O grupo vem primeiro: tudo é compartilhado e respeita permissões.
2. Lançar tem que ser imediato: o "+" sempre lança, primeiro gasto em 30 segundos.
3. Uma coisa só, igual em todo lugar: site, iPhone e Android se comportam igual.
4. Clareza antes de detalhe: saldo e previsão do mês entendidos de relance, sem termos técnicos.

## Accessibility & Inclusion

WCAG AA como base. Mobile primeiro (74% do acesso é pelo celular), alvos de toque grandes e linguagem simples, sem jargão financeiro.
