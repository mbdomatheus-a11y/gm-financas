import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Copy, Lock, ShieldCheck, Timer } from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { TURNSTILE_ATIVO } from "@/lib/turnstile-config";
import { criarLinkTemporario } from "@/lib/links-temporarios.functions";
import { criptografar } from "@/lib/links-temporarios-crypto";

const LIMITE_TEXTO = 10_000;

export const Route = createFileRoute("/links-temporarios/")({
  head: () => ({
    meta: [
      { title: "Link temporário e seguro | Control ALL" },
      {
        name: "description",
        content:
          "Envie uma mensagem de texto por um link único que se apaga depois de ser aberto. Criptografia opcional por senha, sem cadastro.",
      },
      { property: "og:title", content: "Link temporário e seguro | Control ALL" },
    ],
    links: [{ rel: "canonical", href: "https://www.controlall.com.br/links-temporarios" }],
  }),
  component: LinksTemporariosPage,
});

function LinksTemporariosPage() {
  const criar = useServerFn(criarLinkTemporario);
  const [texto, setTexto] = useState("");
  const [usarSenha, setUsarSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [aberturasMax, setAberturasMax] = useState<"1" | "2" | "3">("1");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);

  const podeGerar =
    texto.trim().length > 0 &&
    texto.length <= LIMITE_TEXTO &&
    (!usarSenha || senha.length >= 4) &&
    (!TURNSTILE_ATIVO || !!turnstileToken) &&
    !gerando;

  async function gerarLink() {
    setGerando(true);
    try {
      let payload: { conteudo: string; criptografado: boolean; salt?: string; iv?: string };
      if (usarSenha) {
        const cifrado = await criptografar(texto, senha);
        payload = { conteudo: cifrado.conteudo, criptografado: true, salt: cifrado.salt, iv: cifrado.iv };
      } else {
        payload = { conteudo: texto, criptografado: false };
      }
      const res = await criar({
        data: {
          ...payload,
          aberturasMax: Number(aberturasMax) as 1 | 2 | 3,
          turnstileToken: turnstileToken ?? undefined,
        },
      });
      const url = `${window.location.origin}/links-temporarios/${res.id}`;
      setLinkGerado(url);
      setTexto("");
      setSenha("");
      setUsarSenha(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o link.");
    } finally {
      setGerando(false);
    }
  }

  async function copiarLink() {
    if (!linkGerado) return;
    try {
      await navigator.clipboard.writeText(linkGerado);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar — copie manualmente.");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <BrandMark className="size-8" />
            Control ALL
          </Link>
          <Link to="/entrar" className="text-sm font-medium text-primary">
            Entrar
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Lock className="size-4" /> FERRAMENTA GRATUITA
        </p>
        <h1 className="mt-3 text-4xl font-bold">Link de mensagem temporária</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Escreva um texto, gere um link único e envie pra quem precisa ler. A mensagem se
          apaga do servidor depois do número de aberturas que você escolher (1 a 3) ou em 7
          dias sem ser aberta — o que vier primeiro. Sem cadastro.
        </p>

        {linkGerado ? (
          <Card className="mt-8 border-primary/40 bg-primary/5">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <ShieldCheck className="size-5" /> Link gerado
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3">
                <p className="min-w-0 flex-1 truncate font-mono text-sm">{linkGerado}</p>
                <Button size="sm" variant="outline" onClick={copiarLink}>
                  <Copy className="size-3.5" /> Copiar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Esta é a única vez que o link aparece aqui — não fica salvo em nenhuma conta.
                Se você definiu uma senha, combine-a com a pessoa por outro canal (nunca pelo
                mesmo link). Cada abertura da página consome uma das aberturas permitidas, mesmo
                que a senha seja digitada errada da primeira vez.
              </p>
              <Button variant="outline" size="sm" onClick={() => setLinkGerado(null)}>
                Criar outro link
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardContent className="space-y-4 p-5 sm:p-7">
              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={LIMITE_TEXTO}
                  rows={8}
                  placeholder="Escreva o texto que você quer enviar…"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {texto.length}/{LIMITE_TEXTO} caracteres
                </p>
              </div>

              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <Checkbox checked={usarSenha} onCheckedChange={(v) => setUsarSenha(v === true)} />
                <span>
                  Proteger com senha (criptografia no seu navegador — a senha nunca é enviada ao
                  servidor; combine-a com quem vai ler por outro meio, como uma ligação ou
                  mensagem separada)
                </span>
              </label>
              {usarSenha && (
                <div className="space-y-1.5">
                  <Label>Senha (mínimo 4 caracteres)</Label>
                  <Input
                    type="text"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Combine com quem vai receber"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Timer className="size-4" /> Quantas vezes pode ser aberto
                </Label>
                <Select value={aberturasMax} onValueChange={(v) => setAberturasMax(v as "1" | "2" | "3")}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 vez</SelectItem>
                    <SelectItem value="2">2 vezes</SelectItem>
                    <SelectItem value="3">3 vezes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {TURNSTILE_ATIVO && <TurnstileWidget onVerify={setTurnstileToken} />}

              <Button className="w-full" disabled={!podeGerar} onClick={gerarLink}>
                {gerando ? "Gerando…" : "Gerar link"}
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="mt-10 max-w-2xl space-y-3 text-sm leading-7">
          <h2 className="text-xl font-semibold">Como funciona</h2>
          <p>
            O texto fica guardado só até ser aberto o número de vezes escolhido, ou por até 7
            dias se ninguém abrir. Depois disso, é apagado definitivamente — não fica em nenhum
            backup. Quando você escolhe uma senha, o texto é cifrado no seu próprio navegador
            antes de ser enviado; o servidor nunca vê a senha nem o conteúdo original nesse caso.
          </p>
          <p className="text-muted-foreground">
            Fica registrado apenas que um link foi criado e quando foi aberto — nunca o conteúdo
            da mensagem.
          </p>
        </section>
      </div>
    </main>
  );
}
