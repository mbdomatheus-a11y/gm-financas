import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe2, MapPin, Smartphone, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogPainel } from "@/components/LogPainel";
import { adminListarAcessos, type AcessoSite } from "@/lib/acessos-site.functions";

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

function contar<T>(itens: T[], chave: (i: T) => string) {
  const m = new Map<string, number>();
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function origemDe(a: AcessoSite): string {
  if (a.utm_source) return `${a.utm_source}${a.utm_medium ? ` / ${a.utm_medium}` : ""}`;
  if (a.referrer) return a.referrer.split("/")[0] ?? a.referrer;
  return "direto / sem origem";
}

function Ranking({ titulo, linhas }: { titulo: string; linhas: [string, number][] }) {
  const max = linhas[0]?.[1] ?? 1;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
      {linhas.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
      {linhas.slice(0, 6).map(([nome, qtd]) => (
        <div key={nome} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="truncate">{nome}</span>
            <span className="tabular-nums font-medium">{qtd}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(qtd / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AcessosSiteAdmin() {
  const [dias, setDias] = useState(30);
  const listarFn = useServerFn(adminListarAcessos);
  const { data: acessos = [], isLoading } = useQuery({
    queryKey: ["admin-acessos-site", dias],
    queryFn: () => listarFn({ data: { dias } }),
  });

  const resumo = useMemo(() => {
    const ips = new Set(acessos.map((a) => a.ip).filter(Boolean));
    const sessoes = new Set(acessos.map((a) => a.sessao).filter(Boolean));
    const porDia = contar(acessos, (a) => a.criado_em.slice(0, 10))
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-14);
    return {
      ips: ips.size,
      sessoes: sessoes.size,
      porDia,
      origens: contar(acessos, origemDe),
      locais: contar(acessos, (a) =>
        [a.cidade, a.regiao, a.pais].filter(Boolean).join(", ") || "local desconhecido",
      ),
      paginas: contar(acessos, (a) => a.caminho),
      dispositivos: contar(acessos, (a) => a.dispositivo ?? "desconhecido"),
    };
  }, [acessos]);
  const maxDia = Math.max(1, ...resumo.porDia.map((d) => d[1]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="size-4.5" /> Acessos ao site
        </CardTitle>
        <CardDescription>
          Páginas abertas, com IP, local aproximado, origem (UTM ou site de onde veio) e aparelho.
          Use links com utm_source nas ações de divulgação para medir o retorno de cada uma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <Button
              key={p.dias}
              size="sm"
              variant={dias === p.dias ? "default" : "outline"}
              onClick={() => setDias(p.dias)}
            >
              {p.rotulo}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Páginas vistas</p>
            <p className="text-2xl font-bold">{isLoading ? "…" : acessos.length}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" /> Visitas (sessões)
            </p>
            <p className="text-2xl font-bold">{resumo.sessoes}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" /> IPs diferentes
            </p>
            <p className="text-2xl font-bold">{resumo.ips}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Páginas vistas por dia</p>
          <div className="flex h-24 items-end gap-1">
            {resumo.porDia.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
            {resumo.porDia.map(([dia, qtd]) => (
              <div key={dia} className="flex flex-1 flex-col items-center gap-1" title={`${dia}: ${qtd}`}>
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${(qtd / maxDia) * 80}px` }} />
                <span className="text-[9px] text-muted-foreground">{dia.slice(8, 10)}/{dia.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Ranking titulo="De onde vieram" linhas={resumo.origens} />
          <Ranking titulo="Locais" linhas={resumo.locais} />
          <Ranking titulo="Páginas mais vistas" linhas={resumo.paginas} />
          <Ranking titulo="Aparelhos" linhas={resumo.dispositivos} />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Smartphone className="size-3.5" /> Registro detalhado
          </p>
          <LogPainel
            itens={acessos}
            getData={(a) => a.criado_em}
            getChave={(a) => a.id}
            nomeArquivo="acessos-site"
            vazio="Nenhum acesso registrado no período."
            colunas={[
              { titulo: "Data", valor: (a) => a.criado_em },
              { titulo: "Página", valor: (a) => a.caminho },
              { titulo: "IP", valor: (a) => a.ip },
              { titulo: "Cidade", valor: (a) => a.cidade },
              { titulo: "Estado", valor: (a) => a.regiao },
              { titulo: "País", valor: (a) => a.pais },
              { titulo: "Origem", valor: (a) => origemDe(a) },
              { titulo: "Campanha", valor: (a) => a.utm_campaign },
              { titulo: "Aparelho", valor: (a) => a.dispositivo },
            ]}
            renderItem={(a) => (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <span className="tabular-nums text-muted-foreground">
                  {new Date(a.criado_em).toLocaleString("pt-BR")}
                </span>
                <span className="font-medium">{a.caminho}</span>
                <span>{a.ip ?? "IP n/d"}</span>
                <span className="text-muted-foreground">
                  {[a.cidade, a.regiao, a.pais].filter(Boolean).join(", ") || "local n/d"}
                </span>
                <span className="text-muted-foreground">{origemDe(a)}</span>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
