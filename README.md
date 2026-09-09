# Finanças

Quero criar um aplicativo web completo de FINANÇAS PESSOAIS DO CASAL, com visual moderno, limpo e responsivo (mobile-first, mas ótimo também em desktop/web). Use Supabase como backend (auth + banco de dados) desde o início.

### 1. AUTENTICAÇÃO E USUÁRIOS

- Login feito por CPF + senha (não por e-mail visível ao usuário). Internamente, use Supabase Auth mapeando cada CPF para um e-mail técnico único (ex: cpf@meudominio.app) — mas a tela de login mostra apenas os campos "CPF" e "Senha".
- Crie 2 usuários iniciais no banco, ambos com papel de ADMINISTRADOR:
  1. CPF: 08857166635 — senha inicial: admin123
  2. CPF: 41412522803 — senha inicial: admin123
- Ambos os usuários devem ser OBRIGADOS a trocar a senha no primeiro login (flag "senha_temporaria" na tabela de perfil que força um redirect para tela de "criar nova senha" antes de liberar o app).
- Validar formato de CPF no campo de login (com máscara 000.000.000-00).
- Tela de "esqueci minha senha" simples (reset via novo cadastro pelo admin, já que não há e-mail real do usuário).
- Suporte a criação de novos usuários pela área administrativa (ver seção 8).

### 2. ESTRUTURA GERAL / NAVEGAÇÃO

Menu lateral (colapsável no mobile, virando bottom nav ou drawer) com:
- Dashboard (Home)
- Receitas
- Despesas (com sub-abas: Despesas Fixas / Despesas Variáveis)
- Cartões e Bancos
- Investimentos
- Compartilhar
- Usuários e Privilégios (visível só para admin)
- Personalização
- Configurações da conta (trocar senha, etc.)

### 3. DASHBOARD (HOME)

Cards de resumo no topo:
- Total de receitas do mês
- Total de despesas do mês (fixas + variáveis somadas)
- Saldo do mês (receitas - despesas)
- Valor mensalizado de todas as parcelas em aberto (soma de "valor da parcela" de cada despesa parcelada ativa no mês corrente)
- Dívida total em aberto (soma de todas as parcelas restantes de todas as despesas parceladas, ou seja, o total que ainda falta pagar no total, não só no mês)

Gráficos:
- Gráfico de pizza/rosca: despesas por categoria (fixas vs variáveis, e por categoria dentro de cada uma)
- Gráfico de linha/barras: evolução de receitas x despesas nos últimos 6-12 meses
- Indicador visual de progresso de parcelamentos (ex: "cartão X: parcela 3 de 12")

Todos os valores devem exibir o total consolidado em Reais (R$), convertendo automaticamente qualquer lançamento feito em Dólar (US$) pela cotação do dia (buscar cotação via API pública de câmbio, ex: AwesomeAPI ou exchangerate-api). Ao lado do valor consolidado, mostrar também o valor original na moeda em que foi lançado (ex: "R$ 550,00 (US$ 100,00 na cotação do dia)").

### 4. RECEITAS

CRUD completo de receitas com os campos:
- Descrição
- Valor (com seleção de moeda: R$ ou US$, padrão R$)
- Categoria (salário, freelance, rendimento, outros — permitir criar categorias customizadas)
- Data de recebimento
- Recorrente? (sim/não) — se sim, definir frequência (mensal, semanal, etc.) e gerar lançamentos futuros automaticamente
- Responsável (qual dos dois usuários)
- Observações (opcional)

Listagem com filtros por mês, categoria e responsável.

### 5. DESPESAS

Dividir claramente em duas abas/seções:

**5.1 Despesas Fixas** (aluguel, condomínio, internet, streaming, etc.)
**5.2 Despesas Variáveis** (inclui compras no cartão de crédito, gastos do dia a dia)

Campos do formulário de despesa (comum às duas abas, mas contextualizado):
- Descrição
- Valor (com seleção de moeda: R$ ou US$, padrão R$)
- Categoria (moradia, alimentação, transporte, lazer, cartão de crédito, saúde, educação, outros — customizável)
- Data da compra/lançamento
- Forma de pagamento (vincular a um cartão ou banco cadastrado — ver seção 6)
- Número total de parcelas (campo OBRIGATÓRIO, número inteiro ≥ 1; se for à vista, usar 1)
- Data da primeira parcela
- Responsável (qual dos dois usuários, ou "casal/compartilhado")
- Observações (opcional)

**Regras de cálculo do parcelamento:**
- Ao salvar uma despesa com N parcelas, o sistema calcula o valor de cada parcela (valor total ÷ N, tratando arredondamento centavo a centavo na última parcela) e gera N lançamentos futuros vinculados (parcela 1/N, 2/N, ... até N/N), cada um com sua data de vencimento mensal.
- O Dashboard deve exibir:
  - "Valor mensalizado": soma das parcelas que vencem no mês corrente, somando TODAS as despesas parceladas ativas.
  - "Total de endividamento": soma de todas as parcelas futuras ainda não pagas de todas as despesas parceladas (visão do total que falta quitar).
- Cada despesa parcelada deve mostrar visualmente o progresso (ex: barra "3 de 12 pagas").
- Permitir marcar parcelas individuais como "paga".

**Detecção de duplicidade:**
- Ao cadastrar uma nova despesa, o sistema verifica se já existe um lançamento muito parecido (mesma descrição ou valor muito próximo + mesma data ou data próxima, mesmo cartão/banco) e exibe um ALERTA de possível duplicidade antes de salvar, mas permite ao usuário confirmar e salvar mesmo assim.

### 6. CARTÕES E BANCOS

Área de cadastro com duas entidades:

**Cartões:**
- Nome do titular (completo)
- Final do cartão (4 últimos dígitos)
- Bandeira (Visa, Mastercard, Elo, Amex, outros)
- Tipo: Crédito, Débito ou Ambos (crédito e débito no mesmo cartão)
- Mês/ano de vencimento (validade do cartão)
- Dia de fechamento da fatura e dia de vencimento da fatura (para cartões de crédito)
- Limite (opcional)
- Banco/instituição vinculado (relacionar com a entidade Banco abaixo)
- Cor/apelido do cartão para identificação visual

**Bancos:**
- Nome do banco
- Agência
- Conta
- Tipo de conta (corrente, poupança)
- Titular
- Saldo atual (opcional, editável manualmente)

Essas entidades devem poder ser selecionadas no formulário de despesas (campo "forma de pagamento").

### 7. INVESTIMENTOS

Pesquise referências de apps de finanças pessoais conhecidos no mercado (ex: Mobills, Organizze, Guiabolso, apps de corretoras como XP/Rico) para estruturar esta área de forma completa e usá-los como inspiração de UX — sem copiar identidade visual, apenas o modelo funcional. A área de investimentos deve permitir:

- Cadastrar investimentos por tipo: Renda Fixa (CDB, Tesouro Direto, LCI/LCA), Renda Variável (Ações, FIIs, ETFs), Reserva de Emergência, Criptomoedas, Previdência Privada, Outros.
- Campos: nome/ativo, tipo, valor investido (aporte inicial), data do investimento, instituição/corretora, rentabilidade esperada ou taxa (ex: 100% CDI, 12% a.a.), valor atual (atualizável manualmente).
- Dashboard próprio da área de investimentos: total investido, rentabilidade acumulada estimada, distribuição por tipo de ativo (gráfico de pizza), evolução do patrimônio ao longo do tempo (gráfico de linha).
- Permitir registrar novos aportes e resgates.

### 8. USUÁRIOS E PRIVILÉGIOS

Área acessível apenas para quem tem papel de admin:
- Lista de usuários cadastrados com CPF (mascarado, mostrando só os 3 últimos dígitos por segurança visual), nome, papel (admin/comum) e status.
- Botão para criar novo usuário: nome completo, CPF, define-se senha inicial padrão "admin123" (com obrigatoriedade de troca no 1º login, igual aos dois usuários iniciais).
- Aba de "Privilégios" por usuário, onde o admin escolhe quais módulos/ações aquele usuário pode ver ou editar (ex: pode ver Investimentos mas não editar; pode ver Despesas mas não pode excluir; etc.) — implementar como uma matriz de permissões (checkboxes) por módulo: Receitas, Despesas, Cartões e Bancos, Investimentos, Compartilhar, Personalização.
- Toggle para promover um usuário a Administrador (dando acesso total, incluindo esta própria área de usuários e privilégios) ou rebaixar a usuário comum.

### 9. PERSONALIZAÇÃO

Aba de configurações visuais permitindo:
- Escolher entre tema claro / escuro / automático
- Escolher paleta de cores principal (oferecer 4-6 opções pré-definidas, ex: azul, verde, roxo, laranja)
- Escolher fonte (oferecer 3-4 opções de fontes legíveis, ex: Inter, Poppins, Roboto, Nunito)
- Escolher layout do menu (lateral fixo / lateral colapsável / bottom nav no mobile)
- As preferências devem ser salvas por usuário (cada um pode ter sua própria personalização) e persistidas no banco.

### 10. COMPARTILHAR STATUS DE GASTOS

- Botão "Compartilhar resumo do mês" que gera uma imagem (cartão/card estilizado, tipo "story") ou PDF com o resumo financeiro do mês: total de receitas, total de despesas, saldo, gráfico simples de despesas por categoria.
- Botão de download da imagem/PDF gerado, para o usuário enviar manualmente por WhatsApp, e-mail etc.
- Não é necessário link público — a exportação é sempre um arquivo baixado localmente pelo usuário logado.

### 11. RESPONSIVIDADE

- O app deve funcionar perfeitamente tanto em desktop/web quanto em smartphone, com um layout que se adapta (não apenas "encolhe") — no mobile, priorizar cards empilhados, bottom navigation e formulários em tela cheia; no desktop, aproveitar o espaço com menu lateral fixo e visualizações lado a lado.

### 12. STACK E BOAS PRÁTICAS

- Use Supabase para autenticação e banco de dados (PostgreSQL), com Row Level Security garantindo que cada usuário só veja/edite dados conforme suas permissões, mas ambos os usuários do casal devem enxergar os dados financeiros compartilhados da casa (não é um app multi-tenant isolado, é uma conta familiar com 2 acessos).
- Estruture tabelas separadas para: usuarios/perfis, permissoes, receitas, despesas, parcelas, cartoes, bancos, investimentos, categorias, preferencias_usuario.
- Todos os formulários devem ter validação (campos obrigatórios, valores numéricos positivos, número de parcelas obrigatório e maior que zero).
- Design limpo, moderno, com boa hierarquia visual, ícones claros para cada categoria de despesa/receita, e uso de cores para status (verde para positivo/pago, vermelho para negativo/pendente, amarelo para alerta de duplicidade).

Comece criando a estrutura de autenticação com os dois usuários e o banco de dados completo, depois construa o Dashboard, e em seguida os módulos de Receitas, Despesas, Cartões/Bancos, Investimentos, Usuários/Privilégios, Personalização e Compartilhar, nessa ordem.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gm-financas.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/09bc7d5a-95d6-44c4-9323-c4ef74063cda).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
