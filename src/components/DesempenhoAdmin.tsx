import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Linha = { plataforma: string; tela: string; metrica: string; amostras: number; p50: number; p75: number; p95: number };
type Selo = "Bom" | "Melhorar" | "Ruim";

// Metas do Google (web) e metas do app (carregamento, ms).
const LIMITES: Record<string, [number, number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  carregamento: [1000, 2500],
};

function selo(metrica: string, v: number | undefined): Selo | null {
  const l = LIMITES[metrica];
  if (v == null || !l) return null;
  return v <= l[0] ? "Bom" : v > l[1] ? "Ruim" : "Melhorar";
}

const COR: Record<Selo, string> = {
  Bom: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Melhorar: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Ruim: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function fmt(metrica: string, v: number | undefined) {
  if (v == null) return "-";
  if (metrica === "CLS") return v.toFixed(3).replace(".", ",");
  return `${Math.round(v)} ms`;
}

function Celula({ metrica, v }: { metrica: string; v?: number | undefined }) {
  const s = selo(metrica, v);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {fmt(metrica, v)}
      {s && <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", COR[s])}>{s}</span>}
    </span>
  );
}

const PLAT = [
  { id: "web", rotulo: "Web" },
  { id: "ios", rotulo: "iPhone" },
  { id: "android", rotulo: "Android" },
];

export function DesempenhoAdmin() {
  const [dias, setDias] = useState(7);
  const [plat, setPlat] = useState("web");

  // Retencao de 30 dias: roda ao abrir o relatorio (sem cron). Falha e ignorada.
  useEffect(() => {
    void Promise.resolve(supabase.rpc("limpar_desempenho_admin" as never)).catch(() => {});
  }, []);

  const q = useQuery({
    queryKey: ["admin-desempenho", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resumo_desempenho" as never, { dias } as never);
      if (error) throw error;
      return ((data ?? []) as unknown as Linha[]).map((r) => ({
        ...r,
        amostras: Number(r.amostras),
        p50: Number(r.p50),
        p75: Number(r.p75),
        p95: Number(r.p95),
      }));
    },
    retry: false,
  });

  const semTabela = useMemo(() => {
    const e = q.error as { code?: string; message?: string } | null;
    if (!e) return false;
    return e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || /desempenho|resumo_desempenho/.test(e.message ?? "");
  }, [q.error]);

  const telas = useMemo(() => {
    const m = new Map<string, Record<string, Linha>>();
    for (const r of (q.data ?? []).filter((x) => x.plataforma === plat)) {
      const o = m.get(r.tela) ?? {};
      o[r.metrica] = r;
      m.set(r.tela, o);
    }
    const metricaPrincipal = plat === "web" ? "LCP" : "carregamento";
    return [...m.entries()]
      .map(([tela, o]) => {
        const amostras = Math.max(...Object.values(o).map((x) => x.amostras));
        const erros = o["erro"]?.amostras ?? 0;
        const base = plat === "web" ? (o["LCP"]?.amostras ?? amostras) : (o["carregamento"]?.amostras ?? amostras);
        return { tela, o, amostras: base, taxaErro: base + erros > 0 ? erros / (base + erros) : 0, principal: o[metricaPrincipal]?.p75 };
      })
      .sort((a, b) => b.amostras - a.amostras);
  }, [q.data, plat]);

  const lentas = useMemo(
    () => telas.filter((t) => t.principal != null).sort((a, b) => (b.principal ?? 0) - (a.principal ?? 0)).slice(0, 5),
    [telas],
  );
  const principal = plat === "web" ? "LCP" : "carregamento";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30].map((d) => (
          <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
            {d} dias
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {PLAT.map((p) => (
          <Button key={p.id} size="sm" variant={plat === p.id ? "default" : "outline"} onClick={() => setPlat(p.id)}>
            {p.rotulo}
          </Button>
        ))}
      </div>

      {semTabela ? (
        <Card>
          <CardContent className="py-6 text-sm">Rode a migração 20261107220000</CardContent>
        </Card>
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">Não foi possível carregar o relatório.</p>
      ) : telas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem amostras neste período e plataforma.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">5 telas mais lentas ({principal === "LCP" ? "p75 do LCP" : "p75 do carregamento"})</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1 text-sm">
                {lentas.map((t, i) => (
                  <li key={t.tela} className="flex items-center justify-between gap-2">
                    <span className="truncate">{i + 1}. {t.tela}</span>
                    <Celula metrica={principal} v={t.principal} />
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por tela (p75)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Tela</th>
                    <th className="pr-3">Amostras</th>
                    {plat === "web" ? (
                      <>
                        <th className="pr-3">LCP</th>
                        <th className="pr-3">INP</th>
                        <th className="pr-3">CLS</th>
                      </>
                    ) : (
                      <th className="pr-3">Carregamento</th>
                    )}
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {telas.map((t) => (
                    <tr key={t.tela} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{t.tela}</td>
                      <td className="pr-3">{t.amostras}</td>
                      {plat === "web" ? (
                        <>
                          <td className="pr-3"><Celula metrica="LCP" v={t.o["LCP"]?.p75} /></td>
                          <td className="pr-3"><Celula metrica="INP" v={t.o["INP"]?.p75} /></td>
                          <td className="pr-3"><Celula metrica="CLS" v={t.o["CLS"]?.p75} /></td>
                        </>
                      ) : (
                        <td className="pr-3"><Celula metrica="carregamento" v={t.o["carregamento"]?.p75} /></td>
                      )}
                      <td>{(t.taxaErro * 100).toFixed(1).replace(".", ",")}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
