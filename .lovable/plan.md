# Importação inteligente, categorização e vínculo com notas fiscais

## 1. Responsável "Casal (compartilhado)"
Na tela de importação (e nos formulários de despesa/receita) o seletor de responsável passa a ter a opção **Casal (compartilhado)**, além dos perfis cadastrados. Filtros e relatórios tratam essa opção como um responsável próprio.

## 2. Nova aba "De-para de categorias"
Aba nova no menu, alimentada por um arquivo **Excel ou CSV** que você sobe sempre que quiser.

- Colunas esperadas: descrição/estabelecimento, categoria, subcategoria (opcional), tipo (opcional).
- Prévia do arquivo antes de salvar, com correção linha a linha.
- Se a categoria do arquivo não existir ainda, ela é **criada automaticamente** na lista de categorias (ex.: `Assinaturas / Serviços Digitais / IA`).
- Cada linha vira uma regra reutilizável (ex.: Netflix → Assinaturas / Serviços Digitais), aplicada em toda importação futura e nos lançamentos por texto.
- Regras podem ser editadas, desativadas ou removidas na própria aba.

## 3. Importação de lançamentos totalmente editável
Além do PDF de fatura, passa a existir a opção **Colar texto**: qualquer bloco copiado (extrato, planilha, mensagem) que contenha data, descrição e valor é interpretado e vira lista de lançamentos.

Na prévia de qualquer importação (PDF, colado ou CSV) você pode ajustar, linha a linha:
- descrição, valor, data;
- número de parcelas e parcela atual;
- fixo / variável / parcelado;
- cartão (final) ou conta;
- responsável (incluindo Casal);
- categoria e subcategoria, com sugestão automática e marcação de confiança.

Alterar a categoria de uma linha oferece salvar como regra de de-para para as próximas vezes.

## 4. Lançamento por texto / WhatsApp
Campo de texto livre onde você cola a mensagem ("cadeira escritório 24x 54 santander 6975 guilherme primeira parcela 10/09"). O sistema devolve os campos preenchidos — descrição, valor, parcelas, repetição, moeda, categoria, tipo, data, forma de pagamento, data da 1ª parcela, responsável e observações — seguindo exatamente as regras que você definiu:

- valor exibido é o valor da parcela/mês; o total vai para observações;
- parcelamento nunca é confundido com recorrência;
- banco/cartão só é preenchido quando aparece na mensagem (final do cartão nunca é inventado);
- responsável só é preenchido quando corresponde a alguém cadastrado;
- campo que não pode ser determinado com segurança fica **vazio**;
- ordem das informações não importa; a mensagem é processada mesmo com 1 ou 2 dados.

Tudo cai numa tela de revisão antes de virar despesa — nada é gravado automaticamente.

## 5. Notas fiscais vinculadas a despesas e parcelas
- Na despesa (e em cada parcela) é possível **anexar uma nota fiscal já cadastrada**; e na nota fiscal é possível vincular a despesa/parcelamento correspondente.
- Com o vínculo, a tela da despesa mostra quanto já foi pago do parcelamento e um atalho para abrir a nota, seus itens e a garantia; a nota mostra o parcelamento e o valor pago até o momento.

## 6. Gráfico de saldo, receita e despesa por mês
Novo gráfico no dashboard com barras de receita e despesa por mês e linha de saldo acumulado, com seletor de período (3, 6, 12, 24 meses, ano atual ou intervalo personalizado) e valores visíveis nas barras, no mesmo padrão visual atual.

---

## Detalhes técnicos

- **Banco**: novas colunas/valor `"casal"` para responsável; tabela `nota_vinculos` (nota_id, despesa_id, parcela_id opcional) com RLS igual às demais tabelas do casal; reuso de `categoria_regras` para o de-para (tipo_regra `de_para`), com `origem_arquivo` para rastrear a planilha.
- **De-para**: leitura de XLSX/CSV no navegador com `xlsx`; upsert em `categoria_regras` por `estabelecimento_normalizado`; criação automática de faltantes em `categorias`.
- **Motor de categorização**: `src/lib/categorizacao.ts` já tem taxonomia, normalização, confiança e prioridade — passa a consultar primeiro as regras de de-para, depois as palavras-chave.
- **Parser de texto**: `src/lib/lancamento-texto.ts` com extração determinística (valor, parcelas, datas, banco/final, nomes cadastrados) e, quando o texto for ambíguo, refinamento pela IA da Lovable via `createServerFn`; a saída passa pelo mesmo validador determinístico, então nada é inventado.
- **Importação**: `src/routes/_authenticated/importar.tsx` ganha abas (PDF · Texto colado · Planilha de-para) e a prévia vira uma tabela totalmente editável reaproveitando o fluxo de gravação já existente (despesa + parcelas + dedup).
- **Gráfico**: componente novo em `dashboard.tsx` usando Recharts (ComposedChart) alimentado por parcelas e receitas agregadas por mês.
