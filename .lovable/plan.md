# Importação de lançamentos por prints (imagens)

## O que muda

### 1. Nova aba "Prints" na tela de importação
- Envio de **vários prints de uma vez** (JPG/PNG/WEBP): extrato do banco, fatura do cartão, conversa de WhatsApp, tela de app.
- Cada imagem é lida pela IA da Lovable (modelo com visão) que extrai os lançamentos: data, descrição, valor, parcelas e final do cartão quando visível.
- Se o print for conversa de texto (WhatsApp), a IA interpreta com as mesmas regras do lançamento por texto já existente.

### 2. Mesma prévia editável
- Os lançamentos extraídos dos prints caem na **mesma tabela de revisão** já usada nas importações de PDF e texto colado: dá para editar descrição, valor, data, parcelas, tipo, cartão, responsável (incluindo Casal) e categoria antes de salvar.
- Categorização automática respeita primeiro as regras do de-para, depois as palavras-chave.
- Nada é gravado automaticamente.

### 3. Resiliência
- Prints ilegíveis ou sem lançamentos são sinalizados por imagem, sem travar as demais.
- Limite de até 10 imagens por lote; cada imagem é processada em paralelo.

## Detalhes técnicos
- `createServerFn` `extrairLancamentosDeImagens` em `src/lib/importar-imagens.functions.ts`: recebe as imagens em base64, chama a IA da Lovable via `LOVABLE_API_KEY` (server-only) com modelo de visão, pede JSON estrito (data, descrição, valor, parcela atual/total, final do cartão) e valida a saída com o parser determinístico — a IA nunca inventa valor/data fora do print.
- O resultado vira `LancamentoExtraido[]` e reusa todo o fluxo de gravação existente (despesa + parcelas + dedup).
- `importar.tsx` ganha a aba "Prints" com upload múltiplo, miniaturas e status por imagem.
- Nenhuma tabela nova; nenhuma alteração de RLS.
