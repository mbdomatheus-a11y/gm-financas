import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Control ALL" },
      { name: "description", content: "Termos de Uso do Control ALL." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="space-y-6 p-6 text-sm leading-6">
            <div>
              <h1 className="text-2xl font-bold">Termos de Uso</h1>
              <p className="text-muted-foreground">Control ALL LTDA, versão 20/09/2026</p>
            </div>
            <p>
              O Control ALL é uma ferramenta de organização pessoal. As informações exibidas são
              apoio ao controle do usuário e não substituem orientação financeira, contábil,
              médica, jurídica ou profissional.
            </p>
            <section>
              <h2 className="font-semibold">Conta e segurança</h2>
              <p>
                Você é responsável pela veracidade dos dados inseridos, por manter sua senha sob
                sigilo e por não compartilhar usuário, senha, convite ou sessão. O acesso indevido
                deve ser comunicado imediatamente para{" "}
                <a className="underline" href="mailto:contato@controlall.com.br">
                  contato@controlall.com.br
                </a>
                .
              </p>
            </section>
            <section>
              <h2 className="font-semibold">Uso permitido</h2>
              <p>
                Não é permitido usar o serviço para atividade ilegal, tentar acessar dados de
                terceiros, contornar controles de segurança, enviar arquivos maliciosos ou afetar
                a disponibilidade do sistema.
              </p>
            </section>
            <section>
              <h2 className="font-semibold">Dados e encerramento</h2>
              <p>
                Você pode solicitar exclusão conforme o Aviso de Privacidade. A Control ALL LTDA
                poderá suspender ou encerrar acessos em caso de risco, abuso, obrigação legal ou
                violação destes termos. Contas administrativas possuem proteção adicional contra
                exclusão acidental.
              </p>
            </section>
            <section>
              <h2 className="font-semibold">Alterações</h2>
              <p>
                Alterações relevantes serão apresentadas no aplicativo para aceite. O uso após o
                aceite registra a concordância com a versão informada.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
