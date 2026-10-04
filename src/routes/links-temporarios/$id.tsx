import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Eye, EyeOff, Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abrirLinkTemporario } from "@/lib/links-temporarios.functions";
import { descriptografar } from "@/lib/links-temporarios-crypto";

/**
 * Página pública de leitura do link temporário (item 6 do backlog).
 *
 * Importante: NÃO busca o conteúdo automaticamente ao carregar a página —
 * exige um clique explícito em "Revelar mensagem" antes de chamar
 * `abrirLinkTemporario`. Isso evita que bots de pré-visualização de link
 * (WhatsApp, Slack, iMessage etc., que abrem a URL só para gerar uma
 * miniatura) consumam sozinhos a única abertura permitida antes que a
 * pessoa destinatária veja a mensagem.
 *
 * Cada clique em "Revelar" chama o servidor uma única vez e consome uma
 * abertura, mesmo que o conteúdo esteja criptografado e a senha ainda não
 * tenha sido digitada. Depois disso, tentar senhas diferentes é só
 * decodificação local (o texto cifrado já está na memória do navegador) —
 * não gera novas chamadas ao servidor nem consome mais aberturas.
 */

type EstadoRevelacao =
  | { fase: "inicial" }
  | { fase: "carregando" }
  | { fase: "nao_encontrado" }
  | { fase: "expirado" }
  | { fase: "esgotado" }
  | {
      fase: "revelado";
      criptografado: boolean;
      conteudo: string;
      salt: string | null;
      iv: string | null;
      aberturasRestantes: number;
      textoDecifrado?: string | undefined;
      erroSenha?: string | undefined;
    };

export const Route = createFileRoute("/links-temporarios/$id")({
  head: () => ({
    meta: [
      { title: "Mensagem temporária | Control ALL" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LinkTemporarioViewerPage,
});

function LinkTemporarioViewerPage() {
  const { id } = Route.useParams();
  const abrir = useServerFn(abrirLinkTemporario);
  const [estado, setEstado] = useState<EstadoRevelacao>({ fase: "inicial" });
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [decifrando, setDecifrando] = useState(false);

  async function revelar() {
    setEstado({ fase: "carregando" });
    try {
      const res = await abrir({ data: { id } });
      if (res.status === "nao_encontrado") {
        setEstado({ fase: "nao_encontrado" });
        return;
      }
      if (res.status === "expirado") {
        setEstado({ fase: "expirado" });
        return;
      }
      if (res.status === "esgotado") {
        setEstado({ fase: "esgotado" });
        return;
      }
      setEstado({
        fase: "revelado",
        criptografado: res.criptografado,
        conteudo: res.conteudo,
        salt: res.salt,
        iv: res.iv,
        aberturasRestantes: res.aberturasRestantes,
        textoDecifrado: res.criptografado ? undefined : res.conteudo,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o link.");
      setEstado({ fase: "inicial" });
    }
  }

  async function tentarSenha() {
    if (estado.fase !== "revelado" || !estado.criptografado || !estado.salt || !estado.iv) return;
    setDecifrando(true);
    try {
      const texto = await descriptografar(estado.conteudo, senha, estado.salt, estado.iv);
      setEstado({ ...estado, textoDecifrado: texto, erroSenha: undefined });
    } catch {
      // Decifração local falhou (senha errada ou dado corrompido) — não
      // consome abertura nem chama o servidor de novo, pode tentar outra senha.
      setEstado({ ...estado, erroSenha: "Senha incorreta. Tente novamente." });
    } finally {
      setDecifrando(false);
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
          <Link to="/links-temporarios" className="text-sm font-medium text-primary">
            Criar outro link
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-12">
        {estado.fase === "inicial" && (
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <Lock className="mx-auto size-10 text-primary" />
              <h1 className="text-2xl font-bold">Você recebeu uma mensagem temporária</h1>
              <p className="text-sm text-muted-foreground">
                Ao clicar abaixo, esta abertura será contabilizada — se o link permite só 1
                abertura, ele deixa de funcionar depois deste clique, independente de você digitar
                uma senha certa ou errada a seguir.
              </p>
              <Button onClick={revelar} className="w-full">
                Revelar mensagem
              </Button>
            </CardContent>
          </Card>
        )}

        {estado.fase === "carregando" && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Abrindo…
            </CardContent>
          </Card>
        )}

        {estado.fase === "nao_encontrado" && (
          <MensagemIndisponivel
            titulo="Link não encontrado"
            descricao="Esse link não existe — confira se o endereço foi copiado corretamente."
          />
        )}

        {estado.fase === "expirado" && (
          <MensagemIndisponivel
            titulo="Link expirado"
            descricao="Essa mensagem passou de 7 dias sem ser aberta e foi apagada definitivamente do servidor."
          />
        )}

        {estado.fase === "esgotado" && (
          <MensagemIndisponivel
            titulo="Link já foi usado"
            descricao="O número de aberturas permitido para esta mensagem já foi atingido e ela foi apagada definitivamente."
          />
        )}

        {estado.fase === "revelado" && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <ShieldCheck className="size-5" /> Mensagem
              </div>

              {estado.criptografado && estado.textoDecifrado === undefined ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Esta mensagem está protegida por senha. Digite a senha combinada com quem
                    enviou.
                  </p>
                  <div className="space-y-1.5">
                    <Label>Senha</Label>
                    <div className="flex gap-2">
                      <Input
                        type={mostrarSenha ? "text" : "password"}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && tentarSenha()}
                        autoFocus
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>
                  {estado.erroSenha && (
                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                      <ShieldOff className="size-4" /> {estado.erroSenha}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    disabled={senha.length === 0 || decifrando}
                    onClick={tentarSenha}
                  >
                    {decifrando ? "Verificando…" : "Ver mensagem"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tentar senhas diferentes aqui não consome novas aberturas — a mensagem já foi
                    carregada, só falta decifrá-la no seu navegador.
                  </p>
                </div>
              ) : (
                <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
                  {estado.textoDecifrado}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                {estado.aberturasRestantes > 0
                  ? `Restam ${estado.aberturasRestantes} abertura(s) possíveis para este link.`
                  : "Esta era a última abertura possível — o link já foi apagado do servidor."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function MensagemIndisponivel({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6 text-center">
        <AlertTriangle className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <Link to="/links-temporarios" className="text-sm font-medium text-primary">
          Criar um novo link
        </Link>
      </CardContent>
    </Card>
  );
}
