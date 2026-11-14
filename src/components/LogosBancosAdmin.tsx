import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { recarregarLogosBancos, urlLogoPublico } from "@/lib/logos-bancos-cache";
import {
  adminAdicionarBanco,
  adminAtualizarLogosAgora,
  adminListarLogosBancos,
  adminPesquisarLogo,
  adminUsarLogo,
  adminVoltarLogoAutomatico,
  type LinhaLogoAdmin,
} from "@/lib/logos-bancos.functions";
import { cn } from "@/lib/utils";

/** Aba "Bancos e logos" (14/11/2026): logo atual de cada banco, pesquisa online, troca manual e volta ao automático. */
export function LogosBancosAdmin() {
  const qc = useQueryClient();
  const listar = useServerFn(adminListarLogosBancos);
  const atualizarAgora = useServerFn(adminAtualizarLogosAgora);
  const { data: bancos = [], isLoading } = useQuery({ queryKey: ["admin-logos-bancos"], queryFn: () => listar() });
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  const filtrados = useMemo(() => {
    const t = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (!t) return bancos;
    return bancos.filter((b) =>
      [b.nome, b.dominio ?? "", ...b.apelidos].some((x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(t)),
    );
  }, [bancos, busca]);

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["admin-logos-bancos"] });
    recarregarLogosBancos();
  };

  async function atualizarTodos() {
    let depoisDe: string | undefined;
    let total = 0;
    let falhas = 0;
    try {
      for (let i = 0; i < 30; i++) {
        setProgresso(`Atualizando... ${total} prontos`);
        const r = await atualizarAgora({ data: { depoisDe } });
        total += r.atualizados;
        falhas += r.falhas;
        if (!r.restantes || !r.ultimo) break;
        depoisDe = r.ultimo;
      }
      toast.success(`Logos atualizados: ${total}${falhas ? `, sem logo online: ${falhas}` : ""}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar.");
    } finally {
      setProgresso(null);
      recarregar();
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Bancos e logos</CardTitle>
        <p className="text-sm text-muted-foreground">
          O logo daqui é o padrão no site e no app. Automáticos são buscados no domínio do banco toda semana; os escolhidos pelo admin nunca são trocados.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Buscar banco" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
          <Button variant="outline" disabled={!!progresso} onClick={atualizarTodos}>
            {progresso ?? "Atualizar todos agora"}
          </Button>
          <Button variant="outline" onClick={() => setNovo((v) => !v)}>
            Adicionar banco
          </Button>
        </div>
        {novo && <NovoBanco aoSalvar={() => { setNovo(false); recarregar(); }} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {filtrados.map((b) => (
          <div key={b.chave} className="rounded-xl border">
            <button
              type="button"
              onClick={() => setAberto(aberto === b.chave ? null : b.chave)}
              className={cn("flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50", aberto === b.chave && "bg-muted/50")}
            >
              <Miniatura banco={b} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{b.dominio ?? "sem domínio"}</p>
              </div>
              {b.personalizado && <Badge variant="outline">adicionado</Badge>}
              <Badge variant={b.origem === "admin" ? "default" : "secondary"}>
                {b.origem === "admin" ? "admin" : b.logo_path ? "automático" : "sem logo"}
              </Badge>
            </button>
            {aberto === b.chave && <DetalheBanco banco={b} aoMudar={recarregar} />}
          </div>
        ))}
        {!isLoading && filtrados.length === 0 && <p className="text-sm text-muted-foreground">Nenhum banco encontrado.</p>}
      </CardContent>
    </Card>
  );
}

function Miniatura({ banco, src }: { banco: LinhaLogoAdmin; src?: string | null }) {
  const url = src ?? urlLogoPublico(banco.logo_path);
  if (url) return <img src={url} alt="" className="size-10 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-border" />;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: banco.cor ?? "#64748B" }}>
      {banco.nome.slice(0, 2).toUpperCase()}
    </span>
  );
}

function DetalheBanco({ banco, aoMudar }: { banco: LinhaLogoAdmin; aoMudar: () => void }) {
  const pesquisar = useServerFn(adminPesquisarLogo);
  const usar = useServerFn(adminUsarLogo);
  const voltar = useServerFn(adminVoltarLogoAutomatico);
  const [dominio, setDominio] = useState(banco.dominio ?? "");
  const [urlColada, setUrlColada] = useState("");
  const busca = useMutation({ mutationFn: () => pesquisar({ data: { dominio } }) });
  const gravar = useMutation({
    mutationFn: (v: { url?: string; base64?: string }) => usar({ data: { chave: banco.chave, ...v } }),
    onSuccess: () => {
      toast.success("Logo gravado como padrão (admin).");
      aoMudar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível gravar."),
  });
  const automatico = useMutation({
    mutationFn: () => voltar({ data: { chave: banco.chave } }),
    onSuccess: () => {
      toast.success("Voltou ao logo automático.");
      aoMudar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  function enviarArquivo(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|svg\+xml|webp)$/.test(f.type)) {
      toast.error("Use PNG, SVG ou WEBP.");
      return;
    }
    if (f.size > 200 * 1024) {
      toast.error("Arquivo acima de 200 KB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => gravar.mutate({ base64: String(r.result) });
    r.readAsDataURL(f);
  }

  return (
    <div className="space-y-4 border-t p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="dominio.com.br" className="max-w-xs" />
        <Button size="sm" disabled={busca.isPending || dominio.length < 3} onClick={() => busca.mutate()}>
          {busca.isPending ? "Pesquisando..." : "Pesquisar logo"}
        </Button>
        {banco.origem === "admin" && (
          <Button size="sm" variant="outline" disabled={automatico.isPending} onClick={() => automatico.mutate()}>
            Voltar ao automático
          </Button>
        )}
      </div>
      {busca.data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {busca.data.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Nada encontrado online para esse domínio.</p>}
          {busca.data.map((o) => (
            <div key={o.url} className="flex flex-col items-center gap-1 rounded-lg border p-2 text-center">
              <img src={o.dataUrl} alt="" className="size-14 rounded bg-white object-contain p-1 ring-1 ring-border" />
              <p className="text-xs font-medium">{o.fonte}</p>
              <p className="text-[11px] text-muted-foreground">
                {o.tipo === "image/svg+xml" ? "SVG" : `${o.largura}x${o.altura}`} · {Math.ceil(o.bytes / 1024)} KB
              </p>
              <Button size="sm" variant="secondary" disabled={gravar.isPending} onClick={() => gravar.mutate({ url: o.url })}>
                Usar este
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={urlColada} onChange={(e) => setUrlColada(e.target.value)} placeholder="Colar URL da imagem (https://...)" className="max-w-md" />
        <Button size="sm" variant="secondary" disabled={!/^https?:\/\//.test(urlColada) || gravar.isPending} onClick={() => gravar.mutate({ url: urlColada })}>
          Usar este
        </Button>
        <label className="cursor-pointer text-sm text-primary underline">
          Enviar arquivo
          <input type="file" accept="image/png,image/svg+xml,image/webp" className="hidden" onChange={(e) => enviarArquivo(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}

function NovoBanco({ aoSalvar }: { aoSalvar: () => void }) {
  const adicionar = useServerFn(adminAdicionarBanco);
  const [nome, setNome] = useState("");
  const [dominio, setDominio] = useState("");
  const [apelidos, setApelidos] = useState("");
  const [cor, setCor] = useState("#64748B");
  const salvar = useMutation({
    mutationFn: () =>
      adicionar({ data: { nome, dominio, cor, apelidos: apelidos.split(",").map((a) => a.trim()).filter(Boolean) } }),
    onSuccess: () => {
      toast.success("Banco adicionado ao catálogo.");
      aoSalvar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível adicionar."),
  });
  return (
    <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
      <Input placeholder="Nome (ex.: Banco Exemplo)" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input placeholder="Domínio (ex.: exemplo.com.br)" value={dominio} onChange={(e) => setDominio(e.target.value)} />
      <Input placeholder="Apelidos separados por vírgula" value={apelidos} onChange={(e) => setApelidos(e.target.value)} />
      <div className="flex items-center gap-2">
        <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-12 rounded border" aria-label="Cor da marca" />
        <Button disabled={salvar.isPending || nome.length < 2 || !dominio} onClick={() => salvar.mutate()}>
          {salvar.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
