import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { enviarSolicitacaoPrivacidade } from "@/lib/privacidade.functions";

export function LegalDialogs({ compact = false }: { compact?: boolean }) {
  const [aberto, setAberto] = useState<"termos" | "privacidade" | null>(null);
  const [exibirFormLgpd, setExibirFormLgpd] = useState(false);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [motivo, setMotivo] = useState("");
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviarFn = useServerFn(enviarSolicitacaoPrivacidade);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const res = await enviarFn({
        data: { email, telefone, cpf, motivo: motivo || undefined },
      });
      setProtocolo(res.protocolo);
    } catch (err: any) {
      setErro(err?.message ?? "Não foi possível enviar a solicitação. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    setAberto(null);
    setExibirFormLgpd(false);
    setProtocolo(null);
    setErro(null);
  }

  const classe = compact
    ? "underline underline-offset-4"
    : "text-sm text-muted-foreground hover:text-foreground";

  return (
    <>
      <button type="button" className={classe} onClick={() => setAberto("termos")}>
        Termos{compact ? " de Uso" : ""}
      </button>
      <button type="button" className={classe} onClick={() => setAberto("privacidade")}>
        Privacidade{compact ? "" : ""}
      </button>

      <Dialog open={aberto === "termos"} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Termos de Uso</DialogTitle>
            <DialogDescription>Control ALL LTDA, versão 20/09/2026</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-6">
            <p>
              O Control ALL é uma ferramenta de organização pessoal e não substitui orientação
              financeira, contábil, médica, jurídica ou profissional.
            </p>
            <p>
              <b>Conta e segurança.</b> Você é responsável pelos dados inseridos, por proteger sua
              senha e por não compartilhar usuário, convite ou sessão.
            </p>
            <p>
              <b>Uso permitido.</b> Não é permitido acessar dados de terceiros, contornar controles de
              segurança, enviar arquivos maliciosos ou afetar a disponibilidade do serviço.
            </p>
            <p>
              <b>Dados e encerramento.</b> Você pode solicitar exclusão conforme o Aviso de
              Privacidade. A Control ALL LTDA pode suspender ou encerrar acessos em caso de risco,
              abuso, obrigação legal ou violação destes termos.
            </p>
          </div>
          <Button variant="outline" onClick={fechar}>
            Fechar
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={aberto === "privacidade"} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aviso de Privacidade & Solicitação LGPD</DialogTitle>
            <DialogDescription>Control ALL LTDA, versão 20/09/2026</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-6">
            <p>
              Tratamos dados necessários para criar a conta, oferecer módulos escolhidos, proteger
              acessos e melhorar a experiência. Não vendemos dados pessoais nem os compartilhamos
              para publicidade.
            </p>
            <p>
              Dados financeiros, documentos, fotos e informações de saúde são conteúdo privado. Exames
              são privados por padrão e só são compartilhados com familiares mediante escolha
              expressa.
            </p>
            <p>
              Você pode solicitar acesso, correção, anonimização, eliminação, informação sobre
              compartilhamento ou revisão do tratamento pelo canal{" "}
              <a className="underline" href="mailto:privacidade@controlall.com.br">
                privacidade@controlall.com.br
              </a>{" "}
              ou preenchendo o formulário de solicitação abaixo.
            </p>

            {protocolo ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-200">
                <p className="font-semibold">Solicitação registrada com sucesso!</p>
                <p className="mt-1 text-xs">
                  Seu número de protocolo é: <strong>{protocolo}</strong>
                </p>
                <p className="mt-2 text-xs opacity-90">
                  Nossa equipe de privacidade analisará seu pedido e responderá em até 15 dias.
                </p>
              </div>
            ) : exibirFormLgpd ? (
              <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <h3 className="font-semibold text-sm">Formulário de Solicitação de Privacidade</h3>
                {erro && <p className="text-xs text-destructive font-medium">{erro}</p>}
                <div>
                  <label className="text-xs font-medium">Seu E-mail *</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Telefone de contato *</label>
                  <Input
                    type="tel"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">CPF (somente números) *</label>
                  <Input
                    type="text"
                    required
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="12345678900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Detalhes / Motivo da solicitação</label>
                  <Textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Descreva o que deseja solicitar (ex.: exclusão de dados, confirmação de tratamento, etc.)"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExibirFormLgpd(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={enviando}>
                    {enviando ? "Enviando..." : "Registrar Solicitação"}
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setExibirFormLgpd(true)}>
                Abrir formulário de solicitação LGPD
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={fechar} className="mt-2">
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
