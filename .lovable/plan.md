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

## Custo (IA da Lovable)
- Cada print é lido por uma chamada de visão à AI Gateway (tokens de imagem + texto). Não é ilimitado: a franquia gratuita do workspace é de **4 créditos/mês** para IA e **20 créditos/mês** para Cloud, em qualquer plano. Acima disso consome os créditos do plano (no Free não dá para comprar extras; precisa upgrade Pro/Business).
- Para dezenas de prints por mês, vale considerar: (a) agrupar vários prints em uma única chamada, ou (b) priorizar prints só quando o PDF/texto colado não resolver.
- O plano deixa essa escolha com você — a implementação já é econômica (uma chamada por imagem, em paralelo), e dá para limitar o número de prints por lote.

## Detalhes técnicos
- `createServerFn` `extrairLancamentosDeImagens` em `src/lib/importar-imagens.functions.ts`: recebe as imagens em base64, chama a IA da Lovable via `LOVABLE_API_KEY` (server-only) com modelo de visão, pede JSON estrito (data, descrição, valor, parcela atual/total, final do cartão) e valida a saída com o parser determinístico — a IA nunca inventa valor/data fora do print.
- O resultado vira `LancamentoExtraido[]` e reusa todo o fluxo de gravação existente (despesa + parcelas + dedup).
- `importar.tsx` ganha a aba "Prints" com upload múltiplo, miniaturas e status por imagem.
- Nenhuma tabela nova; nenhuma alteração de RLS.
