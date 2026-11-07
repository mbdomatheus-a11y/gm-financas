import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Minus, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminFunil, type EtapaFunil } from "@/lib/funil.functions";
import { gerarLinkCampanha } from "@/lib/campanhas";

/**
 * Funil e retenção (2026-10-17, plano de retenção): contador de novos usuários,
 * etapas do visitante até o cadastro, do cadastro até voltar, e origem por campanha.
 */

const PERIODOS = [7, 30, 90];

function useFunil(dias: number) {
  const fn = useServerFn(adminFunil);
  return useQuery({ queryKey: ["admin-funil", dias], queryFn: () => fn({ data: { dias } }), staleTime: 60_000 });
}

/** Faixa curta com os novos usuários, mostrada no topo da administração. */
export function NovosUsuariosResumo() {
  const { data } = useFunil(30);
  const n = data?.novosUsuarios;
  const itens = [
    { rotulo: "Hoje", valor: n?.hoje },
    { rotulo: "7 dias", valor: n?.d7 },
    { rotulo: "30 dias", valor: n?.d30 },
    { rotulo: "Total", valor: n?.total },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4 text-primary" aria-hidden="true" /> Novos usuários
      </span>
      <dl className="grid grid-cols-4 gap-4 sm:flex sm:gap-8">
        {itens.map((i) => (
          <div key={i.rotulo} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{i.rotulo}</dt>
            <dd className="text-base font-semibold tabular-nums">{i.valor ?? "…"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Barras({ etapas }: { etapas: EtapaFunil[] }) {
  const max = Math.max(1, ...etapas.map((e) => e.qtd));
  const base = etapas[0]?.qtd ?? 0;
  return (
    <div className="space-y-3">
      {etapas.map((e, i) => (
        <div key={e.chave} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{e.rotulo}</span>
            <span className="tabular-nums">
              <b>{e.qtd}</b>
              {i > 0 && base > 0 && <span className="ml-1 text-xs text-muted-foreground">({Math.round((e.qtd / base) * 100)}%)</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(e.qtd / max) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{e.ajuda}</p>
        </div>
      ))}
    </div>
  );
}

function GeradorLink() {
  const [campanha, setCampanha] = useState("");
  const [destino, setDestino] = useState("/");
  const link = campanha.trim() ? gerarLinkCampanha({ campanha, destino, origem: "instagram" }) : "";
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <label htmlFor="funil-campanha" className="text-sm font-medium">Nome do post</label>
          <input
            id="funil-campanha"
            value={campanha}
            onChange={(e) => setCampanha(e.target.value)}
            placeholder="Ex.: parcelas-outubro"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
        <label htmlFor="funil-destino" className="text-sm font-medium">Destino</label>
        <select id="funil-destino" value={destino} onChange={(e) => setDestino(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
          <option value="/">Home</option>
          <option value="/comecar/parcelas">Página: quando acabam as parcelas</option>
          <option value="/comecar/fatura">Página: organizar a fatura do cartão</option>
          <option value="/comecar/notas">Página: notas fiscais e garantias</option>
          <option value="/calculadoras">Calculadoras</option>
        </select>
        </div>
      </div>
      {link && (
        <div className="flex items-center gap-3">
          <code className="flex-1 truncate rounded-xl bg-muted px-3 py-2 text-xs">{link}</code>
          <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(link)}>
            Copiar
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Use um link diferente em cada post ou story. Assim a tabela acima mostra qual conteúdo traz visitantes que se cadastram.
      </p>
    </div>
  );
}

export function FunilAdmin() {
  const [dias, setDias] = useState(30);
  const { data, isLoading, error } = useFunil(dias);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => (
          <Button key={p} size="sm" variant={p === dias ? "default" : "outline"} onClick={() => setDias(p)}>
            {p} dias
          </Button>
        ))}
        {data && <span className="text-xs text-muted-foreground">{data.observacao}</span>}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Do visitante ao cadastro</CardTitle>
                <CardDescription>Sem robôs e sem as visitas da administração.</CardDescription>
              </CardHeader>
              <CardContent>
                <Barras etapas={data.visitantes} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Do cadastro ao uso</CardTitle>
                <CardDescription>Quem chega ao primeiro valor e volta.</CardDescription>
              </CardHeader>
              <CardContent>
                <Barras etapas={data.usuarios} />
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos cadastros</CardTitle>
                <CardDescription>Só o primeiro nome. Nenhum valor financeiro é mostrado.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.ultimosCadastros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cadastro no período.</p>}
                {data.ultimosCadastros.length > 0 && (
                <div className="divide-y rounded-2xl border">
                {data.ultimosCadastros.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(c.nome ?? "").trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.nome}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{new Date(c.criadoEm).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                    <span className="flex shrink-0 gap-2 text-xs">
                      <span className={c.lancou ? "flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success" : "flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"}>{c.lancou ? <Check className="size-3.5" aria-hidden="true" /> : <Minus className="size-3.5" aria-hidden="true" />}Lançou</span>
                      <span className={c.voltou ? "flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success" : "flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"}>{c.voltou ? <Check className="size-3.5" aria-hidden="true" /> : <Minus className="size-3.5" aria-hidden="true" />}Voltou</span>
                    </span>
                  </div>
                ))}
                </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Origem dos visitantes</CardTitle>
                <CardDescription>Visitantes e cliques em criar conta por origem e campanha.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-2xl border">
                {data.porCampanha.map((o) => (
                  <div key={o.origem} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span className="truncate">{o.origem}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {o.visitantes} visitantes · {o.cliques} cliques
                    </span>
                  </div>
                ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Link para post do Instagram</CardTitle>
              <CardDescription>Gera o link com a marcação de campanha (utm) para medir cada post.</CardDescription>
            </CardHeader>
            <CardContent>
              <GeradorLink />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
