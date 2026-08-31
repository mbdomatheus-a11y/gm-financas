# Notas fiscais e garantias (com Google Drive)

Novo módulo "Notas fiscais" para guardar comprovantes por foto ou por leitura do QR Code / código de barras da nota, com controle de garantia.

## Como vai funcionar

1. Botão "Nova nota" abre a escolha: **Foto do comprovante** ou **Ler nota (QR / código de barras)**.
2. **Foto**: abre a câmera do celular (ou seleção de arquivo), permite adicionar mais de uma foto por nota.
3. **Ler nota**: abre o leitor pela câmera, lê o QR Code da NFC-e / DANFE ou o código de barras, extrai a **chave de acesso de 44 dígitos** e o link da SEFAZ. O sistema tenta buscar automaticamente emitente, valor total, data e itens na consulta pública; quando o estado bloquear (captcha/indisponibilidade), a nota é salva mesmo assim com a chave e você completa os dados manualmente. O status da captura fica visível ("dados obtidos automaticamente" / "preencher manualmente").
4. Campos da nota: descrição, estabelecimento, data da compra, valor, categoria, prazo de garantia (escolhido a cada nota: 90 dias, 12 meses, 24 meses ou personalizado), observações e itens (descrição, quantidade, valor).
5. **Google Drive**: você conecta sua conta Google uma vez; as fotos e o PDF/print da nota são enviados para uma pasta "Finanças do Casal / Notas fiscais / AAAA-MM" no seu Drive. O app guarda apenas o ID/link do arquivo e mostra a miniatura. Sem conexão ativa, o app avisa e mantém a nota sem anexo até você conectar.

## Garantia

- Data de fim = data da compra + prazo escolhido (por nota, e opcionalmente por item).
- Avisos dentro do app: faixa de alerta na tela inicial e destaque na lista quando faltarem 30, 15 e 7 dias, e marcação de "garantia expirada".
- Filtros na lista: garantia ativa, expirando em 30 dias, expirada, todas. Busca por estabelecimento, descrição ou chave de acesso.

## Telas

- `/notas` — lista de notas em cards: estabelecimento, data da compra, valor, selo de garantia com dias restantes, miniatura da foto.
- Detalhe da nota: fotos, chave de acesso (com copiar e link para a SEFAZ), itens, garantia e ações de editar/excluir.
- Item "Notas fiscais" no menu, e bloco de garantias a vencer na tela inicial.

## Detalhes técnicos

- Tabelas novas: `notas_fiscais` (chave_acesso única, uf, estabelecimento, descrição, data_compra, valor_total, categoria, garantia_meses/dias, garantia_fim, status_captura, drive_folder_id, created_by), `nota_itens` (descrição, quantidade, valor unitário, valor total, garantia própria opcional) e `nota_arquivos` (drive_file_id, link, tipo, nome). RLS igual às demais tabelas (membros ativos) + GRANTs.
- Leitura de código: `@zxing/browser` no cliente, com câmera traseira; valida o dígito verificador da chave de 44 dígitos e extrai UF/CNPJ/data pela própria chave, garantindo dados mínimos mesmo sem consulta externa.
- Consulta automática: server function que acessa a URL da SEFAZ contida no QR Code e faz o parse do HTML de itens; tratamento de falha silencioso, retornando `status_captura = "manual"`.
- Google Drive: App User Connector `google_drive`, para cada usuário conectar a própria conta; upload feito por server function autenticada usando o token do usuário, nunca no cliente.
- Alertas de garantia calculados no cliente a partir de `garantia_fim` (sem cron), reaproveitando o padrão de alerta já usado na lista de compras.
- Câmera e leitor carregados apenas no navegador (import dinâmico), sem quebrar o SSR.
