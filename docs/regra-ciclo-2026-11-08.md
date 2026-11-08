# Regra do ciclo (aprovada pelo usuário em 08/11/2026)

Frase do usuário: "O salário do dia D paga as contas que vencem até o próximo dia D. O que sobrar no dia D é economia."

Com virada no dia D (ex.: 15):
1. Receitas do ciclo: data PREVISTA de recebimento de D até D-1 do mês seguinte (15/nov a 14/dez). Receita atrasada (prevista 15, entrou 17) conta pela data prevista. Receita avulsa sem data prevista conta pela data em que entrou.
2. Despesas do ciclo: VENCIMENTO de D+1 até D do mês seguinte (16/nov a 15/dez). Cartão pelo vencimento da fatura. Fora do cartão pelo vencimento. Fatura que vence no próprio dia D fica no ciclo que termina.
3. Rótulo do ciclo: "15/nov a 15/dez" (receitas desde o dia 15, contas até o dia 15).
4. Tela durante o ciclo:
   - Destaque "Disponível até DD/MM" = receitas já recebidas do ciclo menos despesas já vencidas do ciclo.
   - Abaixo "Previsto para sobrar em DD/MM" = Disponível + receitas que ainda vão entrar no ciclo - despesas que ainda vão vencer no ciclo - caixinhas planejadas do ciclo. Linha: "inclui R$ X que ainda vão entrar e R$ Y de contas que ainda vão vencer".
   - Nenhum forecast por ritmo de gasto.
5. Virada (dia D+1): cartão "Você economizou R$ X no ciclo passado" (resultado final do ciclo fechado). Soma em "Economia acumulada". NÃO vira receita do ciclo novo.
6. Configuração do GRUPO (painel compartilhado): quem configurar primeiro define; qualquer membro pode alterar (não só admin). Ao alterar: aviso para todos "Fulano mudou a virada para o dia N" e recálculo.
7. Configuração obrigatória: ao entrar, se o grupo não tem regra, assistente com a pergunta "Qual é o seu principal dia de pagamento?" sugerindo o dia da maior receita fixa cadastrada; mostra um exemplo com os números do usuário antes de salvar.
8. Cartão novo (e cartão cujo vencimento mudou): ao salvar, confirmação obrigatória de um toque explicando em que ciclo as faturas caem ("O Nubank vence dia 20, depois da sua virada (dia 15). As faturas dele vão ser pagas com o salário do dia 15 anterior.") com Confirmar ou Mudar a virada. Cartões existentes sem revisão aparecem para revisar uma vez.
