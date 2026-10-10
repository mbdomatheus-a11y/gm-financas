import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, Bold, CheckCheck, Eye, Undo2, Combine, Copy, Italic, Link2, Link2Off, List, Pencil, Share2, Trash2, Heading } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
  adminAlternarLinkPublico,
  adminConcluirLink,
  adminExcluirLink,
  adminListarLinks,
  adminSalvarLink,
  adminUnificarLinks,
} from "@/lib/links-admin.functions";

const MAX_CONTEUDO = 100_000;

/** Valor para <input type="datetime-local"> no fuso do navegador. */
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Link que exige conta (só quem está logado abre). */
export function linkPublico(id: string) {
  return `${window.location.origin}/links/${id}`;
}

/** Link aberto: funciona sem conta, enquanto o compartilhamento estiver ligado. */
export function linkCompartilhavel(token: string) {
  return `${window.location.origin}/nota/${token}`;
}

export function LinksAdminPainel({
  abaInicial = "ativas",
  novo = false,
}: {
  abaInicial?: "ativas" | "concluidas" | "historico";
  novo?: boolean;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(adminListarLinks);
  const salvar = useServerFn(adminSalvarLink);
  const arquivar = useServerFn(adminArquivarLink);
  const excluir = useServerFn(adminExcluirLink);
  const concluir = useServerFn(adminConcluirLink);
  const alternarPublico = useServerFn(adminAlternarLinkPublico);
  const unificar = useServerFn(adminUnificarLinks);
  const { data: links = [] } = useQuery({ queryKey: ["admin-links"], queryFn: () => listar() });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState<"temporario" | "permanente">("permanente");
  const [expira, setExpira] = useState("");
  const [aba, setAba] = useState<"ativas" | "concluidas" | "historico">(abaInicial);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [tituloUniao, setTituloUniao] = useState("");
  const [unindo, setUnindo] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (novo) formRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [novo]);

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
  const publicoM = useMutation({
    mutationFn: (v: { id: string; publico: boolean }) => alternarPublico({ data: v }),
    onSuccess: (r: any, v) => {
      if (v.publico && r?.token) {
        const url = linkCompartilhavel(r.token);
        void navigator.clipboard?.writeText(url).catch(() => {});
        toast.success("Link aberto criado e copiado: " + url, { duration: 8000 });
      } else {
        toast.success("Compartilhamento encerrado. O endereço anterior não abre mais.");
      }
      void qc.invalidateQueries({ queryKey: ["admin-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unificarM = useMutation({
    mutationFn: () => unificar({ data: { ids: marcados, titulo: tituloUniao } }),
    onSuccess: () => {
      toast.success("Anotações unificadas. As originais foram arquivadas e continuam no histórico.");
      setMarcados([]);
      setUnindo(false);
      setTituloUniao("");
      void qc.invalidateQueries({ queryKey: ["admin-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const arquivarM = useMutation({
    mutationFn: (v: { id: string; arquivado: boolean }) => arquivar({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-links"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const concluirM = useMutation({
    mutationFn: (v: { id: string; concluida: boolean }) => concluir({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.concluida ? "Anotação marcada como analisada." : "Anotação reaberta.");
      void qc.invalidateQueries({ queryKey: ["admin-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Anotação excluída.");
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
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function alternar(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  const agora = Date.now();
  const visiveis = links.filter((l) => {
    if (aba === "historico") return true;
    if (l.arquivado) return false;
    if (aba === "concluidas") return !!l.concluida_em;
    return !l.concluida_em && !(l.expira_em && new Date(l.expira_em).getTime() < agora);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={aba === "ativas" ? "default" : "outline"} onClick={() => setAba("ativas")}>
          Anotações ativas
        </Button>
        <Button size="sm" variant={aba === "concluidas" ? "default" : "outline"} onClick={() => setAba("concluidas")}>
          Analisadas
        </Button>
        <Button size="sm" variant={aba === "historico" ? "default" : "outline"} onClick={() => setAba("historico")}>
          Histórico
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAba("ativas");
            formRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Incluir anotação
        </Button>
      </div>
      <div ref={formRef} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{editandoId ? "Editar anotação" : "Nova anotação"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ao salvar, é gerado um link. Só quem estiver logado no Control ALL consegue abri-lo.
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
          <CardTitle className="text-sm">{aba === "historico" ? "Histórico de anotações (todas, com data)" : "Anotações ativas"}</CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={marcados.length < 2}
            onClick={() => {
              setTituloUniao(`Unificado: ${links.filter((x) => marcados.includes(x.id)).map((x) => x.titulo).join(" + ")}`.slice(0, 120));
              setUnindo(true);
            }}
          >
            <Combine className="mr-1 size-4" /> Unificar selecionadas ({marcados.length})
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {unindo && (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
              <p>
                As {marcados.length} anotações marcadas viram uma só, em ordem de criação. As originais ficam
                arquivadas.
              </p>
              <Input maxLength={120} value={tituloUniao} onChange={(e) => setTituloUniao(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={!tituloUniao.trim() || unificarM.isPending} onClick={() => unificarM.mutate()}>
                  Confirmar união
                </Button>
                <Button size="sm" variant="outline" onClick={() => setUnindo(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {visiveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma anotação por aqui.</p>}
          {visiveis.map((l) => {
            const expirado = !!l.expira_em && new Date(l.expira_em).getTime() < agora;
            return (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  aria-label={`Selecionar ${l.titulo}`}
                  checked={marcados.includes(l.id)}
                  onChange={() => alternar(l.id)}
                />
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
                    <span>Criada em {new Date(l.criado_em).toLocaleDateString("pt-BR")}</span>
                    {l.arquivado && <Badge variant="secondary">Arquivada</Badge>}
                    {l.concluida_em && (
                      <Badge variant="secondary">
                        Analisada em {new Date(l.concluida_em).toLocaleDateString("pt-BR")}
                      </Badge>
                    )}
                    {expirado && <Badge variant="destructive">Expirado</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/links/$id" params={{ id: l.id }}>
                      <Eye className="mr-1 size-4" /> Visualizar
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant={l.concluida_em ? "outline" : "default"}
                    disabled={concluirM.isPending}
                    onClick={() => concluirM.mutate({ id: l.id, concluida: !l.concluida_em })}
                  >
                    {l.concluida_em ? <Undo2 className="mr-1 size-4" /> : <CheckCheck className="mr-1 size-4" />}
                    {l.concluida_em ? "Reabrir" : "Concluir"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(linkPublico(l.id)).catch(() => {});
                      toast.success("Link copiado (só abre com conta).");
                    }}
                  >
                    <Copy className="mr-1 size-4" /> Copiar link
                  </Button>
                  {l.publico && l.token_publico ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(linkCompartilhavel(l.token_publico!))
                            .catch(() => {});
                          toast.success("Link aberto copiado. Funciona sem entrar na conta.");
                        }}
                      >
                        <Share2 className="mr-1 size-4" /> Copiar link aberto
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={publicoM.isPending}
                        onClick={() => publicoM.mutate({ id: l.id, publico: false })}
                        title="O endereço atual para de funcionar na hora"
                      >
                        <Link2Off className="mr-1 size-4" /> Parar de compartilhar
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={publicoM.isPending}
                      onClick={() => publicoM.mutate({ id: l.id, publico: true })}
                      title="Gera um endereço que qualquer pessoa abre, sem conta"
                    >
                      <Share2 className="mr-1 size-4" /> Gerar link aberto
                    </Button>
                  )}
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
