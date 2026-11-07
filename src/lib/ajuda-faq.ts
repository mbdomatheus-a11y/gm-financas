/**
 * Central de ajuda (07/11/2026). Perguntas escritas a partir do que o app faz hoje
 * (rotas e textos das telas). Ao mudar uma tela, revise a resposta correspondente.
 */
export type PerguntaFaq = { id: string; pergunta: string; resposta: string };
export type TemaFaq = { id: string; titulo: string; perguntas: PerguntaFaq[] };

export const AJUDA_FAQ: TemaFaq[] = [
  {
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    perguntas: [
      {
        id: "por-onde-comecar",
        pergunta: "Por onde começo?",
        resposta:
          "Cadastre seus cartões e contas em Cartões, depois lance ou importe as despesas e receitas do mês. A tela Início junta tudo na Previsão do mês.",
      },
      {
        id: "categorias",
        pergunta: "Posso criar minhas próprias categorias?",
        resposta:
          "Sim. Em Categorias você cria, edita e remove categorias de receitas e despesas. Elas aparecem nos lançamentos e nos gráficos de Para onde vai.",
      },
      {
        id: "mes-do-sistema",
        pergunta: "Meu mês não começa no dia 1. Dá para ajustar?",
        resposta:
          "Sim. Em Conta, ative o mês do sistema e escolha o dia de virada (de 1 a 28). Os totais e a Previsão do mês passam a seguir esse ciclo.",
      },
      {
        id: "assistente",
        pergunta: "Existe um assistente para tirar dúvidas sobre os meus números?",
        resposta:
          "Sim. O ControlIA responde por texto ou voz perguntas como \"o que tenho em aberto para pagar este mês?\" e pode abrir a tela certa para você.",
      },
    ],
  },
  {
    id: "lancamentos",
    titulo: "Lançamentos",
    perguntas: [
      {
        id: "tipos-despesa",
        pergunta: "Qual a diferença entre despesa fixa, parcelada e variável?",
        resposta:
          "Fixa se repete todo mês (com ou sem prazo para acabar), parcelada divide o valor em parcelas com vencimento próprio e variável é o gasto do dia a dia.",
      },
      {
        id: "receita-recorrente",
        pergunta: "Como cadastro um salário que entra todo mês?",
        resposta:
          "Em Receitas, marque a receita como recorrente e defina por quantos meses ela se repete, ou deixe sem prazo. Ela já entra na Previsão dos próximos meses.",
      },
      {
        id: "editar-fixa",
        pergunta: "Mudou o valor de uma conta fixa. Preciso apagar e criar de novo?",
        resposta:
          "Não. Dá para ajustar a fixa a partir da competência da mudança, e os meses anteriores continuam com o valor antigo.",
      },
      {
        id: "pagar-parcela",
        pergunta: "Como marco uma parcela como paga?",
        resposta:
          "Em Despesas você acompanha e marca as parcelas pagas. As pagas saem dos avisos de vencimento do sino.",
      },
    ],
  },
  {
    id: "cartoes-faturas",
    titulo: "Cartões e faturas",
    perguntas: [
      {
        id: "fechamento-vencimento",
        pergunta: "Para que servem os dias de fechamento e vencimento?",
        resposta:
          "Eles definem em qual fatura cada compra cai e quando a fatura deve ser paga. O sino avisa quando a fatura está para fechar ou vencer.",
      },
      {
        id: "fatura-do-mes",
        pergunta: "Onde vejo o total da fatura de cada cartão?",
        resposta:
          "Em Cartões cada cartão mostra a fatura do mês. As faturas importadas ficam registradas por competência em Importar.",
      },
      {
        id: "substituir-fatura",
        pergunta: "Importei a fatura de novo. Os lançamentos duplicam?",
        resposta:
          "Não. Se o cartão já tem fatura no mês, o app oferece substituir a anterior e avisa quando ela tinha lançamentos que a nova não traz. Dá para desfazer a substituição depois.",
      },
    ],
  },
  {
    id: "previsao",
    titulo: "Previsão do mês",
    perguntas: [
      {
        id: "o-que-entra",
        pergunta: "O que entra na Previsão do mês?",
        resposta:
          "Receitas do mês (com as recorrentes já projetadas), despesas comprometidas como fixas, parcelas e faturas, o valor a guardar nas caixinhas e o ritmo dos gastos variáveis.",
      },
      {
        id: "proximo-ciclo",
        pergunta: "Posso planejar o próximo mês antes de ele começar?",
        resposta:
          "Sim. No Início, a Previsão do mês alterna entre o ciclo atual e o próximo.",
      },
      {
        id: "previsao-diferente",
        pergunta: "Por que a previsão muda ao longo do mês?",
        resposta:
          "Porque ela acompanha o que você lança. Cada despesa ou receita nova, e cada parcela paga, atualiza a conta na hora.",
      },
    ],
  },
  {
    id: "caixinhas",
    titulo: "Caixinhas",
    perguntas: [
      {
        id: "o-que-sao",
        pergunta: "O que é uma caixinha?",
        resposta:
          "É um objetivo para guardar dinheiro, como uma viagem ou a reserva de emergência. Você define quanto guardar por mês, o mês de início e, se quiser, o mês final.",
      },
      {
        id: "aporte",
        pergunta: "Como registro que guardei o dinheiro do mês?",
        resposta:
          "Na tela Caixinhas, marque o aporte do mês. O histórico mostra os meses em que a meta foi atingida e os que ficaram faltando.",
      },
      {
        id: "previsao-caixinha",
        pergunta: "A caixinha afeta a Previsão do mês?",
        resposta:
          "Sim. O valor a guardar no mês entra na Previsão, para mostrar quanto sobra de verdade.",
      },
    ],
  },
  {
    id: "importar",
    titulo: "Importar faturas",
    perguntas: [
      {
        id: "formatos",
        pergunta: "Quais arquivos posso importar?",
        resposta:
          "Faturas em PDF (inclusive com senha), planilhas e prints. Também dá para colar o texto dos lançamentos, uma linha por lançamento com data, descrição e valor.",
      },
      {
        id: "revisao",
        pergunta: "Os lançamentos entram direto nas despesas?",
        resposta:
          "Não. Antes de confirmar, você revisa tudo linha a linha numa prévia editável, com a categoria já sugerida. Só depois de confirmar eles viram despesas.",
      },
      {
        id: "de-para",
        pergunta: "Como faço o app acertar a categoria sozinho?",
        resposta:
          "Em De-para, envie a planilha estabelecimento e categoria. As próximas importações passam a usar essas regras.",
      },
      {
        id: "arquivo",
        pergunta: "O arquivo da fatura fica guardado?",
        resposta:
          "Não. O arquivo é processado e descartado. Só os lançamentos são guardados.",
      },
    ],
  },
  {
    id: "notas",
    titulo: "Notas fiscais",
    perguntas: [
      {
        id: "como-guardar",
        pergunta: "Como guardo uma nota fiscal?",
        resposta:
          "Em Notas, tire uma foto ou leia o QR Code da nota. O app busca a chave de acesso e os itens automaticamente; se a consulta falhar, você preenche à mão.",
      },
      {
        id: "garantia",
        pergunta: "O app avisa quando a garantia vai acabar?",
        resposta:
          "Sim. Informe o fim da garantia na nota e o sino avisa quando faltarem 30 dias. No app do celular também chega um lembrete 7 dias antes.",
      },
      {
        id: "agrupar",
        pergunta: "Dá para organizar as notas por assunto?",
        resposta:
          "Sim. Crie agrupamentos como Casa ou Carro. Excluir um agrupamento não apaga as notas.",
      },
      {
        id: "drive",
        pergunta: "Posso guardar os comprovantes no Google Drive?",
        resposta:
          "Sim. Conecte o Google Drive em Notas e os comprovantes vão para uma pasta no seu Drive. Sem conexão, os arquivos ficam privados no site.",
      },
    ],
  },
  {
    id: "familia",
    titulo: "Compartilhar com a família",
    perguntas: [
      {
        id: "convidar",
        pergunta: "Como chamo outra pessoa para usar comigo?",
        resposta:
          "Envie um convite para o seu grupo. Quem aceitar passa a ver e lançar nos mesmos dados, como despesas, receitas e cartões.",
      },
      {
        id: "sair-grupo",
        pergunta: "Entrei no grupo de outra pessoa. Consigo voltar?",
        resposta:
          "Sim. Ao sair do grupo você volta para o seu grupo original, com os seus dados.",
      },
      {
        id: "resumo",
        pergunta: "Dá para mandar um resumo no WhatsApp?",
        resposta:
          "Sim. Em Compartilhar, gere um resumo ou uma imagem das finanças, da lista de compras, das notas fiscais ou dos veículos e envie ou salve.",
      },
    ],
  },
  {
    id: "privacidade",
    titulo: "Privacidade e conta",
    perguntas: [
      {
        id: "ocultar-valores",
        pergunta: "Posso esconder os valores da tela?",
        resposta:
          "Sim. Use o olho para ocultar os valores em R$ no app todo; cada caixa também tem o próprio olho.",
      },
      {
        id: "senha",
        pergunta: "Como troco minha senha?",
        resposta: "Em Conta você vê seus dados de acesso, altera a senha e encerra a sessão.",
      },
      {
        id: "exportar",
        pergunta: "Consigo baixar todos os meus dados?",
        resposta:
          "Sim. Em Backup, exporte despesas, receitas, cartões, caixinhas e investimentos em planilha CSV, que abre no Excel.",
      },
      {
        id: "excluir-conta",
        pergunta: "Como excluo minha conta?",
        resposta:
          "A opção de excluir a conta fica em Backup, para quem administra a conta. A exclusão é definitiva, então baixe seus dados antes.",
      },
    ],
  },
];

/** Normaliza para busca sem acento e sem diferença de maiúsculas. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarFaq(busca: string): TemaFaq[] {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return AJUDA_FAQ;
  return AJUDA_FAQ.map((tema) => ({
    ...tema,
    perguntas: tema.perguntas.filter((p) => {
      const alvo = normalizarBusca(`${tema.titulo} ${p.pergunta} ${p.resposta}`);
      return termos.every((t) => alvo.includes(t));
    }),
  })).filter((tema) => tema.perguntas.length > 0);
}
