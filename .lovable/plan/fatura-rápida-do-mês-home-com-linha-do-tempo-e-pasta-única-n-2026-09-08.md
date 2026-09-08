# Fatura rápida do mês, home com linha do tempo e pasta única no Drive

## 1. Lançar a fatura do mês em poucos segundos

Nova ação em destaque na home e no topo de Despesas: **"Fatura do mês"**.

O usuário escolhe o cartão, o mês e informa **o valor total da fatura**. Um seletor define como esse total é lido:

- **"Já inclui as parcelas"** — o app soma as parcelas já previstas para aquele cartão naquele mês, subtrai do total informado e cria um único lançamento **"Gastos do cartão — <mês>"** com a diferença. Se a diferença for negativa, avisa e sugere revisar.
- **"Não inclui as parcelas"** — o total informado vira o lançamento "Gastos do cartão" inteiro, somado por cima das parcelas já previstas.

Em ambos os casos aparece antes de salvar um resumo: parcelas previstas, valor avulso calculado e total final do mês para aquele cartão.

Parcelamentos continuam exatamente como hoje: uma vez lançados, seguem automaticamente nos meses seguintes até acabarem; a fatura rápida nunca os apaga nem os duplica.

## 2. Fechar a competência com a fatura real

Ao importar o PDF/planilha da fatura fechada de um cartão e mês:

- Os lançamentos estimados daquele cartão e mês (o "Gastos do cartão" e itens sem nota fiscal criados pela fatura rápida) são **substituídos** pelos itens reais da fatura.
- Parcelas de compras parceladas que já existiam são reaproveitadas quando casam com a fatura (mesma descrição/valor), para não duplicar.
- A competência fica marcada como **fechada**, com o total real gravado, e passa a exibir um selo "Fechado" na importação e no dashboard.
- Antes de substituir, uma confirmação mostra o que sai e o que entra.

## 3. Home: agrupamentos configuráveis e linha do tempo de 12 meses

A home passa a ter, além dos atalhos atuais:

- **Seletor de agrupamento**: Cartão / Categoria / Responsável / Fixo x Variável. Cada grupo mostra o total do mês, o percentual e a **variação em relação ao mês anterior** (seta e percentual, verde/vermelho).
- **Linha do tempo de 12 meses**: gráfico de barras com o gasto de cada mês (com receita e saldo como linha), mês atual destacado, e marcação do mês mais barato e do mais caro. Inclui os meses futuros já comprometidos por parcelas, para enxergar quando o peso diminui.
- Clicar em um mês da linha do tempo filtra os agrupamentos abaixo para aquele mês; clicar em um grupo abre a lista de despesas dele, com edição rápida (já existe no dashboard, reaproveitada aqui).

## 4. Comprovantes: uma pasta compartilhada fixa no Drive

- Em Configurações, um campo para colar o **link ou ID da pasta compartilhada** do Google Drive; ela é salva uma vez e vale para o casal inteiro.
- Todo comprovante (foto de nota, PDF de fatura) vai direto para essa pasta, sem criar subpastas.
- Some a criação automática de "Finanças do Casal / Notas fiscais / <mês>".
- Se a pasta não estiver configurada ou a conexão falhar, o app mostra a mensagem exata devolvida pelo Google e oferece o botão de reconectar.

## Notas técnicas

- Banco: nova tabela `fatura_mes` (cartao_id, competencia, total_informado, inclui_parcelas, status aberto/fechado, despesa_avulsa_id) com RLS igual às demais tabelas financeiras; coluna `fechada_em` em `import_faturas`; ajuste `configuracoes_casal` (chave/valor) para guardar o ID da pasta do Drive.
- Fatura rápida: server fn que calcula a soma de `parcelas` do cartão/competência e cria/atualiza a despesa avulsa idempotentemente (upsert por cartao_id+competencia).
- Fechamento: na confirmação da importação, remove despesas cuja origem seja `fatura_rapida` no mesmo cartão/competência, marca `import_faturas.status='fechada'`.
- Home: novo componente de timeline (recharts, já usado no dashboard) alimentado por `parcelas` + `receitas` agregadas por mês, janela de -6/+6 meses.
- Drive: `src/lib/drive.functions.ts` deixa de chamar `ensureFolder` e passa a usar o ID configurado como `parents`.
