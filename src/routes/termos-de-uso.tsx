import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Control ALL" },
      {
        name: "description",
        content:
          "Termos de Uso do Control ALL: como funciona cada módulo do site e do app, quais dados são coletados e quem vê o quê.",
      },
    ],
  }),
  component: TermosPage,
});

// Rascunho detalhado de 2026-10-24 para revisão do Matheus antes de publicar.
// Pontos marcados com [CONFERIR] em comentário dependem de decisão ou verificação fora do código.

type Modulo = { nome: string; guarda: string; quemVe: string };

const MODULOS: Modulo[] = [
  {
    nome: "Despesas, receitas e lançamentos",
    guarda: "Descrição, valor, data, categoria, responsável, forma de pagamento, parcelas e observações que você informa.",
    quemVe: "Você e as pessoas do seu grupo com permissão de ver o módulo.",
  },
  {
    nome: "Cartões e bancos",
    guarda: "Apelido, bandeira, os 4 últimos dígitos, titular, limite e dia de fechamento e vencimento. Nunca o número completo do cartão nem senhas.",
    quemVe: "Você e as pessoas do seu grupo com permissão.",
  },
  {
    nome: "Importação de faturas",
    guarda: "O arquivo enviado (PDF, CSV ou texto) é lido para extrair os lançamentos, o total, o vencimento e o limite. Guardamos os lançamentos, o resumo da fatura e um backup quando uma fatura substitui outra.",
    quemVe: "Você e as pessoas do seu grupo com permissão de importar ou ver despesas.",
  },
  {
    nome: "Open Finance (Pluggy)",
    guarda: "Contas, saldos, transações, investimentos e empréstimos que o banco autorizar. A conexão é feita no ambiente seguro da Pluggy: sua senha bancária nunca passa pelo Control ALL. Lançamentos vindos do banco ficam travados (valor e data) e prevalecem sobre a fatura importada.",
    quemVe: "Recurso em teste, liberado só pela administração. Os dados importados ficam no seu grupo.",
  },
  {
    nome: "Investimentos e caixinhas",
    guarda: "Aplicações, valores aplicado e atual, rentabilidade informada, aportes, resgates e metas de poupança.",
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
    guarda: "Apelido, marca, modelo, ano, placa, chassi, Renavam, quilometragem, manutenções e custos.",
    quemVe: "Você e as pessoas do seu grupo com permissão.",
  },
  {
    nome: "Pets",
    guarda: "Dados do animal, vacinas, reforços e cuidados que você registra.",
    quemVe: "Você e as pessoas do seu grupo.",
  },
  {
    nome: "Exames",
    guarda: "Resultados de exames que você registra. São dados de saúde, considerados sensíveis pela LGPD: só entram se você mesmo cadastrar.",
    quemVe: "Você e as pessoas do seu grupo. Se não quiser que o grupo veja, não use este módulo em um grupo compartilhado.",
  },
  {
    nome: "Onde está, anotações com link e calculadoras",
    guarda: "Locais onde você guardou itens, anotações e links que você salvar. As calculadoras não guardam o que é calculado.",
    quemVe: "Você e as pessoas do seu grupo.",
  },
  {
    nome: "Assistente e lançamento com IA",
    guarda: "O texto ou áudio que você envia e um resumo dos dados do seu grupo necessários para responder (por exemplo, totais do mês, categorias e próximos vencimentos) são enviados ao provedor de IA só para gerar a resposta. A conversa do assistente não fica gravada no nosso banco. A IA sugere; nada é salvo sem a sua confirmação.",
    quemVe: "Só você vê a conversa. Há limite diário de uso, e a administração pode desativar a IA.",
  },
  {
    nome: "Calendário no iPhone e resumos compartilhados",
    guarda: "O link de assinatura do calendário é pessoal e assinado; quem tiver o link vê os eventos (vencimentos, receitas, garantias). Resumos compartilhados só saem quando você toca em compartilhar.",
    quemVe: "Quem receber o link ou o resumo que você enviar.",
  },
];

function TermosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="space-y-7 p-6 text-sm leading-6">
            <div>
              <h1 className="text-2xl font-bold">Termos de Uso</h1>
              <p className="text-muted-foreground">Control ALL LTDA, versão 24/10/2026</p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">1. O que é o Control ALL</h2>
              <p>
                O Control ALL é uma ferramenta de organização pessoal e familiar: finanças, documentos e
                rotina da casa. O site e o app para iPhone usam a mesma conta e os mesmos dados. As
                informações exibidas apoiam o seu controle e não substituem orientação financeira,
                contábil, médica, jurídica ou profissional. O Control ALL não é banco nem instituição
                financeira e não movimenta dinheiro.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">2. Conta, acesso e segurança</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Você entra com e-mail ou CPF e senha. A senha fica guardada de forma cifrada pelo provedor de autenticação; nem a administração consegue vê-la.</li>
                <li>Depois de 3 tentativas erradas, o acesso fica bloqueado por alguns minutos. Pode ser exigido um código enviado por e-mail (segundo fator).</li>
                <li>A sessão tem tempo máximo e pode ser encerrada por inatividade. No app, o Face ID e a senha salva ficam só no seu aparelho.</li>
                <li>Pedidos de troca de senha e alterações de senha geram um e-mail com aparelho, data, hora e local aproximado. Se não foi você, o botão "Não fui eu" bloqueia a conta na hora, com uma segunda confirmação; o desbloqueio é feito só pelo suporte, depois de confirmar sua identidade.</li>
                <li>Você é responsável pelos dados que insere, por manter a senha em sigilo e por não compartilhar usuário, senha, convite ou sessão. Acesso indevido deve ser comunicado a <a className="underline" href="mailto:contato@controlall.com.br">contato@controlall.com.br</a>.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">3. Grupo: quem vê o quê</h2>
              <p>
                Cada conta pertence a um grupo (por exemplo, você e sua família). Os dados lançados ficam
                no grupo, não na pessoa. Quem administra o grupo define, para cada pessoa e cada módulo, se
                ela pode ver, editar ou excluir. Pessoas de outros grupos nunca veem os seus dados: o banco
                de dados separa os grupos em todas as consultas.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Ao aceitar um convite para o grupo de outra pessoa, você passa a ver e lançar nos dados daquele grupo. Ao sair, volta para o seu grupo original.</li>
                <li>"Ocultar valores" esconde os números só na tela do seu aparelho; não muda o que os outros veem.</li>
                <li>Módulos desligados pela administração do site não aparecem para os usuários.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">4. Módulos, dados guardados e visibilidade</h2>
              <div className="space-y-3">
                {MODULOS.map((m) => (
                  <div key={m.nome} className="rounded-lg border p-3">
                    <h3 className="font-semibold">{m.nome}</h3>
                    <p><span className="text-muted-foreground">O que guarda: </span>{m.guarda}</p>
                    <p><span className="text-muted-foreground">Quem vê: </span>{m.quemVe}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">5. Dados coletados</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Cadastro:</strong> nome, e-mail, CPF (opcional), telefone e data de nascimento, se você informar; renda e jornada mensal, se usar o cálculo de custo em horas.</li>
                <li><strong>O que você lança:</strong> tudo o que for registrado nos módulos acima, inclusive arquivos enviados.</li>
                <li><strong>Acesso ao site:</strong> página aberta, endereço IP, local aproximado (cidade e país), aparelho e origem do acesso. Quem escolhe "só o essencial" nos cookies não entra nas métricas de acesso.</li>
                <li><strong>Segurança:</strong> tentativas de login, códigos de acesso, trocas de senha, bloqueios e registros de auditoria da administração.</li>
                <li><strong>App para iPhone:</strong> câmera, fotos e microfone só quando você usa a função (ler nota, anexar comprovante, falar com a IA). Notificações são agendadas no próprio aparelho.</li>
                <li><strong>Atendimento:</strong> chamados de suporte, solicitações de privacidade e respostas.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">6. O que é visível e o que não é</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Visível para o seu grupo:</strong> os dados dos módulos, conforme as permissões de cada pessoa.</li>
                <li><strong>Visível para a administração do site:</strong> dados de cadastro, situação da conta, registros de acesso e de segurança e chamados de suporte. Dados financeiros e documentos são acessados só para atender um pedido seu de suporte ou por obrigação legal.</li>
                {/* [CONFERIR] Matheus: confirmar a regra de acesso da administração aos dados financeiros. */}
                <li><strong>Nunca visível:</strong> sua senha do Control ALL, senhas bancárias (Open Finance), dados do Face ID e o número completo de cartões.</li>
                <li><strong>Empresas que nos ajudam a operar o serviço</strong> (só para isso, sem venda de dados nem publicidade): Supabase (banco de dados e autenticação), Vercel (hospedagem do site), Resend (envio de e-mails), OpenAI (IA), Pluggy (Open Finance), Expo e Apple (distribuição e atualização do app).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">7. Uso permitido</h2>
              <p>
                Não é permitido usar o serviço para atividade ilegal, tentar acessar dados de terceiros,
                contornar controles de segurança, enviar arquivos maliciosos ou afetar a disponibilidade do
                sistema.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">8. Limites do serviço</h2>
              <p>
                Leituras automáticas (faturas, notas fiscais, Open Finance e IA) podem errar ou atrasar
                porque dependem de arquivos, bancos e órgãos externos. Confira os valores antes de tomar
                decisões. Lançamentos sugeridos pela IA só são salvos depois da sua confirmação.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">9. Exclusão e encerramento</h2>
              <p>
                Você pode pedir a exclusão da conta no site ou no app. A conta fica em carência de 90 dias,
                período em que pode ser recuperada; depois disso, os dados são apagados conforme o Aviso de
                Privacidade. A Control ALL LTDA pode suspender ou encerrar acessos em caso de risco, abuso,
                obrigação legal ou violação destes termos. Contas administrativas têm proteção adicional
                contra exclusão acidental.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">10. Alterações e contato</h2>
              <p>
                Alterações relevantes serão apresentadas no site e no app para aceite. O uso após o aceite
                registra a concordância com a versão informada. Dúvidas:{" "}
                <a className="underline" href="mailto:contato@controlall.com.br">contato@controlall.com.br</a>{" "}
                ou{" "}
                <a className="underline" href="mailto:privacidade@controlall.com.br">privacidade@controlall.com.br</a>.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
