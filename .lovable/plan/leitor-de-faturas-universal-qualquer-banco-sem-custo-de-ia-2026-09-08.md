# Leitor de faturas universal (qualquer banco, sem custo de IA)

Objetivo: importar o PDF de qualquer banco sem depender de um parser feito banco a banco, e ficar mais preciso a cada correção sua.

## 1. Leitura por posição, não por linha de texto

Hoje o texto do PDF é lido como linhas coladas, o que quebra quando o banco muda o layout. A leitura passa a usar as coordenadas de cada pedaço de texto:

- Agrupa os fragmentos por altura (mesma linha visual), mesmo quando o banco desenha data, descrição e valor em blocos separados.
- Detecta as colunas pela posição horizontal: a coluna com datas, a coluna com valores (a mais à direita) e o restante vira descrição.
- Junta descrições que o banco quebrou em duas linhas.
- Ignora cabeçalhos, rodapés, textos de propaganda e blocos de "pagamento mínimo/juros" que repetem em todas as páginas.

## 2. Reconhecimento genérico dos campos

Regras que valem para qualquer emissor:

- Datas: `12/03`, `12/03/2026`, `12 mar`, `2026-03-12`; ano deduzido pelo vencimento da fatura, com virada de ano tratada (dez → jan).
- Valores: `1.234,56`, `1234,56`, `R$ 1.234,56`, negativo por sinal, por parênteses ou por sufixo `-`, além de `US$` para compras em dólar.
- Parcelas: `03/12`, `3 de 12`, `PARC 3/12`, `3ª de 12`.
- Créditos/estornos/pagamentos entram como crédito e não viram despesa.
- Final do cartão e nome do titular capturados por seção, para lançar cada gasto no cartão certo quando a fatura tem vários cartões.
- Totais, vencimento e limites continuam sendo lidos, agora com busca por proximidade dos rótulos em vez de padrão fixo por banco.

## 3. Conferência automática do resultado

Depois de extrair, o app confere a soma dos lançamentos contra o total da fatura:

- Bate: marca a leitura como confiável.
- Não bate: mostra a diferença no topo da prévia, aponta as linhas suspeitas (valor sem data, descrição vazia, valor fora da faixa) e deixa você ajustar antes de salvar.

Nada é gravado sem sua confirmação, como já acontece hoje.

## 4. Memória de layout por banco

Toda vez que você corrigir a prévia, o app guarda o "jeito" daquele arquivo:

- Identifica o emissor por uma assinatura do documento (textos fixos do cabeçalho).
- Guarda as posições das colunas, o formato de data e valor, e onde a lista de gastos começa e termina.
- Guarda também as correções de descrição/categoria já feitas (aproveita o de-para que já existe).
- Nas próximas faturas do mesmo banco, esse padrão é aplicado primeiro; se falhar, cai na leitura genérica automaticamente.

Tudo isso continua rodando no navegador, sem consumir créditos de IA.

## 5. Bancos desconhecidos

Se mesmo assim nenhuma linha for reconhecida, a fatura abre na prévia com o texto extraído lado a lado, para você marcar uma linha de exemplo. A partir dessa marcação o app deduz o padrão e reprocessa o arquivo inteiro — e memoriza para o próximo mês.

## Notas técnicas

- `src/lib/faturas.ts`: `extrairTexto` passa a devolver itens com `x`, `y`, `width` e página; novo módulo `src/lib/fatura-layout.ts` faz agrupamento por linha, detecção de colunas e classificação de células.
- `extrairLancamentos` vira orquestrador: tenta o perfil salvo do emissor → parser posicional genérico → parser de linha atual (fallback já existente, também usado pelo OCR de prints).
- Nova tabela `fatura_layouts` (assinatura, banco, colunas em JSON, formatos, âncoras de início/fim, contador de acertos) com RLS e GRANTs no padrão das demais tabelas; gravada quando o usuário confirma a importação.
- Validação por soma reaproveita `extrairTotal`; resultado exposto na prévia de `importar.tsx` como faixa de status por arquivo.
- Sem chamadas à AI Gateway; nenhuma dependência nova.
