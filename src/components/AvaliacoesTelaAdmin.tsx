import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Avaliacao = { tela: string; plataforma: string; voto: number; comentario: string | null; versao: string; criado_em: string; atualizado_em: string };
const PLAT: Record<string, string> = { web: "Site", ios: "iPhone", android: "Android" };
const dataBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Relatório dos joinhas (avaliacoes_tela). Só admin: a leitura de todas as linhas depende da policy avaliacoes_tela_ler_admin. */
export function AvaliacoesTelaAdmin() {
  const [dias, setDias] = useState("30");
  const [plataforma, setPlataforma] = useState("todas");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-avaliacoes-tela"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("avaliacoes_tela")
        .select("tela,plataforma,voto,comentario,versao,criado_em,atualizado_em")
        .order("atualizado_em", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Avaliacao[];
    },
  });

  const filtrados = useMemo(() => {
    const corte = dias === "tudo" ? 0 : Date.now() - Number(dias) * 86400000;
    return data.filter((a) => (plataforma === "todas" || a.plataforma === plataforma) && new Date(a.atualizado_em).getTime() >= corte);
  }, [data, dias, plataforma]);

  const telas = useMemo(() => {
    const m = new Map<string, { tela: string; total: number; gostei: number; nao: number; ultimo: string }>();
    for (const a of filtrados) {
      const r = m.get(a.tela) ?? { tela: a.tela, total: 0, gostei: 0, nao: 0, ultimo: a.atualizado_em };
      r.total++;
      if (a.voto > 0) r.gostei++;
      else r.nao++;
      if (a.atualizado_em > r.ultimo) r.ultimo = a.atualizado_em;
      m.set(a.tela, r);
    }
    return [...m.values()].sort((x, y) => x.gostei / x.total - y.gostei / y.total || y.total - x.total);
  }, [filtrados]);

  const comentarios = filtrados.filter((a) => a.comentario && a.comentario.trim());

  const exportar = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      ["tela", "plataforma", "voto", "comentario", "versao", "data"].map(esc).join(";"),
      ...filtrados.map((a) => [a.tela, PLAT[a.plataforma] ?? a.plataforma, a.voto > 0 ? "gostei" : "nao gostei", a.comentario ?? "", a.versao, a.atualizado_em].map(esc).join(";")),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const l = document.createElement("a");
    l.href = url;
    l.download = `avaliacoes-telas-${new Date().toISOString().slice(0, 10)}.csv`;
    l.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["7", "30", "90"].map((d) => <SelectItem key={d} value={d}>Últimos {d} dias</SelectItem>)}
              <SelectItem value="tudo">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={plataforma} onValueChange={setPlataforma}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="web">Site</SelectItem>
              <SelectItem value="ios">iPhone</SelectItem>
              <SelectItem value="android">Android</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtrados.length} votos</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={exportar} disabled={!filtrados.length}>
            <Download className="mr-1 h-4 w-4" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Por tela (pior aprovação primeiro)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : error ? <p className="text-sm text-destructive">Não foi possível ler as avaliações (a migração do relatório foi aplicada?).</p> : !telas.length ? <p className="text-sm text-muted-foreground">Sem votos no período.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2">Tela</th><th className="pr-2">Votos</th><th className="pr-2">Gostei</th><th className="pr-2">Não gostei</th><th className="pr-2">Aprovação</th><th>Último voto</th>
              </tr></thead>
              <tbody>
                {telas.map((t) => {
                  const pct = Math.round((t.gostei / t.total) * 100);
                  return (
                    <tr key={t.tela} className="border-t">
                      <td className="py-1.5 pr-2 font-medium">{t.tela}</td>
                      <td className="pr-2">{t.total}</td>
                      <td className="pr-2">{t.gostei}</td>
                      <td className="pr-2">{t.nao}</td>
                      <td className="pr-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs">{pct}%</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">{dataBr(t.ultimo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Comentários ({comentarios.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!comentarios.length && <p className="text-sm text-muted-foreground">Nenhum comentário no período.</p>}
          {comentarios.map((a, i) => (
            <div key={i} className="rounded border p-2 text-sm">
              <div className="mb-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{a.tela}</span><span>{PLAT[a.plataforma] ?? a.plataforma}</span>
                <span>{a.voto > 0 ? "Gostei" : "Não gostei"}</span><span>{dataBr(a.atualizado_em)}</span>
              </div>
              {a.comentario}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
