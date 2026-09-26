# Continuidades do Projeto & Documentação de Funcionalidades

> 📌 **DOCUMENTAÇÃO OFICIAL ATUALIZADA (2026-09-26)**:
> - **Histórico e Módulos Implementados**: [`docs/WALKTHROUGH.md`](WALKTHROUGH.md)
> - **Pendências Técnicas e Guia de Continuidade**: [`docs/PENDENCIAS.md`](PENDENCIAS.md)

## Status das Implementações

### 1. Importação Inteligente de Faturas PDF
- **Resolução de Cartão/Conta Destino**: Associa automaticamente o cartão com base no final detectado. Caso não exista, exibe a opção *"Não cadastrado"* com link/botão para cadastro rápido diretamente na tela de importação.
- **Data de Vencimento**: Extração inteligente da data de vencimento em múltiplos formatos (incluindo meses por extenso como `15 SET 2026`).
- **Total da Fatura**: Leitura precisa do valor total da fatura para os bancos Santander, Nubank, Itaú e Pernambucanas.
- **Finais Detectados**: Identificação de todos os cartões e adicionais/dependentes presentes no PDF.
- **Limites Editáveis**: Campos de *Limite Total*, *Limite Utilizado* e *Limite Disponível* convertidos em inputs editáveis para ajustes pelo usuário.
- **Extrato Completo**: Leitura detalhada dos itens, parcelas (`03/12`, `10/12`, `PARC.9/10`) e valores.
- **Detecção de Duplicidade**: Algoritmo `duplicidade.ts` que alerta sobre possíveis itens duplicados já existentes no sistema (`Possível duplicata`).
- **Ajuste de Categoria & De-Para**: Botão *"Salvar como regra"* otimizado para formato de ícone (`BookmarkPlus`/`BookmarkMinus`), garantindo largura total do campo de Categoria.
- **Solicitações de Análise de Layout**: Modal *"Faturas enviadas"* para o usuário visualizar o status das análises enviadas e painel administrativo `/administracao` completo.

### 2. Pesquisa de Valores e Formatação
- **Pesquisa por Valor (pt-BR)**: Suporte a busca por valores com vírgula e milhar (ex: `3.259,25` ou `259,25`) nas telas de Despesas e Receitas.
- **Cálculo de Parcelamento Retroativo**: Parcelas importadas ou criadas (ex: `4/10` de uma despesa) ajustam automaticamente a data de início para meses anteriores sem causar crash no sistema.

### 3. Fatura do Mês & Visão Geral
- **Lançamento de Fatura Única**: Opção para considerar apenas o total do mês e ignorar lançamentos individuais na visão geral com marcação tachada no histórico e suporte a exclusão confirmada.

---

## Testes e Validação
- **Testes Unitários**: Executados via Vitest (`npm run test`) com 100% de sucesso em `recorrencia.test.ts`.
- **Compilação TypeScript**: `npx tsc --noEmit` sem qualquer erro de tipagem.
- **Build de Produção**: `npm run build` gerado com sucesso.
