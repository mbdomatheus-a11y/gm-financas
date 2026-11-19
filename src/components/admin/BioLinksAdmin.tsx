import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Copy, ExternalLink, ImagePlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  adminBioExcluirLink,
  adminBioObter,
  adminBioDefinirIcone,
  adminBioOrdenarLinks,
  adminBioPrepararFoto,
  adminBioPrepararIcone,
  adminBioSalvarLink,
  adminBioSalvarPagina,
} from "@/lib/bio.functions";

/**
 * Administração > Links da bio (19/11/2026). Página de links tipo Linktree no domínio do Control ALL,
 * só por link direto (controlall.com.br/bio). Foto, nome, links e os dados de quem visitou e clicou
 * (mesmos dados do registro de acessos do site, com a mesma regra de aceite de cookies).
 */
const DOMINIO = "https://www.controlall.com.br";
const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function BioLinksAdmin() {
  const qc = useQueryClient();
  const [dias, setDias] = useState(30);
  const obter = useServerFn(adminBioObter);
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-bio", dias], queryFn: () => obter({ data: { dias } }) });
  const recarregar = () => qc.invalidateQueries({ queryKey: ["admin-bio"] });

  const salvarPaginaFn = useServerFn(adminBioSalvarPagina);
  const prepararFotoFn = useServerFn(adminBioPrepararFoto);
  const salvarLinkFn = useServerFn(adminBioSalvarLink);
  const ordenarFn = useServerFn(adminBioOrdenarLinks);
  const excluirFn = useServerFn(adminBioExcluirLink);

  const pagina = data?.paginas?.[0] ?? null;
  const links = useMemo(() => (data?.links ?? []).filter((l: any) => l.pagina_id === pagina?.id), [data, pagina]);
  const eventos = data?.eventos ?? [];

  const [form, setForm] = useState<{ slug: string; titulo: string; bio: string; ativo: boolean } | null>(null);
  const f = form ?? { slug: pagina?.slug ?? "bio", titulo: pagina?.titulo ?? "", bio: pagina?.bio ?? "", ativo: pagina?.ativo ?? true };
  const salvarPagina = useMutation({
    mutationFn: (extra: { foto_path?: string | null } = {}) =>
      salvarPaginaFn({ data: { id: pagina?.id ?? null, ...f, ...extra } }),
    onSuccess: () => {
      toast.success("Página salva.");
      setForm(null);
      recarregar();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const arquivo = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  async function enviarFoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Imagem até 3 MB.");
      return;
    }
    setEnviandoFoto(true);
    try {
      const envio = await prepararFotoFn({ data: { nome: file.name } });
      const { error: e } = await supabase.storage.from("site_assets").uploadToSignedUrl(envio.path, envio.token, file);
      if (e) throw e;
      await salvarPagina.mutateAsync({ foto_path: envio.path });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar a foto.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  const [novo, setNovo] = useState({ titulo: "", url: "" });
  const [fotoNovo, setFotoNovo] = useState<File | null>(null);
  const arquivoNovo = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState<{ id: string; titulo: string; url: string; ativo: boolean } | null>(null);
  const prepararIconeFn = useServerFn(adminBioPrepararIcone);
  const definirIconeFn = useServerFn(adminBioDefinirIcone);
  const arquivoIcone = useRef<HTMLInputElement>(null);
  const [iconeDe, setIconeDe] = useState<string | null>(null);
  async function enviarIcone(id: string, file: File) {
    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) {
      toast.error("Use uma imagem de até 1 MB.");
      return;
    }
    try {
      const envio = await prepararIconeFn({ data: { id, nome: file.name } });
      const { error: e } = await supabase.storage.from("site_assets").uploadToSignedUrl(envio.path, envio.token, file);
      if (e) throw e;
      await definirIconeFn({ data: { id, path: envio.path } });
      recarregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o ícone.");
    }
  }
  const buscarIcone = (id: string) =>
    definirIconeFn({ data: { id, path: null, buscar: true } })
      .then(() => {
        toast.success("Logo atualizado.");
        recarregar();
      })
      .catch((e: any) => toast.error(e.message));
  const salvarLink = useMutation({
    mutationFn: async (v: { id: string | null; titulo: string; url: string; ativo: boolean; foto?: File | null }) => {
      const { foto, ...resto } = v;
      const r = await salvarLinkFn({ data: { ...resto, pagina_id: pagina!.id, comFoto: !!foto } });
      // Link novo com foto própria: envia a foto logo depois de criar.
      if (foto && r.id) await enviarIcone(r.id, foto);
      return r;
    },
    onSuccess: () => {
      setNovo({ titulo: "", url: "" });
      setFotoNovo(null);
      setEditando(null);
      recarregar();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mover = (i: number, d: number) => {
    const ids = links.map((l: any) => l.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void ordenarFn({ data: { ids } }).then(recarregar);
  };

  // ---- números
  const visitas = eventos.filter((e: any) => e.tipo === "visita");
  const cliques = eventos.filter((e: any) => e.tipo === "clique");
  const conta = (lista: any[], chave: (e: any) => string | null) => {
    const m = new Map<string, number>();
    for (const e of lista) {
      const k = chave(e);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const porLink = new Map<string, number>();
  for (const c of cliques) if (c.link_id) porLink.set(c.link_id, (porLink.get(c.link_id) ?? 0) + 1);
  const origem = (e: any) => e.utm_source || (e.referrer ? String(e.referrer).split("/")[0] : e.metricas ? "direto" : null);
  const local = (e: any) => [e.cidade, e.regiao, e.pais].filter(Boolean).join(", ") || null;
  const nomeLink = new Map<string, string>(links.map((l: any) => [String(l.id), String(l.titulo)]));

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  const endereco = `${DOMINIO}/bio`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-bold">Página de links</CardTitle>
          <p className="text-sm text-muted-foreground">
            Só abre por link direto: não aparece no site, no app nem no Google. O aviso de privacidade é o mesmo do Control ALL.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => arquivo.current?.click()}
              disabled={enviandoFoto}
              className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted"
              aria-label="Trocar foto"
              title="Trocar foto"
            >
              {pagina?.foto ? <img src={pagina.foto} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6 text-muted-foreground" />}
              <span className="absolute inset-0 hidden place-items-center bg-black/40 text-xs text-white group-hover:grid">
                {enviandoFoto ? "Enviando…" : "Trocar"}
              </span>
            </button>
            <input
              ref={arquivo}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void enviarFoto(file);
              }}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">{endereco}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void navigator.clipboard.writeText(endereco).then(() => toast.success("Link copiado."))}>
                  <Copy className="size-3.5" /> Copiar link
                </Button>
                {pagina && (
                  <Button size="sm" variant="outline" className="gap-1.5" asChild>
                    <a href="/bio" target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" /> Abrir
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <Input value={f.titulo} maxLength={80} onChange={(e) => setForm({ ...f, titulo: e.target.value })} placeholder="Ex.: Matheus Barbosa" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Frase curta</span>
              <Input value={f.bio} maxLength={300} onChange={(e) => setForm({ ...f, bio: e.target.value })} placeholder="Ex.: Finanças, tecnologia e achados da Shopee" />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.ativo} onCheckedChange={(v) => setForm({ ...f, ativo: v })} /> Página no ar
            </label>
            <Button onClick={() => salvarPagina.mutate({})} disabled={salvarPagina.isPending}>
              {pagina ? "Salvar página" : "Criar página"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pagina && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={arquivoIcone}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file && iconeDe) void enviarIcone(iconeDe, file);
              }}
            />
            <p className="text-xs text-muted-foreground">Para trocar a foto de um link, toque nela e envie outra imagem.</p>
            <ul className="divide-y rounded-xl border">
              {links.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Nenhum link ainda.</li>}
              {links.map((l: any, i: number) =>
                editando && editando.id === l.id ? (
                  <li key={l.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_2fr_auto]">
                    <Input value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} />
                    <Input value={editando.url} onChange={(e) => setEditando({ ...editando, url: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => salvarLink.mutate(editando)}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                    </div>
                  </li>
                ) : (
                  <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setIconeDe(l.id);
                        arquivoIcone.current?.click();
                      }}
                      className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white"
                      title="Trocar o ícone (envie uma imagem)"
                      aria-label={`Trocar o ícone de ${l.titulo}`}
                    >
                      {l.icone ? <img src={l.icone} alt="" className="size-full object-contain p-0.5" /> : <ImagePlus className="size-4 text-muted-foreground" />}
                    </button>
                    <Switch
                      checked={l.ativo}
                      onCheckedChange={(v) => salvarLink.mutate({ id: l.id, titulo: l.titulo, url: l.url, ativo: v })}
                      aria-label={`${l.titulo} no ar`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.url}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{porLink.get(l.id) ?? 0} cliques</span>
                    <Button variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir"><ArrowUp className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8" disabled={i === links.length - 1} onClick={() => mover(i, 1)} aria-label="Descer"><ArrowDown className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => void buscarIcone(l.id)} aria-label="Buscar o logo do site de novo" title="Buscar o logo do site de novo"><RefreshCw className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditando({ id: l.id, titulo: l.titulo, url: l.url, ativo: l.ativo })} aria-label="Editar"><Pencil className="size-4" /></Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir o link "${l.titulo}"? Os cliques já contados continuam no histórico.`))
                          void excluirFn({ data: { id: l.id } }).then(recarregar);
                      }}
                      aria-label="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ),
              )}
            </ul>
            <div className="space-y-2 rounded-xl border border-dashed p-3">
              <p className="text-sm font-semibold">Novo link</p>
              <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr_2fr_auto]">
                <button
                  type="button"
                  onClick={() => arquivoNovo.current?.click()}
                  className="grid size-12 place-items-center overflow-hidden rounded-xl border bg-white"
                  title="Foto do link (opcional: sem foto, entra o logo do site)"
                  aria-label="Escolher a foto do link"
                >
                  {fotoNovo ? <img src={URL.createObjectURL(fotoNovo)} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" />}
                </button>
                <input
                  ref={arquivoNovo}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setFotoNovo(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Input placeholder="Nome (ex.: Minha loja na Shopee)" value={novo.titulo} maxLength={80} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
                <Input placeholder="Para onde leva (ex.: https://shopee.com.br/…)" value={novo.url} onChange={(e) => setNovo({ ...novo, url: e.target.value.trim() })} />
                <Button className="gap-1.5" disabled={salvarLink.isPending} onClick={() => salvarLink.mutate({ id: null, ...novo, ativo: true, foto: fotoNovo })}>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Quem tocar no link vai direto para o endereço. A foto é opcional: sem ela, entra o logo do site.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {pagina && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base font-bold">Quem visitou e clicou</CardTitle>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período">
              {[7, 30, 90, 365].map((d) => (
                <option key={d} value={d}>Últimos {d} dias</option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Visitas", visitas.length],
                ["Cliques", cliques.length],
                ["Taxa de clique", visitas.length ? `${Math.round((cliques.length / visitas.length) * 100)}%` : "-"],
              ].map(([r, v]) => (
                <div key={String(r)} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{r}</p>
                  <p className="text-xl font-bold tabular-nums">{String(v)}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  ["De onde vieram", conta(eventos, origem)],
                  ["Onde estão", conta(eventos, local)],
                  ["Aparelho", conta(eventos, (e) => e.dispositivo)],
                ] as [string, [string, number][]][]
              ).map(([titulo, linhas]) => (
                <div key={titulo}>
                  <p className="mb-1.5 text-sm font-semibold">{titulo}</p>
                  {linhas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {linhas.map(([k, n]) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span className="truncate">{k}</span>
                          <span className="tabular-nums text-muted-foreground">{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">Últimos cliques</p>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      {["Quando", "Link", "Local", "Aparelho", "Origem", "IP", "Navegador"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cliques.slice(0, 100).map((c: any) => (
                      <tr key={c.id} className="border-t">
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtData(c.criado_em)}</td>
                        <td className="px-2 py-1.5">{nomeLink.get(c.link_id) ?? "(excluído)"}</td>
                        <td className="px-2 py-1.5">{local(c) ?? (c.metricas ? "-" : "sem aceite")}</td>
                        <td className="px-2 py-1.5">{c.dispositivo ?? "-"}</td>
                        <td className="px-2 py-1.5">{origem(c) ?? "-"}</td>
                        <td className="px-2 py-1.5 tabular-nums">{c.ip ?? "-"}</td>
                        <td className="max-w-[220px] truncate px-2 py-1.5" title={c.user_agent ?? ""}>{c.user_agent ?? "-"}</td>
                      </tr>
                    ))}
                    {cliques.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-2 py-3 text-center text-muted-foreground">Nenhum clique no período.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Local, origem, IP e navegador só aparecem para quem aceitou os cookies de métricas (LGPD). Sem aceite, conta o clique e o aparelho.
                Dica: use links com ?utm_source=tiktok (ou instagram) em cada rede para saber de onde veio cada visita.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
