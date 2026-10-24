import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { enviarSolicitacaoPrivacidade } from "@/lib/privacidade.functions";
import { consultarProtocolo } from "@/lib/central-solicitacoes.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DocumentoLegalView } from "@/components/DocumentoLegalView";
import { PRIVACIDADE } from "@/lib/textos-legais";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidCpf, onlyDigits, maskCpf } from "@/lib/cpf";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Control ALL" },
      {
        name: "description",
        content:
          "Política de Privacidade do Control ALL (site e app): dados tratados, finalidades, compartilhamento, prazos, segurança, cookies e como exercer seus direitos.",
      },
    ],
  }),
  component: PrivacidadePage,
});

const STATUS_LABEL: Record<string, string> = {
  recebida: "Recebida", recebido: "Recebido", em_modelagem: "Em Modelagem",
  corrigida: "Corrigida", descartada: "Descartada",
  em_analise: "Em Análise", em_atendimento: "Em Atendimento",
  aguardando_ti: "Aguardando TI", planejado: "Planejado", programado: "Programado",
  concluida: "Concluída", concluido: "Concluído", indeferida: "Indeferida",
  aguardando_usuario: "Aguardando usuário", resolvido: "Resolvido", cancelado: "Cancelado",
};

function PrivacidadePage() {
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
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="space-y-6 p-6 text-sm leading-6">
            <DocumentoLegalView doc={PRIVACIDADE} />
            <form onSubmit={submit} className="grid gap-3 border-t pt-5">
              <h2 className="font-semibold">Solicitar exclusão ou outro direito de privacidade</h2>
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
          </CardContent>
        </Card>

        <ConsultaProtocolo />
      </div>
      <SiteFooter />
    </main>
  );
}

/**
 * Consulta de status (2026-09-26): movida da home pra dentro de
 * Privacidade, junto do formulário de envio — a pessoa manda e consulta a
 * solicitação (de privacidade OU de suporte) no mesmo lugar, sem precisar
 * ir na home procurar.
 */
function ConsultaProtocolo() {
  const [modo, setModo] = useState<"protocolo" | "cpf">("protocolo");
  const [protocolo, setProtocolo] = useState("");
  const [cpf, setCpf] = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const consultarFn = useServerFn(consultarProtocolo);

  function formatarCpfInput(v: string) {
    return v.replace(/\D/g, "").slice(0, 11);
  }

  async function buscar() {
    const isProtocolo = modo === "protocolo";
    const val = isProtocolo ? protocolo.trim() : cpf.replace(/\D/g, "");
    if (!val) return;
    setCarregando(true);
    setBuscado(false);
    setResultado(null);
    try {
      const res = await consultarFn({
        data: isProtocolo ? { protocolo: val } : { cpf: val },
      });
      setResultado(res);
    } catch (e: any) {
      toast.error(e.message || "Não encontrado ou formato inválido.");
    } finally {
      setCarregando(false);
      setBuscado(true);
    }
  }

  const resultados = Array.isArray(resultado) ? resultado : resultado ? [resultado] : [];

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4 p-6 text-sm leading-6">
        <div>
          <p className="text-sm font-semibold text-primary">SUPORTE E PRIVACIDADE</p>
          <h2 className="mt-1 text-xl font-bold">Consultar status de solicitação</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o protocolo recebido ao enviar uma solicitação (de privacidade ou de suporte)
            ou consulte pelo seu CPF.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={modo === "protocolo" ? "default" : "outline"}
            onClick={() => { setModo("protocolo"); setBuscado(false); setResultado(null); }}
          >
            Por Protocolo
          </Button>
          <Button
            size="sm"
            variant={modo === "cpf" ? "default" : "outline"}
            onClick={() => { setModo("cpf"); setBuscado(false); setResultado(null); }}
          >
            Por CPF
          </Button>
        </div>

        <div className="flex max-w-md flex-col gap-3 sm:flex-row">
          {modo === "protocolo" ? (
            <Input
              placeholder="Cole o protocolo aqui (UUID)"
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
            />
          ) : (
            <Input
              placeholder="Somente os 11 dígitos do CPF"
              value={cpf}
              onChange={(e) => setCpf(formatarCpfInput(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              maxLength={11}
            />
          )}
          <Button
            onClick={buscar}
            disabled={carregando || (modo === "protocolo" ? !protocolo.trim() : cpf.replace(/\D/g, "").length < 11)}
          >
            <Search className="size-4 mr-1.5" />{carregando ? "Consultando…" : "Consultar"}
          </Button>
        </div>

        {buscado && (
          resultados.length > 0 ? (
            <div className="max-w-md space-y-3">
              {resultados.map((res: any, i: number) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-mono truncate">{res.protocolo}</p>
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shrink-0 ml-2">
                        {res.tipo === "privacidade" ? "Privacidade" : "Suporte"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 text-sm font-semibold">{STATUS_LABEL[res.status] ?? res.status}</span>
                      <span className="text-xs text-muted-foreground">{res.dias_aberto} dia(s) em aberto</span>
                    </div>
                    {res.resposta && <p className="text-sm text-muted-foreground italic">"{res.resposta}"</p>}
                    <p className="text-xs text-muted-foreground">Última atualização: {new Date(res.atualizado_em).toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada com esse {modo === "protocolo" ? "protocolo" : "CPF"}.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
