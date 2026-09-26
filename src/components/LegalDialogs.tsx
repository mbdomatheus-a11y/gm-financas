import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { enviarSolicitacaoPrivacidade } from "@/lib/privacidade.functions";
import { isValidCpf, onlyDigits, maskCpf } from "@/lib/cpf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Links para Termos de Uso e Aviso de Privacidade. Abrem em um popup
 * (Dialog) por cima da página atual — nunca navegam pra outra página —
 * pra manter o usuário sempre com o menu/contexto atual visível
 * (revertido em 2026-09-26 a pedido do proprietário: a versão anterior,
 * que navegava para /termos-de-uso e /privacidade em nova aba, tirava a
 * pessoa do fluxo).
 */
export function LegalDialogs({ compact = false }: { compact?: boolean }) {
  const classe = compact
    ? "underline underline-offset-4"
    : "text-sm text-muted-foreground hover:text-foreground";

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className={classe}>
            Termos{compact ? " de Uso" : ""}
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Termos de Uso</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm leading-6">
            <p className="text-muted-foreground">Control ALL LTDA, versão 20/09/2026</p>
            <p>
              O Control ALL é uma ferramenta de organização pessoal. As informações exibidas são
              apoio ao controle do usuário e não substituem orientação financeira, contábil,
              médica, jurídica ou profissional.
            </p>
            <section>
              <h3 className="font-semibold">Conta e segurança</h3>
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
              <h3 className="font-semibold">Uso permitido</h3>
              <p>
                Não é permitido usar o serviço para atividade ilegal, tentar acessar dados de
                terceiros, contornar controles de segurança, enviar arquivos maliciosos ou afetar
                a disponibilidade do sistema.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">Dados e encerramento</h3>
              <p>
                Você pode solicitar exclusão conforme o Aviso de Privacidade. A Control ALL LTDA
                poderá suspender ou encerrar acessos em caso de risco, abuso, obrigação legal ou
                violação destes termos. Contas administrativas possuem proteção adicional contra
                exclusão acidental.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">Alterações</h3>
              <p>
                Alterações relevantes serão apresentadas no aplicativo para aceite. O uso após o
                aceite registra a concordância com a versão informada.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className={classe}>
            Privacidade
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aviso de Privacidade</DialogTitle>
          </DialogHeader>
          <PrivacidadeConteudo />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PrivacidadeConteudo() {
  const enviar = useServerFn(enviarSolicitacaoPrivacidade);
  const [f, setF] = useState({ email: "", telefone: "", cpf: "", motivo: "" });
  const [enviando, setEnviando] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!isValidCpf(f.cpf)) {
      toast.error("Informe um CPF válido.");
      return;
    }
    setEnviando(true);
    try {
      const r = await enviar({ data: { ...f, cpf: onlyDigits(f.cpf) } });
      toast.success(`Solicitação registrada. Protocolo: ${r.protocolo}`);
      setF({ email: "", telefone: "", cpf: "", motivo: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6 text-sm leading-6">
      <p className="text-muted-foreground">Control ALL LTDA, versão 20/09/2026</p>
      <p>
        Tratamos os dados necessários para criar a conta, oferecer os módulos escolhidos, proteger
        acessos, atender solicitações e melhorar a experiência. Não vendemos dados pessoais nem os
        compartilhamos com terceiros para publicidade.
      </p>
      <p>
        Dados financeiros, documentos, fotos e informações de saúde são tratados como conteúdo
        privado do usuário. Exames são privados por padrão e só podem ser compartilhados com
        familiares por escolha expressa. Arquivos enviados para análise de layout de fatura são
        usados exclusivamente para modelagem técnica e têm descarte previsto em até 30 dias.
      </p>
      <p>
        Você pode solicitar confirmação, acesso, correção, anonimização, eliminação, informação
        sobre compartilhamento ou revisão do tratamento. Para segurança, pedimos e-mail, telefone e
        CPF no formulário abaixo. Canal de privacidade:{" "}
        <a className="underline" href="mailto:privacidade@controlall.com.br">
          privacidade@controlall.com.br
        </a>
        .
      </p>
      <form onSubmit={submit} className="grid gap-3 border-t pt-5">
        <h3 className="font-semibold">Solicitar exclusão ou outro direito de privacidade</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              value={f.telefone}
              onChange={(e) => setF({ ...f, telefone: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <Label>CPF</Label>
          <Input
            inputMode="numeric"
            value={maskCpf(f.cpf)}
            onChange={(e) => setF({ ...f, cpf: onlyDigits(e.target.value).slice(0, 11) })}
            required
          />
        </div>
        <div>
          <Label>Motivo ou detalhe</Label>
          <Textarea value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
        </div>
        <Button disabled={enviando}>{enviando ? "Enviando…" : "Enviar solicitação"}</Button>
      </form>
    </div>
  );
}
