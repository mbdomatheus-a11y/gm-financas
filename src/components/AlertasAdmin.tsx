import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CATALOGO_ALERTAS, DIAS_SEMANA, FREQUENCIAS, type CanalAlerta, type FrequenciaAlerta } from "@/lib/alertas-catalogo";
import { adminListarAlertas, adminSalvarAlerta, adminTestarAlerta, type LinhaAlertaAdmin } from "@/lib/config-alertas.functions";

const CANAIS: { valor: CanalAlerta; rotulo: string }[] = [
  { valor: "push", rotulo: "Push" },
  { valor: "app", rotulo: "Caixa de avisos" },
  { valor: "email", rotulo: "E-mail" },
];
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const numOuNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** Aba "Alertas" da Administração (14/11/2026): configuração de public.config_alertas. */
export function AlertasAdmin() {
  const listarFn = useServerFn(adminListarAlertas);
  const { data, isLoading } = useQuery({ queryKey: ["admin-config-alertas"], queryFn: () => listarFn(), staleTime: 30_000 });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando alertas...</p>;
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" /> Alertas do sistema
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Liga ou desliga cada alerta, escolhe se sai na hora ou em resumo (dia e hora de Brasília), a antecedência e os canais.
          As preferências de cada pessoa (horário e tipos desligados) continuam valendo.
        </p>
        {data?.tabelaFalta && (
          <p className="text-sm text-amber-600">A tabela config_alertas ainda não existe (migration 20261114110000). Valem os padrões abaixo.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {(data?.linhas ?? []).map((l) => (
          <LinhaAlerta key={l.tipo} linha={l} />
        ))}
      </CardContent>
    </Card>
  );
}

function LinhaAlerta({ linha }: { linha: LinhaAlertaAdmin }) {
  const item = CATALOGO_ALERTAS.find((c) => c.tipo === linha.tipo)!;
  const qc = useQueryClient();
  const salvarFn = useServerFn(adminSalvarAlerta);
  const testarFn = useServerFn(adminTestarAlerta);
  const [f, setF] = useState(linha);
  useEffect(() => setF(linha), [linha]);
  const mudou = JSON.stringify(f) !== JSON.stringify(linha);
  const ehEmail = item.origem === "email";

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({
        data: {
          tipo: f.tipo,
          ativo: f.ativo,
          frequencia: f.frequencia,
          dia_semana: f.dia_semana,
          dia_mes: f.dia_mes,
          hora: f.hora,
          antecedencia_dias: item.usaAntecedencia ? f.antecedencia_dias : null,
          canais: f.canais,
          titulo_modelo: f.titulo_modelo,
        },
      }),
    onSuccess: () => {
      toast.success(`${item.nome}: salvo.`);
      qc.invalidateQueries({ queryKey: ["admin-config-alertas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const testar = useMutation({
    mutationFn: () => testarFn({ data: { tipo: f.tipo } }),
    onSuccess: (r) =>
      r.enviados > 0
        ? toast.success(r.canal === "email" ? "E-mail de teste enviado para você." : "Push de teste enviado para seus aparelhos.")
        : toast.info("Nenhum aparelho seu com notificações ligadas."),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar o teste."),
  });

  const set = <K extends keyof LinhaAlertaAdmin>(k: K, v: LinhaAlertaAdmin[K]) => setF((x) => ({ ...x, [k]: v }));
  const alternarCanal = (c: CanalAlerta) =>
    set("canais", f.canais.includes(c) ? f.canais.filter((x) => x !== c) : [...f.canais, c]);
  const agregado = f.frequencia !== "na_hora";
  const canaisDoTipo = ehEmail ? CANAIS.filter((c) => c.valor === "email") : CANAIS.filter((c) => c.valor !== "email");

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium flex items-center gap-2">
            {item.nome}
            {!f.ativo && <Badge variant="secondary">Desligado</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">{item.descricao}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.ativo} onCheckedChange={(v) => set("ativo", v)} /> {f.ativo ? "Ligado" : "Desligado"}
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Frequência</span>
          <select className={sel} value={f.frequencia} disabled={ehEmail} onChange={(e) => set("frequencia", e.target.value as FrequenciaAlerta)}>
            {FREQUENCIAS.map((q) => (
              <option key={q.valor} value={q.valor}>{q.rotulo}</option>
            ))}
          </select>
        </label>
        {f.frequencia === "semanal" && (
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Dia da semana</span>
            <select className={sel} value={f.dia_semana ?? 1} onChange={(e) => set("dia_semana", Number(e.target.value))}>
              {DIAS_SEMANA.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </label>
        )}
        {(f.frequencia === "mensal" || f.frequencia === "quinzenal") && (
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">{f.frequencia === "quinzenal" ? "Dia (e 15 dias depois)" : "Dia do mês"}</span>
            <Input className="h-9 w-20" type="number" min={1} max={f.frequencia === "quinzenal" ? 15 : 31} value={f.dia_mes ?? 1} onChange={(e) => set("dia_mes", numOuNull(e.target.value))} />
          </label>
        )}
        {!ehEmail && (agregado || item.origem === "data") && (
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">{agregado ? "Hora do resumo" : "A partir de (h)"}</span>
            <Input className="h-9 w-20" type="number" min={0} max={23} value={f.hora ?? ""} placeholder="7" onChange={(e) => set("hora", numOuNull(e.target.value))} />
          </label>
        )}
        {item.usaAntecedencia && (
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Antecedência (dias)</span>
            <Input className="h-9 w-20" type="number" min={0} max={90} value={f.antecedencia_dias ?? ""} onChange={(e) => set("antecedencia_dias", numOuNull(e.target.value))} />
          </label>
        )}
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">Canais</span>
          <div className="flex gap-1">
            {canaisDoTipo.map((c) => (
              <Button key={c.valor} type="button" size="sm" variant={f.canais.includes(c.valor) ? "default" : "outline"} onClick={() => alternarCanal(c.valor)}>
                {c.rotulo}
              </Button>
            ))}
          </div>
        </div>
        {agregado && !ehEmail && (
          <label className="space-y-1 grow">
            <span className="block text-xs text-muted-foreground">Título do resumo ({"{n}"} = quantidade)</span>
            <Input className="h-9" maxLength={120} value={f.titulo_modelo ?? ""} placeholder={item.resumo} onChange={(e) => set("titulo_modelo", e.target.value || null)} />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {linha.atualizado_em && linha.atualizadoPorNome
            ? `Alterado por ${linha.atualizadoPorNome} em ${new Date(linha.atualizado_em).toLocaleString("pt-BR")}`
            : "Padrão do sistema"}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={testar.isPending} onClick={() => testar.mutate()}>
            {testar.isPending ? "Enviando..." : "Enviar teste para mim"}
          </Button>
          <Button size="sm" disabled={!mudou || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
