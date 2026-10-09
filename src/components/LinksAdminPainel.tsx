import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, Bold, Copy, Italic, Link2, List, Pencil, Trash2, Heading } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TextoFormatado } from "@/components/TextoFormatado";
import {
  adminArquivarLink,
  adminExcluirLink,
  adminListarLinks,
  adminSalvarLink,
} from "@/lib/links-admin.functions";

const MAX_CONTEUDO = 100_000;

/** Valor para <input type="datetime-local"> no fuso do navegador. */
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function linkPublico(id: string) {
  return `${window.location.origin}/links/${id}`;
}

export function LinksAdminPainel() {
  const qc = useQueryClient();
  const listar = useServerFn(adminListarLinks);
  const salvar = useServerFn(adminSalvarLink);
  const arquivar = useServerFn(adminArquivarLink);
  const excluir = useServerFn(adminExcluirLink);
  const { data: links = [] } = useQuery({ queryKey: ["admin-links"], queryFn: () => listar() });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState<"temporario" | "permanente">("permanente");
  const [expira, setExpira] = useState("");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  function limpar() {
    setEditandoId(null);
    setTitulo("");
    setConteudo("");
    setTipo("permanente");
    setExpira("");
  }

  const salvarM = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          ...(editandoId ? { id: editandoId } : {}),
          titulo,
          conteudo,
          tipo,
          expiraEm: tipo === "temporario" && expira ? new Date(expira).toISOString() : null,
        },
      }),
    onSuccess: (r) => {
      const url = linkPublico(r.id);
      void navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Salvo. O link foi copiado: " + url, { duration: 8000 });
      limpar();
      void qc.invalidateQueries({ queryKey: ["admin-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const arquivarM = useMutation({
    mutationFn: (v: { id: string; arquivado: boolean }) => arquivar({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-links"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Link excluído.");
      void qc.invalidateQueries({ queryKey: ["admin-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function aplicar(antes: string, depois = antes, padrao = "texto") {
    const el = area.current;
    if (!el) return;
    const ini = el.selectionStart;
    const fim = el.selectionEnd;
    const sel = conteudo.slice(ini, fim) || padrao;
    setConteudo(conteudo.slice(0, ini) + antes + sel + depois + conteudo.slice(fim));
  }
  function prefixoLinha(prefixo: string) {
    const el = area.current;
    if (!el) return;
    const ini = conteudo.lastIndexOf("\n", el.selectionStart - 1) + 1;
    setConteudo(conteudo.slice(0, ini) + prefixo + conteudo.slice(ini));
  }

  function editar(l: (typeof links)[number]) {
    setEditandoId(l.id);
    setTitulo(l.titulo);
    setConteudo(l.conteudo);
    setTipo(l.tipo);
    setExpira(paraInputLocal(l.expira_em));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const visiveis = links.filter((l) => (mostrarArquivados ? l.arquivado : !l.arquivado));
  const agora = Date.now();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{editandoId ? "Editar link" : "Novo link"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Só quem estiver logado no Control ALL consegue abrir o link gerado.
          </p>
          <div className="space-y-1">
            <Label htmlFor="link-titulo">Título</Label>
            <Input id="link-titulo" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-conteudo">Conteúdo</Label>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => aplicar("**")} aria-label="Negrito">
                <Bold className="size-4" />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => aplicar("*")} aria-label="Itálico">
                <Italic className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => aplicar("[", "](https://)", "texto do link")}
                aria-label="Link"
              >
                <Link2 className="size-4" />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => prefixoLinha("- ")} aria-label="Lista">
                <List className="size-4" />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => prefixoLinha("# ")} aria-label="Título">
                <Heading className="size-4" />
              </Button>
            </div>
            <Textarea
              id="link-conteudo"
              ref={area}
              rows={12}
              maxLength={MAX_CONTEUDO}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {conteudo.length.toLocaleString("pt-BR")} / {MAX_CONTEUDO.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="link-tipo">Tipo</Label>
              <select
                id="link-tipo"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "temporario" | "permanente")}
              >
                <option value="permanente">Permanente</option>
                <option value="temporario">Temporário (com data e hora para expirar)</option>
              </select>
            </div>
            {tipo === "temporario" && (
              <div className="space-y-1">
                <Label htmlFor="link-expira">Expira em</Label>
                <Input id="link-expira" type="datetime-local" value={expira} onChange={(e) => setExpira(e.target.value)} />
              </div>
            )}
          </div>
          {conteudo.trim() && (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-xs font-semibold">Pré-visualização</summary>
              <div className="mt-2">
                <TextoFormatado texto={conteudo} />
              </div>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!titulo.trim() || !conteudo.trim() || (tipo === "temporario" && !expira) || salvarM.isPending}
              onClick={() => salvarM.mutate()}
            >
              {editandoId ? "Salvar alterações" : "Salvar e gerar link"}
            </Button>
            {editandoId && (
              <Button variant="outline" onClick={limpar}>
                Cancelar edição
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">{mostrarArquivados ? "Links arquivados" : "Links ativos"}</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setMostrarArquivados((v) => !v)}>
            {mostrarArquivados ? "Ver ativos" : "Ver arquivados"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {visiveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link por aqui.</p>}
          {visiveis.map((l) => {
            const expirado = !!l.expira_em && new Date(l.expira_em).getTime() < agora;
            return (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.titulo}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{l.tipo === "temporario" ? "Temporário" : "Permanente"}</Badge>
                    {l.expira_em && (
                      <span>
                        {expirado ? "Expirou em " : "Expira em "}
                        {new Date(l.expira_em).toLocaleString("pt-BR")}
                      </span>
                    )}
                    {expirado && <Badge variant="destructive">Expirado</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(linkPublico(l.id)).catch(() => {});
                      toast.success("Link copiado.");
                    }}
                  >
                    <Copy className="mr-1 size-4" /> Copiar link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => editar(l)}>
                    <Pencil className="mr-1 size-4" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={arquivarM.isPending}
                    onClick={() => arquivarM.mutate({ id: l.id, arquivado: !l.arquivado })}
                  >
                    {l.arquivado ? (
                      <ArchiveRestore className="mr-1 size-4" />
                    ) : (
                      <Archive className="mr-1 size-4" />
                    )}
                    {l.arquivado ? "Desarquivar" : "Arquivar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={excluirM.isPending}
                    onClick={() => {
                      if (window.confirm(`Excluir definitivamente "${l.titulo}"? O link deixará de funcionar.`)) {
                        excluirM.mutate(l.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-1 size-4" /> Excluir
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
