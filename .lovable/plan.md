# Importação inteligente de faturas — entregas fatiadas

O importador atual já possui PDF posicional, texto colado, OCR de imagens, prévia editável, categorização, identificação por hash e memória básica de layouts. As etapas abaixo complementam e endurecem essa base, sem reconstruir o que já funciona.

## Regra de execução

- Executar uma etapa por vez e interromper para aprovação antes da próxima.
- Não publicar, não fazer deploy e não alterar dados existentes.
- Não usar IA paga nesta primeira versão: regras determinísticas e OCR local continuam como padrão.
- PDFs e dados reais não entram no projeto; os testes usarão amostras anonimizadas.
- Este trabalho fica separado das etapas pendentes de despesas fixas.

## Etapa 1 — Modelo interno e testes-base, sem mudar a tela

- Definir um lançamento importado completo: tipo semântico (compra, pagamento, estorno, tarifa etc.), valor bruto, valor normalizado, sinal original, seção, página/trecho de origem e confiança por campo.
- Trabalhar os cálculos monetários em centavos para evitar erros de arredondamento.
- Criar amostras anonimizadas representando Itaú, Nubank, Santander, Pernambucanas/Elo e layout desconhecido.
- Cobrir datas, valores, sinais, parcelas, finais de cartão e ruídos com testes unitários.

**Aceite:** os testes documentam a regra financeira sem alterar importação ou banco.

## Etapa 2 — Leitura robusta de PDF e OCR de PDF digitalizado

- Melhorar a identificação de seções, titulares, cartões, subtotais, período, vencimento e total.
- Ignorar cabeçalhos repetidos, boletos, limites, ofertas, saldo futuro e próximas faturas.
- Detectar PDF sem camada de texto e aplicar OCR local por página como fallback.
- Diferenciar arquivo inválido, protegido por senha e documento sem conteúdo útil.

**Aceite:** PDFs de texto e digitalizados produzem conteúdo verificável ou erro claro, nunca falso sucesso.

## Etapa 3 — Sinais, tipos e reconciliação financeira

- Classificar pela seção e significado antes de usar o sinal bruto.
- Separar compra, pagamento, estorno e demais créditos; preservar o sinal original para auditoria.
- Implementar conferência por seção/cartão e conferência geral da fatura, com tolerância de R$ 0,01.
- Exibir itens encontrados, ignorados e duvidosos, despesas, pagamentos, créditos e diferença.

**Aceite:** pagamentos e estornos não se confundem, resumos não viram despesas e divergências ficam explícitas.

## Etapa 4 — Caixa de texto livre independente da ordem

- Aceitar data, descrição, valor, parcela e cartão em qualquer ordem.
- Aceitar múltiplas linhas, ponto e vírgula e delimitadores comuns.
- Tratar sinais antes/depois, datas textuais, parcelas variadas e valores ambíguos.
- Marcar incerteza em vez de completar informação ausente.
- Criar testes por permutação dos mesmos dados.

**Aceite:** os exemplos do documento resultam no mesmo lançamento, sem confundir datas, frações ou finais de cartão.

## Etapa 5 — Revisão compacta em etapas

- Organizar o fluxo em Origem, Identificação, Revisão e Confirmação.
- Manter todos os campos atuais e acrescentar confiança e evidência de origem.
- Permitir excluir/restaurar, unir/dividir linhas e aplicar cartão, responsável ou categoria em lote.
- Preservar correções durante erros e navegação; manter a tela compacta e sem rolagem lateral.

**Aceite:** toda informação crítica pode ser revisada antes de gravar, inclusive em celular.

## Etapa 6 — Cartões, categorias e rascunho recuperável

- Bloquear confirmação quando cartão estiver ausente ou ambíguo.
- Oferecer cadastro real de cartão com dados previamente identificados e retorno ao mesmo rascunho.
- Restringir categoria às opções existentes e válidas; nunca criar silenciosamente.
- Salvar rascunho antes de ir à tela de Categorias e restaurá-lo no retorno.
- Criar somente as estruturas de banco indispensáveis, com permissões por usuário/casal.

**Aceite:** cadastrar cartão/categoria não apaga o trabalho e nenhuma referência inválida pode ser salva.

## Etapa 7 — Gravação atômica e duplicidades

- Mover a confirmação para uma operação segura: tudo é gravado ou nada é.
- Verificar reenvio do arquivo, mesma competência/cartão, lançamento equivalente e repetição entre páginas/seções.
- Mostrar possíveis duplicados e exigir decisão explícita.
- Não reter o PDF quando não houver necessidade funcional; manter apenas evidências mínimas e seguras.

**Aceite:** uma falha não deixa importação parcial e nenhum duplicado é criado silenciosamente.

## Etapa 8 — Aprendizado controlado

- Aprender somente após confirmação: categoria/tipo por comerciante, vínculo de cartão e perfil de layout/sinais.
- Oferecer “somente desta vez” ou “usar futuramente”.
- Adicionar contagem de confirmações, último uso, confiança e remoção das regras.
- Garantir que regras aprendidas nunca ignorem segurança, categoria válida, reconciliação ou duplicidade.

**Aceite:** uma correção confirmada ajuda a próxima importação; uma prévia cancelada não ensina nada.

## Etapa 9 — Validação final e regressão

- Rodar testes unitários, integração e fluxo crítico completo.
- Validar os quatro perfis anonimizados, PDF protegido, OCR, texto livre, cartão/categoria inexistentes, retomada e duplicidade.
- Verificar tipos, lint e comportamento em celular e desktop.
- Entregar relatório do que passou, limitações reais e qualquer dependência externa restante.

**Aceite:** todos os critérios do documento ficam comprovados por testes, sem regressão no restante do aplicativo.

## Detalhes técnicos

- Reaproveitar `faturas.ts`, `fatura-layout.ts`, `lancamento-texto.ts`, `ocr.ts`, o importador atual e as tabelas existentes.
- Separar extração, interpretação semântica, reconciliação e persistência para permitir testes isolados.
- Manter apenas os quatro últimos dígitos do cartão e nunca registrar CPF, endereço, boleto ou número completo.
- Qualquer migração será apresentada e aplicada somente na etapa correspondente aprovada.
