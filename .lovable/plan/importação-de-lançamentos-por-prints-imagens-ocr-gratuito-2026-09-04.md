# Importação de lançamentos por prints (imagens) — OCR gratuito

## O que muda

### 1. Nova aba "Prints" na tela de importação
- Envio de **vários prints de uma vez** (JPG/PNG/WEBP): extrato do banco, fatura do cartão, tela de app.
- Cada imagem passa por **OCR no próprio navegador** com `tesseract.js` (WASM) — **zero custo de IA**, nada é enviado para a Lovable AI Gateway.
- O texto extraído é processado pelo mesmo parser determinístico já usado nas importações de PDF (`extrairLancamentos`), que reconhece linhas "data descrição valor", parcelas e finais de cartão.

### 2. Mesma prévia editável
- Os lançamentos extraídos dos prints caem na **mesma tabela de revisão** já usada nas importações de PDF e texto colado: dá para editar descrição, valor, data, parcelas, tipo, cartão, responsável (incluindo Casal) e categoria antes de salvar.
- Categorização automática respeita primeiro as regras do de-para, depois as palavras-chave.
- Nada é gravado automaticamente.

### 3. Resiliência
- Prints ilegíveis ou sem lançamentos reconhecidos são sinalizados por imagem, sem travar as demais.
- Limite de até 10 imagens por lote; cada imagem é processada em sequência (OCR é pesado; paralelo travaria o navegador).
- Quando o OCR não reconhecer uma linha, ela aparece como linha em branco para preenchimento manual.

## Custo
- **Zero.** Tudo roda no navegador com `tesseract.js` (WASM). Nenhuma chamada à AI Gateway, nenhum crédito consumido.

## Detalhes técnicos
- Dependência: `tesseract.js` (carrega os dados de idioma `por` em WASM do CDN por padrão; funciona no navegador, sem servidor).
- `src/lib/ocr.ts`: `ocrImagem(file)` retorna o texto extraído; reusa `extrairLancamentos(texto, null)` para virar `LancamentoExtraido[]`.
- `importar.tsx` ganha a aba "Prints" com upload múltiplo, miniaturas, status por imagem (processando / pronta / sem dados) e botão para ver o texto extraído.
- Nenhuma tabela nova; nenhuma alteração de RLS; nenhum server function.
