import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListarAcessos, type AcessoSite } from "@/lib/acessos-site.functions";

/** Nome do menu para cada caminho (site e app). */
const MENUS: Record<string, string> = {
  inicio: "Início",
  dashboard: "Finanças",
  receitas: "Receitas",
  despesas: "Despesas",
  cartoes: "Cartões",
  importar: "Importar",
  investimentos: "Investimentos",
  "para-onde-vai": "Para onde vai",
  categorias: "Categorias",
  "de-para": "De-para",
  calendario: "Calendário",
  "lista-compras": "Lista de compras",
  notas: "Notas",
  "onde-esta": "Onde está",
  veiculos: "Veículos",
  pets: "Pets",
  exames: "Exames",
  links: "Anotações",
  ferramentas: "Calculadora",
  configuracoes: "Configurações",
  conta: "Minha conta",
  usuarios: "Meu grupo e permissões",
  backup: "Backup e Reset",
  suporte: "Suporte",
  compartilhar: "Compartilhar",
  administracao: "Administração",
  pluggy: "Bancos (teste)",
  personalizacao: "Personalização",
  poupar: "Caixinhas",
  faturas: "Faturas",
};

function nomeDoMenu(caminho: string): string {
  if (caminho.startsWith("/evento/")) return `Evento: ${caminho.slice(8)}`;
  if (caminho === "/" || caminho === "") return "Página inicial (pública)";
  const partes = caminho.split("/").filter(Boolean);
  const ultimo = partes[partes.length - 1] ?? "";
  const primeiro = partes[0] ?? "";
  return MENUS[ultimo] ?? MENUS[primeiro] ?? caminho;
}

const dataBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Resumo de uso (27/10/2026): quais menus e telas as pessoas abrem, no site e no app, para orientar o
 * desenvolvimento. Só o caminho da tela e eventos dos avisos; nenhum dado lançado.
 */
export function ResumoUsoAdmin() {
  const listarFn = useServerFn(adminListarAcessos);
  const [dias, setDias] = useState(30);
  const [plataforma, setPlataforma] = useState<"todas" | "site" | "app">("todas");
  const [pessoa, setPessoa] = useState("todas");
  const [busca, setBusca] = useState("");
  const { data: acessos = [], isLoading } = useQuery({
    queryKey: ["admin-resumo-uso", dias],
    queryFn: () => listarFn({ data: { dias } }),
  });

  const logados = (acessos as AcessoSite[]).filter((a) => a.user_id);
  const pessoas = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of logados) m.set(a.user_id!, a.nome || "Sem nome");
    return [...m.entries()].sort((x, y) => x[1].localeCompare(y[1]));
  }, [logados]);

  const filtrados = logados.filter((a) => {
    if (plataforma !== "todas" && (a.plataforma ?? "site") !== plataforma) return false;
    if (pessoa !== "todas" && a.user_id !== pessoa) return false;
    if (busca && !nomeDoMenu(a.caminho).toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });
  const telas = filtrados.filter((a) => !a.caminho.startsWith("/evento/"));
  const eventos = filtrados.filter((a) => a.caminho.startsWith("/evento/"));

  const porMenu = useMemo(() => {
    const m = new Map<string, { menu: string; acessos: number; pessoas: Set<string>; site: number; app: number; ultimo: string }>();
    for (const a of telas) {
      const menu = nomeDoMenu(a.caminho);
      const r = m.get(menu) ?? { menu, acessos: 0, pessoas: new Set<string>(), site: 0, app: 0, ultimo: a.criado_em };
      r.acessos++;
      r.pessoas.add(a.user_id!);
      if ((a.plataforma ?? "site") === "app") r.app++;
      else r.site++;
      if (a.criado_em > r.ultimo) r.ultimo = a.criado_em;
      m.set(menu, r);
    }
    return [...m.values()].sort((x, y) => y.acessos - x.acessos);
  }, [telas]);

  const porPessoa = useMemo(() => {
    const m = new Map<string, { nome: string; acessos: number; menus: Set<string>; ultimo: string; preferido: Map<string, number> }>();
    for (const a of telas) {
      const r = m.get(a.user_id!) ?? { nome: a.nome || "Sem nome", acessos: 0, menus: new Set<string>(), ultimo: a.criado_em, preferido: new Map() };
      const menu = nomeDoMenu(a.caminho);
      r.acessos++;
      r.menus.add(menu);
      r.preferido.set(menu, (r.preferido.get(menu) ?? 0) + 1);
      if (a.criado_em > r.ultimo) r.ultimo = a.criado_em;
      m.set(a.user_id!, r);
    }
    return [...m.values()].sort((x, y) => y.acessos - x.acessos);
  }, [telas]);

  const porEvento = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of eventos) m.set(a.caminho.slice(8), (m.get(a.caminho.slice(8)) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [eventos]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 7, 30, 90, 180].map((d) => (
                <SelectItem key={d} value={String(d)}>{d === 1 ? "Hoje" : `Últimos ${d} dias`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={plataforma} onValueChange={(v) => setPlataforma(v as typeof plataforma)}>
            <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Site e app</SelectItem>
              <SelectItem value="site">Só site</SelectItem>
              <SelectItem value="app">Só app</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pessoa} onValueChange={setPessoa}>
            <SelectTrigger className="h-9 w-48 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as pessoas</SelectItem>
              {pessoas.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar menu" className="h-9 w-44 text-xs" />
          <p className="ml-auto text-xs text-muted-foreground">
            {isLoading ? "Carregando…" : `${telas.length} telas abertas · ${porPessoa.length} pessoas · ${porMenu.length} menus`}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Menus mais acessados</CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b text-muted-foreground"><th className="p-1.5">Menu</th><th className="p-1.5">Acessos</th><th className="p-1.5">Pessoas</th><th className="p-1.5">Site / App</th><th className="p-1.5">Último</th></tr></thead>
              <tbody>
                {porMenu.map((r) => (
                  <tr key={r.menu} className="border-b last:border-0">
                    <td className="p-1.5 font-medium">{r.menu}</td>
                    <td className="p-1.5">{r.acessos}</td>
                    <td className="p-1.5">{r.pessoas.size}</td>
                    <td className="p-1.5">{r.site} / {r.app}</td>
                    <td className="p-1.5 text-muted-foreground">{dataBr(r.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por pessoa</CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b text-muted-foreground"><th className="p-1.5">Pessoa</th><th className="p-1.5">Acessos</th><th className="p-1.5">Menus</th><th className="p-1.5">Mais usado</th><th className="p-1.5">Último</th></tr></thead>
              <tbody>
                {porPessoa.map((r) => {
                  const preferido = [...r.preferido.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "";
                  return (
                    <tr key={r.nome + r.ultimo} className="border-b last:border-0">
                      <td className="p-1.5 font-medium">{r.nome}</td>
                      <td className="p-1.5">{r.acessos}</td>
                      <td className="p-1.5">{r.menus.size}</td>
                      <td className="p-1.5">{preferido}</td>
                      <td className="p-1.5 text-muted-foreground">{dataBr(r.ultimo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Avisos (beta, convite de amigos)</CardTitle></CardHeader>
        <CardContent>
          {porEvento.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento no período.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {porEvento.map(([ev, n]) => (
                <span key={ev} className="rounded-full border px-2.5 py-1 text-xs">{ev}: <b>{n}</b></span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Só o nome da tela, a data e site/app de quem está logado. Nenhum valor ou lançamento é registrado.
      </p>
    </div>
  );
}
