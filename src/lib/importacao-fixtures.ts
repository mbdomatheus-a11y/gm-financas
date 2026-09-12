/** Amostras sintéticas: preservam padrões de layout sem conter dados reais. */
export const FATURAS_ANONIMIZADAS = {
  itau: [
    "COMPRAS",
    "08/08 LOJA ANONIMIZADA PARC 2/3 R$ 122,08",
    "PAGAMENTOS EFETUADOS",
    "10/08 PAGAMENTO RECEBIDO -R$ 500,00",
    "PRÓXIMAS FATURAS R$ 244,16",
  ],
  nubank: [
    "CARTÃO •••• 5360",
    "12 AGO SERVICO DIGITAL Parcela 3/4 R$ 49,90",
    "PAGAMENTO RECEBIDO −R$ 300,00",
  ],
  santander: [
    "PAGAMENTO E DEMAIS CRÉDITOS",
    "05/09 PAGAMENTO DE FATURA 700,00-",
    "DESPESAS",
    "06/09 MERCADO TESTE 85,42",
  ],
  pernambucanas: [
    "CARTAO 6550.****.****.6274",
    "03/09 COMPRA TESTE 79,90-",
    "04/09 PAGAMENTO 100,00+",
    "VALOR DO DOCUMENTO 20,00",
  ],
  desconhecido: [
    "LANÇAMENTOS",
    "11/09 ASSINATURA TESTE 01D03 29,90",
    "TOTAL DA FATURA 29,90",
  ],
} as const;