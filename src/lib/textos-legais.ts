// Textos legais do Control ALL: fonte única para o site (/termos-de-uso, /privacidade, /cookies),
// para o app (que abre essas páginas) e para a cópia no vault do Obsidian.
// Versão 24/10/2026, derivada dos modelos do Pierre (termos) e da Mobills/Toro (privacidade e
// cookies), adaptada ao que o Control ALL faz de verdade. Pendências respondidas pelo Matheus
// em 24/10/2026: sem CNPJ nem sede (endereço = site), sem encarregado (pequeno porte).

export type Bloco =
  | string
  | { sub: string }
  | { lista: string[] }
  | { tabela: { cabecalho: string[]; linhas: string[][] } };

export type Secao = { titulo: string; blocos: Bloco[] };

export type DocumentoLegal = {
  id: "termos" | "privacidade" | "cookies";
  titulo: string;
  versao: string;
  resumo: string;
  secoes: Secao[];
};

export const VERSAO_TEXTOS_LEGAIS = "24/10/2026";

const SITE = "www.controlall.com.br";

// ---------------------------------------------------------------------------------------------
// TERMOS DE USO
// ---------------------------------------------------------------------------------------------

export const MODULOS_TERMOS: { nome: string; guarda: string; quemVe: string }[] = [
  {
    nome: "Despesas, receitas e lançamentos",
    guarda: "Descrição, valor, data, categoria, responsável, forma de pagamento, parcelas, recorrência, reajuste e observações que você informa.",
    quemVe: "Você e as pessoas do seu grupo com permissão de ver o módulo.",
  },
  {
    nome: "Cartões e bancos",
    guarda: "Apelido, bandeira, os 4 últimos dígitos, titular, limite, dia de fechamento e de vencimento e saldo. Nunca o número completo do cartão nem senhas.",
    quemVe: "Você e as pessoas do seu grupo com permissão.",
  },
  {
    nome: "Importação de faturas",
    guarda: "O arquivo enviado (PDF, imagem, planilha ou texto) é lido para extrair lançamentos, total, vencimento e limite. Guardamos os lançamentos, o resumo da fatura e uma cópia de segurança quando uma fatura substitui outra.",
    quemVe: "Você e as pessoas do seu grupo com permissão de importar ou ver despesas.",
  },
  {
    nome: "Open Finance (Pluggy)",
    guarda: "Contas, saldos, transações, cartões, investimentos e empréstimos que você autorizar na instituição. Lançamentos vindos do banco ficam travados (valor e data) e prevalecem sobre a fatura importada.",
    quemVe: "Recurso em teste, liberado só pela administração. Os dados importados ficam no seu grupo.",
  },
  {
    nome: "Investimentos e caixinhas",
    guarda: "Aplicações, valor aplicado e atual, rentabilidade informada, aportes, resgates e metas de poupança.",
    quemVe: "Você e as pessoas do seu grupo com permissão.",
  },
  {
    nome: "Notas fiscais e garantias",
    guarda: "Chave de acesso, estabelecimento, itens, valores, prazo de garantia e fotos ou PDFs de comprovantes. A consulta da nota usa a página pública da SEFAZ; no app, essa página abre no próprio aparelho.",
    quemVe: "Você e as pessoas do seu grupo.",
  },
  {
    nome: "Lista de compras",
    guarda: "Itens, quantidade, valor estimado, links de produtos, aprovações e alertas.",
    quemVe: "Você e as pessoas do seu grupo.",
  },
  {
    nome: "Veículos",
    guarda: "Apelido, marca, modelo, ano, placa, chassi, Renavam, quilometragem, documentos, manutenções e custos.",
    quemVe: "Você e as pessoas do seu grupo com permissão.",
  },
  {
    nome: "Pets",
    guarda: "Dados do animal, vacinas, reforços, cuidados e documentos que você registra.",
    quemVe: "Você e as pessoas do seu grupo.",
  },
  {
    nome: "Exames",
    guarda: "Resultados de exames que você registra. São dados de saúde, considerados sensíveis pela LGPD, e só entram se você mesmo cadastrar.",
    quemVe: "Só você, por padrão. Um exame aparece para o grupo apenas se você marcar \"Compartilhar com familiares\".",
  },
  {
    nome: "Onde está, anotações com link e calculadoras",
    guarda: "Locais onde você guardou itens, anotações e links que você salvar. As calculadoras não guardam o que é calculado.",
    quemVe: "Você e as pessoas do seu grupo.",
  },
  {
    nome: "Links temporários",
    guarda: "O conteúdo que você escolher compartilhar e a data de expiração.",
    quemVe: "Qualquer pessoa que tiver o link, até ele expirar.",
  },
  {
    nome: "Assistente e lançamento com IA",
    guarda: "O texto ou áudio que você envia e um resumo dos dados do seu grupo necessários para responder (por exemplo, totais do mês, categorias e próximos vencimentos) vão ao provedor de IA só para gerar a resposta. A conversa não fica gravada no nosso banco de dados; no site, o histórico do lançamento rápido fica só no seu navegador.",
    quemVe: "Só você vê a conversa. Há limite diário de uso, e a administração pode desativar a IA.",
  },
  {
    nome: "Calendário no iPhone e resumos compartilhados (só no app)",
    guarda: "O link de assinatura do calendário é pessoal e assinado; quem tiver o link vê os eventos (vencimentos, receitas, garantias). Resumos compartilhados só saem quando você toca em compartilhar.",
    quemVe: "Quem receber o link ou o resumo que você enviar.",
  },
];

export const TERMOS: DocumentoLegal = {
  id: "termos",
  titulo: "Termos de Uso",
  versao: VERSAO_TEXTOS_LEGAIS,
  resumo:
    "Estes Termos explicam como funciona o Control ALL, no site www.controlall.com.br e no app para iPhone, e as regras para usá-lo. Eles valem junto com a Política de Privacidade e a Política de Cookies. Ao criar a conta ou usar o serviço, você declara que leu e concorda com esses documentos. Se não concordar, não use o serviço.",
  secoes: [
    {
      titulo: "1. Quem somos",
      blocos: [
        `1.1. O Control ALL é um serviço disponibilizado no endereço ${SITE} e no app para iPhone, mantido pelo seu desenvolvedor responsável ("Control ALL" ou "nós").`,
        "1.2. Usuário é a pessoa física, maior de 18 anos e plenamente capaz, que cria uma conta ou usa o site ou o app.",
        "1.3. O usuário é o único responsável pelas decisões que toma a partir das informações exibidas. O Control ALL organiza e apresenta informações; não substitui orientação profissional.",
      ],
    },
    {
      titulo: "2. Definições",
      blocos: [
        {
          lista: [
            "Plataforma: o site e o app para iPhone. Os dois usam a mesma conta e os mesmos dados.",
            "Conta: acesso individual e intransferível, com e-mail ou CPF e senha.",
            "Grupo: espaço compartilhado (por exemplo, uma família) onde ficam os dados lançados. Cada conta pertence a um grupo.",
            "Administrador do grupo: quem define o que cada pessoa do grupo pode ver, editar ou excluir.",
            "Administração do site: equipe do Control ALL que opera a Plataforma.",
            "Módulos: áreas da Plataforma, como finanças, notas fiscais, lista de compras, veículos, pets e exames. Estão descritos no Anexo.",
            "Open Finance: compartilhamento de dados bancários regulado pelo Banco Central, feito com a sua autorização por meio da Pluggy.",
            "Assistente de IA: recurso que responde perguntas e sugere lançamentos a partir de texto ou áudio.",
            "Dados pessoais: informação relacionada a pessoa identificada ou identificável, nos termos da Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).",
          ],
        },
      ],
    },
    {
      titulo: "3. O que o Control ALL oferece",
      blocos: [
        "3.1. Uma ferramenta de organização pessoal e familiar: despesas, receitas, cartões, bancos, investimentos e caixinhas, importação de faturas, notas fiscais e garantias, lista de compras, veículos, pets, exames, \"Onde está\", calculadoras, links temporários, calendário de vencimentos, cotação do dólar e índices, e assistente de IA.",
        "3.2. Caráter informativo: totais, gráficos, projeções, índices e respostas da IA servem para apoiar o seu controle. Não são consultoria nem recomendação financeira, de investimentos, contábil, tributária, jurídica ou médica. Antes de decisões importantes, avalie os riscos e, se achar necessário, procure um profissional habilitado.",
        "3.3. O Control ALL não é banco nem instituição financeira ou de pagamento. Não guarda dinheiro, não faz pagamentos, transferências ou investimentos e não oferece crédito.",
        "3.4. Para usar a Plataforma você não precisa informar senha de banco nem número completo de cartão. O Control ALL nunca pede essas informações.",
        "3.5. Alguns módulos podem estar em teste e ser liberados só para parte dos usuários (hoje, o Open Finance). Módulos podem ser incluídos, alterados ou retirados. Quando a mudança afetar dados que você guardou, avisaremos com antecedência razoável.",
      ],
    },
    {
      titulo: "4. Cadastro e conta",
      blocos: [
        "4.1. Para criar a conta, informe nome, CPF, e-mail, telefone, data de nascimento e senha. O CPF evita contas duplicadas e permite entrar sem o e-mail; a data de nascimento confirma a idade mínima.",
        "4.2. A Plataforma é destinada a maiores de 18 anos. O cadastro não é aceito com data de nascimento de menor de idade, e ao se cadastrar você declara ser maior de idade e plenamente capaz. Guardamos a data e a versão dos documentos que você aceitou.",
        "4.3. A conta é individual e intransferível. Mantenha seus dados verdadeiros e atualizados; você pode corrigi-los na tela Conta.",
        "4.4. Ao convidar alguém para o seu grupo, você decide o que essa pessoa pode ver, editar ou excluir em cada módulo, e pode mudar ou retirar esse acesso quando quiser.",
      ],
    },
    {
      titulo: "5. Preço",
      blocos: [
        "5.1. Hoje o uso do Control ALL é gratuito.",
        "5.2. Se forem criados planos pagos, preço e condições serão apresentados antes, e nada será cobrado sem a sua adesão expressa.",
        "5.3. Recursos gratuitos podem ter limites, como uso diário da IA e espaço para arquivos. Os limites aparecem na própria Plataforma.",
      ],
    },
    {
      titulo: "6. Acesso e segurança da conta",
      blocos: [
        {
          lista: [
            "Você entra com e-mail ou CPF e senha. A senha é guardada pelo provedor de autenticação só em forma de hash (um embaralhamento que não pode ser desfeito); nem a administração consegue vê-la.",
            "Depois de 3 tentativas erradas, o acesso fica bloqueado por alguns minutos. Pode ser exigido um código enviado por e-mail (segundo fator).",
            "A sessão tem tempo máximo e pode ser encerrada por inatividade. No app, o Face ID e a senha salva no iCloud ficam só no seu aparelho e na sua conta Apple; o Control ALL não recebe a sua biometria.",
            "Pedidos de troca de senha e alterações de senha geram um e-mail com aparelho, data, hora e local aproximado. Se não foi você, o botão \"Não fui eu\", com uma segunda confirmação, bloqueia na hora novos acessos à conta. Um acesso que já estava aberto em outro aparelho pode continuar por até 1 hora, até a sessão expirar. O desbloqueio é feito só pelo suporte, depois de confirmar sua identidade.",
          ],
        },
        "6.1. Guarde sua senha em sigilo e não compartilhe usuário, senha, código de acesso ou sessão. Acessos feitos com as suas credenciais são considerados seus.",
        "6.2. Em caso de perda ou roubo do celular, ou suspeita de acesso indevido, avise pelo e-mail contato@controlall.com.br. Bloqueamos a conta a seu pedido. Até o aviso, as ações feitas com a sua conta são de sua responsabilidade.",
      ],
    },
    {
      titulo: "7. Grupo: quem vê o quê",
      blocos: [
        "Os dados lançados ficam no grupo, não na pessoa. Quem administra o grupo define, para cada pessoa e cada módulo, se ela pode ver, editar ou excluir. Pessoas de outros grupos não veem os seus dados: as regras de acesso do banco de dados separam os grupos.",
        {
          lista: [
            "Ao aceitar um convite para o grupo de outra pessoa, você passa a ver e lançar nos dados daquele grupo. Ao sair, volta para o seu grupo original.",
            "\"Ocultar valores\" esconde os números só na tela do seu aparelho; não muda o que os outros veem.",
            "Módulos desligados pela administração do site não aparecem para os usuários.",
            "Ao lançar dados de outras pessoas (por exemplo, exames de um familiar), você declara ter autorização delas ou ser o responsável legal.",
          ],
        },
      ],
    },
    {
      titulo: "8. Suas responsabilidades",
      blocos: [
        "Ao usar a Plataforma, você se compromete a:",
        {
          lista: [
            "fornecer dados verdadeiros e lançar apenas informações e arquivos que tem o direito de usar;",
            "conferir os valores lidos automaticamente (faturas, notas fiscais, Open Finance e IA) antes de tomar decisões;",
            "manter o celular e o computador seguros e atualizados e usar conexões confiáveis;",
            "não usar a Plataforma para atividade ilegal, fraude ou lavagem de dinheiro;",
            "não tentar acessar dados de outros grupos, áreas de programação, banco de dados ou código-fonte;",
            "não fazer engenharia reversa, cópia, revenda ou sublicença da Plataforma;",
            "não usar robôs, automação ou coleta automatizada de dados, nem criar contas por meios automáticos;",
            "não enviar arquivos maliciosos nem tentar contornar controles de segurança ou afetar a disponibilidade do sistema.",
          ],
        },
      ],
    },
    {
      titulo: "9. Nossos compromissos",
      blocos: [
        {
          lista: [
            "manter a Plataforma funcionando com esforço razoável, com paradas para manutenção e melhorias sempre que possível fora dos horários de maior uso;",
            "tratar os dados pessoais conforme a LGPD e a Política de Privacidade, com medidas de segurança proporcionais aos riscos;",
            "não vender dados pessoais e não usá-los para publicidade de terceiros;",
            "avisar mudanças relevantes destes documentos e da Plataforma;",
            "comunicar a você e à Autoridade Nacional de Proteção de Dados (ANPD) incidentes de segurança que possam causar risco ou dano relevante, como exige a LGPD;",
            "manter canais de atendimento para suporte e para pedidos de privacidade.",
          ],
        },
      ],
    },
    {
      titulo: "10. Limites do serviço e de responsabilidade",
      blocos: [
        "10.1. Leituras automáticas (faturas, notas fiscais, Open Finance e IA) podem errar ou atrasar porque dependem de arquivos, bancos, órgãos públicos e provedores externos. Índices e projeções podem variar conforme a fonte e o período usados.",
        "10.2. O Control ALL não responde por:",
        {
          lista: [
            "decisões financeiras ou de qualquer natureza tomadas com base nas informações da Plataforma;",
            "falhas, atrasos, indisponibilidade ou dados incorretos de terceiros, como bancos e instituições conectadas, Pluggy, SEFAZ, Banco Central, Apple e provedores de nuvem;",
            "eventos fora do nosso controle razoável, como quedas gerais de internet ou de energia, ataques em larga escala e atos de autoridades;",
            "uso indevido da conta causado por descuido com senha, código de acesso ou aparelho;",
            "conteúdos de sites externos acessados por links.",
          ],
        },
        "10.3. Nada nestes Termos afasta direitos garantidos pelo Código de Defesa do Consumidor e pela LGPD.",
      ],
    },
    {
      titulo: "11. Assistente de IA",
      blocos: [
        "11.1. O assistente usa modelos de linguagem de um provedor externo (OpenAI). As respostas são geradas automaticamente e podem conter erros, inclusive em valores, datas e cálculos. Confira antes de usar e não trate a resposta como recomendação profissional.",
        "11.2. No app, a IA sugere e nada é salvo sem a sua confirmação. No site, um pedido direto de lançamento pode ser gravado na hora; ele aparece na lista para você conferir, editar ou excluir.",
        "11.3. Você continua dono do que envia e das respostas. Não usamos o seu conteúdo para treinar modelos de IA, e contratamos o provedor no modo de uso por API, no qual, pela política dele, o conteúdo enviado não é usado para treinar os modelos.",
        "11.4. É proibido usar a IA para atividades ilegais, para tentar obter dados de outras pessoas ou para sobrecarregar o serviço. Há limite diário de uso, e a administração pode suspender a IA de uma conta em caso de abuso.",
      ],
    },
    {
      titulo: "12. Open Finance",
      blocos: [
        "12.1. A conexão com bancos é opcional e só acontece com a sua autorização, dada no ambiente seguro da Pluggy Brasil Negócios Digitais Ltda. e da instituição financeira. O Control ALL não vê nem guarda senha bancária, código de segurança ou token do banco.",
        "12.2. O acesso é só de leitura: o Control ALL não movimenta dinheiro nem altera nada na sua conta bancária. Recebemos apenas os dados dentro do escopo que você autorizou: contas, saldos, transações, cartões, investimentos e empréstimos.",
        "12.3. Lançamentos vindos do banco ficam travados (valor e data) e prevalecem sobre a fatura importada, para não contar a mesma compra duas vezes.",
        "12.4. Você pode revogar a autorização a qualquer momento na própria instituição ou pedir a desconexão pelo suporte. Depois disso, novas sincronizações param; os lançamentos já importados continuam no seu grupo até você excluí-los.",
        "12.5. Dúvidas sobre saldos, transações ou serviços bancários devem ser tratadas diretamente com a instituição. Hoje o Open Finance é um recurso em teste, liberado só pela administração.",
      ],
    },
    {
      titulo: "13. Arquivos e documentos",
      blocos: [
        "13.1. Faturas, comprovantes, notas, fotos e documentos enviados ficam guardados para a função escolhida. Você declara ter o direito de enviá-los.",
        "13.2. Os arquivos ficam no armazenamento do Control ALL (Oracle Cloud, na região de São Paulo, ou Supabase). Se você conectar a sua própria conta do Google Drive, os arquivos ficam nela.",
        "13.3. Arquivos enviados só para ensinar o leitor de faturas um novo layout são usados apenas para essa análise e descartados em até 30 dias.",
      ],
    },
    {
      titulo: "14. Propriedade intelectual",
      blocos: [
        "14.1. A marca Control ALL, o software, o layout, os textos e os demais elementos da Plataforma pertencem ao Control ALL e são protegidos pela lei. Você recebe uma licença pessoal, limitada, não exclusiva, intransferível e revogável para usar a Plataforma conforme estes Termos.",
        "14.2. Os dados e conteúdos que você lança continuam seus. Você nos autoriza a tratá-los apenas para prestar o serviço, conforme a Política de Privacidade.",
      ],
    },
    {
      titulo: "15. Exclusão, suspensão e encerramento",
      blocos: [
        "15.1. Você pode excluir a conta a qualquer momento, no site ou no app, sem precisar justificar. A conta fica em carência de 90 dias, período em que pode ser recuperada ao entrar de novo; depois disso, os dados são apagados, salvo o que a lei obrigar a guardar.",
        "15.2. O Control ALL pode suspender ou encerrar uma conta em caso de violação destes Termos, uso fraudulento, risco à segurança da Plataforma ou de outros usuários, ou obrigação legal. Sempre que possível, avisaremos o motivo.",
        "15.3. Contas bloqueadas a pedido do titular só são reativadas pelo suporte, depois de confirmar a identidade.",
      ],
    },
    {
      titulo: "16. Comunicações",
      blocos: [
        "Enviamos e-mails e avisos necessários ao serviço: segurança da conta, convites, recuperação de senha, chamados de suporte e mudanças relevantes. Mensagens de novidades e divulgação só serão enviadas com a sua permissão e terão opção para parar de receber.",
      ],
    },
    {
      titulo: "17. Alterações destes Termos",
      blocos: [
        "Alterações relevantes serão avisadas no site e no app, e a data da versão em vigor fica no topo desta página. Se não concordar com a nova versão, você pode excluir a conta. Continuar usando o serviço depois do aviso significa concordar com a nova versão.",
      ],
    },
    {
      titulo: "18. Lei aplicável e foro",
      blocos: [
        "Estes Termos seguem as leis do Brasil. Fica eleito o foro do domicílio do usuário para resolver qualquer questão relacionada a eles.",
      ],
    },
    {
      titulo: "19. Contato",
      blocos: [
        "Dúvidas e suporte: contato@controlall.com.br. Privacidade e proteção de dados: privacidade@controlall.com.br.",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// POLÍTICA DE PRIVACIDADE
// ---------------------------------------------------------------------------------------------

export const PRIVACIDADE: DocumentoLegal = {
  id: "privacidade",
  titulo: "Política de Privacidade",
  versao: VERSAO_TEXTOS_LEGAIS,
  resumo: `O Control ALL (${SITE}), por meio do seu desenvolvedor responsável, é o controlador dos dados pessoais tratados no site e no app. Esta Política explica quais dados tratamos, para quê, com quem compartilhamos, por quanto tempo guardamos e como você exerce os seus direitos. Ela deve ser lida junto com os Termos de Uso e a Política de Cookies. Em resumo: não vendemos dados pessoais, não fazemos publicidade com eles e você controla quem do seu grupo vê o quê.`,
  secoes: [
    {
      titulo: "1. Conceitos básicos",
      blocos: [
        {
          lista: [
            "Dados pessoais: informação relacionada a pessoa natural identificada ou identificável.",
            "Dados pessoais sensíveis: dados sobre saúde, vida sexual, origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, dado genético ou biométrico.",
            "Titular: a pessoa a quem os dados se referem.",
            "Controlador: quem toma as decisões sobre o tratamento dos dados. No Control ALL, o desenvolvedor responsável pelo serviço.",
            "Operador: quem trata os dados em nome do controlador, como os provedores de nuvem.",
            "Tratamento: qualquer operação com dados pessoais, como coleta, uso, armazenamento, compartilhamento e exclusão.",
            "ANPD: Autoridade Nacional de Proteção de Dados, que fiscaliza o cumprimento da LGPD.",
            "Cookies e tecnologias semelhantes: pequenos arquivos ou registros guardados no navegador ou no aparelho. Os detalhes estão na Política de Cookies.",
          ],
        },
      ],
    },
    {
      titulo: "2. Quais dados tratamos e de onde vêm",
      blocos: [
        { sub: "Dados que você informa" },
        {
          lista: [
            "Cadastro: nome, e-mail, CPF, telefone e data de nascimento, além da data e da versão dos Termos e desta Política que você aceitou.",
            "Renda e jornada mensal, se você usar o cálculo de custo em horas.",
            "Tudo o que você lança nos módulos (lançamentos, cartões, investimentos, notas fiscais, lista de compras, veículos, pets, exames, anotações) e os arquivos que envia.",
            "Mensagens de texto e áudio enviadas ao assistente de IA.",
            "Chamados de suporte, pedidos de privacidade e as respostas.",
          ],
        },
        { sub: "Dados recebidos de terceiros" },
        {
          lista: [
            "Open Finance, por meio da Pluggy: contas, saldos, transações, cartões, investimentos e empréstimos que você autorizar na instituição.",
            "Notas fiscais: dados da nota consultados na página pública da SEFAZ a partir da chave de acesso que você informa.",
            "Convites: nome e e-mail informados por quem convidou você para um grupo.",
          ],
        },
        { sub: "Dados coletados automaticamente" },
        {
          lista: [
            "Acesso: endereço IP, data e hora, página aberta, aparelho e navegador, e local aproximado (cidade, estado e país) deduzido do IP.",
            "Origem da visita (por exemplo, o link de uma campanha), só para quem aceita as métricas no aviso de cookies.",
            "Segurança: logins, tentativas erradas, códigos de acesso, trocas de senha, bloqueios e registros de auditoria da administração.",
          ],
        },
        { sub: "Dados do aparelho (app para iPhone)" },
        {
          lista: [
            "Câmera, fotos e microfone só quando você usa a função (ler nota, anexar comprovante, falar com a IA).",
            "Face ID: a verificação acontece no aparelho, pela Apple. O Control ALL não recebe a sua biometria.",
            "Notificações: são agendadas no próprio aparelho.",
          ],
        },
        { sub: "O que não coletamos" },
        "Senha bancária, número completo de cartão, biometria e localização precisa (GPS). Dados de saúde só entram se você mesmo cadastrar exames.",
      ],
    },
    {
      titulo: "3. Para que usamos os dados e com qual base legal",
      blocos: [
        {
          tabela: {
            cabecalho: ["Finalidade", "Dados", "Base legal (LGPD)"],
            linhas: [
              ["Criar e manter a conta, autenticar e recuperar acesso", "Cadastro, credenciais e registros de segurança", "Execução de contrato"],
              ["Oferecer os módulos (lançamentos, importação, notas, listas, veículos, pets, calendário)", "O que você lança e os arquivos enviados", "Execução de contrato"],
              ["Conectar bancos pelo Open Finance", "Dados bancários autorizados", "Consentimento, dado na Pluggy e na instituição, e execução de contrato"],
              ["Responder ao assistente de IA", "Mensagens e resumo dos dados do grupo", "Execução de contrato (recurso pedido por você)"],
              ["Guardar exames", "Dados de saúde que você cadastra", "Consentimento do titular ou do responsável legal"],
              ["Proteger a conta, prevenir fraude, enviar alertas e bloquear acessos", "IP, aparelho, local aproximado e registros de segurança", "Legítimo interesse e prevenção à fraude e à segurança do titular"],
              ["Medir acessos e melhorar o site", "Página aberta, origem da visita e identificação anônima da visita", "Consentimento (aviso de cookies)"],
              ["Entender quais telas são usadas e melhorar o site e o app", "Nome da tela aberta, data e se foi no site ou no app, de quem está conectado. Sem IP, sem local e sem nenhum valor ou lançamento", "Legítimo interesse (melhoria do serviço)"],
              ["Atender suporte e pedidos de privacidade", "Contato, CPF e mensagens", "Execução de contrato e cumprimento de obrigação legal"],
              ["Cumprir a lei e defender direitos", "Registros de acesso e de atendimento", "Obrigação legal e exercício regular de direitos"],
            ],
          },
        },
      ],
    },
    {
      titulo: "4. Com quem compartilhamos",
      blocos: [
        "Não vendemos dados pessoais e não os compartilhamos para publicidade. Os dados só são compartilhados na medida necessária para o serviço funcionar:",
        {
          lista: [
            "Pessoas do seu grupo, conforme as permissões definidas pelo administrador do grupo.",
            "Supabase: banco de dados, autenticação e armazenamento de arquivos.",
            "Vercel: hospedagem do site e métricas de acesso sem cookies (só para quem aceita as métricas).",
            "Oracle Cloud: armazenamento de comprovantes, na região de São Paulo.",
            "Google Drive: só se você conectar a sua própria conta para guardar arquivos nela.",
            "Resend: envio de e-mails do serviço e de segurança.",
            "OpenAI: assistente de IA e transcrição de áudio.",
            "Pluggy: conexão do Open Finance.",
            "Apple e Expo: distribuição e atualização do app.",
            "SEFAZ: recebe a chave da nota quando você consulta uma nota fiscal.",
            "Autoridades públicas e Judiciário, quando a lei ou uma ordem judicial exigir.",
            "Em caso de venda, fusão ou reorganização da empresa, os dados podem ser transferidos ao sucessor, que deverá cumprir esta Política.",
          ],
        },
        "Esses provedores tratam os dados em nosso nome, só para as finalidades acima, e estão sujeitos a obrigações de segurança e confidencialidade. Cotação do dólar e índices do Banco Central são consultados sem enviar dados pessoais.",
      ],
    },
    {
      titulo: "5. Transferência internacional",
      blocos: [
        "Alguns provedores processam dados fora do Brasil, principalmente nos Estados Unidos (por exemplo, Vercel, Resend e OpenAI). Essas transferências seguem a LGPD, com base nas garantias contratuais de proteção de dados oferecidas pelos provedores.",
      ],
    },
    {
      titulo: "6. Por quanto tempo guardamos",
      blocos: [
        {
          lista: [
            "Dados da conta e o que você lança: enquanto a conta existir.",
            "Conta excluída: carência de 90 dias para recuperação; depois, os dados são apagados.",
            "Registros de acesso à Plataforma: pelo prazo mínimo de 6 meses exigido pelo Marco Civil da Internet e enquanto forem necessários para segurança.",
            "Arquivos enviados para análise de layout de fatura: até 30 dias.",
            "Conversas com o assistente de IA: não ficam gravadas no nosso banco de dados.",
            "Chamados e pedidos de privacidade: pelo tempo necessário para comprovar o atendimento.",
          ],
        },
        "Podemos guardar dados por mais tempo quando a lei exigir ou para exercer direitos em processos judiciais ou administrativos.",
      ],
    },
    {
      titulo: "7. Como protegemos os dados",
      blocos: [
        {
          lista: [
            "Conexão criptografada (HTTPS) entre o seu aparelho e a Plataforma, e criptografia em repouso nos provedores de armazenamento.",
            "Regras de acesso no banco de dados que separam os grupos.",
            "Senha guardada só em forma de hash, bloqueio após tentativas erradas e segundo fator por e-mail.",
            "Alertas por e-mail em pedidos e trocas de senha, com o botão \"Não fui eu\".",
            "Acesso administrativo restrito ao desenvolvedor responsável, com proteção adicional e registros de auditoria.",
          ],
        },
        "Somente o desenvolvedor responsável tem acesso técnico ao banco de dados. Esse acesso é usado em caráter de exceção: para manutenção, correção de problemas, suporte pedido por você ou cumprimento de obrigação legal. Senhas não ficam visíveis em nenhuma hipótese.",
        "Nenhum sistema é totalmente imune a falhas. Se acontecer um incidente de segurança que possa causar risco ou dano relevante, avisaremos você e a ANPD, como exige a LGPD.",
      ],
    },
    {
      titulo: "8. Cookies",
      blocos: [
        "O site usa armazenamento essencial do navegador (login e preferências) e, só com o seu aceite, métricas de acesso. Não usamos cookies de publicidade nem de rastreamento por terceiros. O app não usa cookies de navegador e não rastreia você em outros apps. Detalhes e escolhas na Política de Cookies.",
      ],
    },
    {
      titulo: "9. Seus direitos",
      blocos: [
        "A LGPD garante a você, a qualquer momento:",
        {
          lista: [
            "confirmação de que tratamos seus dados e acesso a eles;",
            "correção de dados incompletos, inexatos ou desatualizados (você também pode corrigir na tela Conta);",
            "anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;",
            "portabilidade dos dados a outro fornecedor;",
            "eliminação dos dados tratados com base no consentimento;",
            "informação sobre com quem compartilhamos os dados;",
            "informação sobre a possibilidade de não consentir e as consequências da recusa;",
            "revogação do consentimento;",
            "revisão de decisões tomadas só com base em tratamento automatizado que afetem seus interesses;",
            "reclamação à ANPD.",
          ],
        },
        "Para exercer seus direitos, use o formulário desta página ou escreva para privacidade@controlall.com.br. Para sua segurança, podemos pedir a confirmação da sua identidade. Respondemos em até 15 dias. A exclusão da conta também pode ser feita direto no site ou no app.",
      ],
    },
    {
      titulo: "10. Crianças e adolescentes",
      blocos: [
        "O Control ALL é destinado a maiores de 18 anos e não coleta intencionalmente dados de menores como usuários. Se você registrar dados de um filho menor (por exemplo, exames ou vacinas), faz isso como responsável legal, e esses dados recebem o mesmo cuidado dos dados sensíveis. Se soubermos que uma conta pertence a menor de 18 anos, ela poderá ser encerrada.",
      ],
    },
    {
      titulo: "11. Canal de privacidade",
      blocos: [
        "O Control ALL é um agente de tratamento de pequeno porte e, como permite o art. 11 da Resolução CD/ANPD nº 2/2022, não tem encarregado (DPO) formalmente designado. O canal de comunicação com titulares e com a ANPD é o e-mail privacidade@controlall.com.br, atendido pelo desenvolvedor responsável.",
      ],
    },
    {
      titulo: "12. Alterações e controle de versões",
      blocos: [
        "Esta Política pode ser atualizada. Mudanças relevantes serão avisadas no site e no app.",
        {
          tabela: {
            cabecalho: ["Data", "O que mudou"],
            linhas: [
              ["20/09/2026", "Primeira versão do Aviso de Privacidade."],
              ["24/10/2026", "Reescrita completa: dados tratados por origem, bases legais, provedores, transferência internacional, prazos de guarda, segurança, direitos e Política de Cookies separada."],
            ],
          },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// POLÍTICA DE COOKIES
// ---------------------------------------------------------------------------------------------

export const COOKIES: DocumentoLegal = {
  id: "cookies",
  titulo: "Política de Cookies",
  versao: VERSAO_TEXTOS_LEGAIS,
  resumo:
    "Cookies são pequenos arquivos que o site guarda no seu navegador para reconhecer o seu acesso. O Control ALL usa pouquíssimos: o essencial para você entrar e guardar preferências e, só se você aceitar, métricas de acesso. Não usamos cookies de publicidade. Abaixo está a lista completa e como mudar a sua escolha.",
  secoes: [
    {
      titulo: "1. O que são cookies e tecnologias semelhantes",
      blocos: [
        "Cookies são pequenos arquivos de texto que um site guarda no navegador. Tecnologias semelhantes, como o armazenamento local (localStorage) e o armazenamento da sessão (sessionStorage), fazem o mesmo papel: lembrar quem você é e o que escolheu. Nesta Política, chamamos tudo isso de cookies.",
      ],
    },
    {
      titulo: "2. Que tipos usamos",
      blocos: [
        {
          tabela: {
            cabecalho: ["Tipo", "Para que serve", "Usamos?"],
            linhas: [
              ["Essenciais", "Manter você conectado, proteger o acesso, guardar a sua escolha de cookies e preferências como idioma e tema. Sem eles o site não funciona direito.", "Sim, sempre ativos"],
              ["Desempenho e métricas", "Contar páginas visitadas e de onde veio a visita, para melhorar o site e medir a divulgação.", "Só se você aceitar"],
              ["Marketing e publicidade", "Mostrar anúncios conforme os seus interesses, dentro e fora do site.", "Não usamos"],
              ["Personalização por terceiros", "Recomendar produtos e conteúdos a partir do seu comportamento de navegação.", "Não usamos"],
            ],
          },
        },
      ],
    },
    {
      titulo: "3. Lista do que guardamos no seu navegador",
      blocos: [
        {
          tabela: {
            cabecalho: ["Nome", "Tecnologia", "Tipo", "Para que serve", "Duração"],
            linhas: [
              ["sb-…-auth-token", "Armazenamento local", "Essencial", "Mantém você conectado", "Até sair ou a sessão expirar"],
              ["control-all-aviso-privacidade", "Armazenamento local", "Essencial", "Guarda a sua escolha de cookies", "Até você limpar os dados do site"],
              ["control-all.idioma e textos traduzidos", "Armazenamento local", "Essencial (preferência)", "Lembra o idioma e carrega a tradução mais rápido", "Até você limpar os dados do site"],
              ["sidebar_state", "Cookie", "Essencial (preferência)", "Lembra se o menu lateral está aberto", "7 dias"],
              ["financas_ocultar_valores", "Armazenamento local", "Essencial (preferência)", "Lembra se os valores ficam ocultos na tela", "Até você limpar os dados do site"],
              ["control-all-identificador", "Armazenamento local", "Essencial (preferência)", "Lembra o e-mail ou CPF no login, quando você pede", "Até você limpar os dados do site"],
              ["Avisos já vistos e histórico do lançamento rápido", "Armazenamento local", "Essencial (preferência)", "Evita repetir avisos e guarda os seus últimos pedidos à IA só neste navegador", "Até você limpar os dados do site"],
              ["control-all-sessao-acesso", "Armazenamento da sessão", "Métricas", "Identificação anônima da visita", "Apagado ao fechar a aba"],
              ["control-all-origem-acesso", "Armazenamento da sessão", "Métricas", "Guarda a origem da visita (link de campanha)", "Apagado ao fechar a aba"],
              ["Vercel Web Analytics", "Sem cookie", "Métricas", "Conta páginas visitadas, sem guardar nada no seu aparelho", "Não se aplica"],
            ],
          },
        },
        "Quando você escolhe \"Só o essencial\" ou desliga as métricas, os itens de métricas deixam de ser usados.",
      ],
    },
    {
      titulo: "4. E no app?",
      blocos: [
        "O app para iPhone não usa cookies de navegador. A sessão fica guardada de forma segura no aparelho, e as preferências ficam no próprio app. O app não usa ferramentas de publicidade e não rastreia você em outros apps ou sites.",
      ],
    },
    {
      titulo: "5. Os cookies guardam meus dados pessoais?",
      blocos: [
        "O cookie de login identifica a sua sessão. As métricas usam uma identificação anônima da visita; se você estiver conectado, o acesso é associado à sua conta só para separar o tráfego da administração e proteger a conta. Tudo segue a LGPD e a Política de Privacidade.",
      ],
    },
    {
      titulo: "6. Como mudar a sua escolha",
      blocos: [
        {
          lista: [
            "Use o botão \"Preferências de cookies\" no rodapé do site ou nesta página para aceitar ou recusar as métricas a qualquer momento.",
            "Você também pode apagar ou bloquear cookies nas configurações do navegador (Chrome, Safari, Firefox ou Edge). Bloquear os essenciais impede o login.",
          ],
        },
      ],
    },
    {
      titulo: "7. Alterações e contato",
      blocos: [
        "Esta Política pode ser atualizada; a data da versão fica no topo. Dúvidas: privacidade@controlall.com.br.",
      ],
    },
  ],
};

export const DOCUMENTOS_LEGAIS = [TERMOS, PRIVACIDADE, COOKIES];
