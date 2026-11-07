import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCartoes, useDespesas, useInvestimentos, useReceitas } from "@/hooks/useFinance";
import { competenciaDoDia } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { listarCaixinhas } from "@/lib/poupar";
import { somarMeses } from "@/lib/recorrencia";
import { cn } from "@/lib/utils";

/**
 * Exportar dados em CSV (07/11/2026). Separador ";" e BOM UTF-8 para abrir direto no Excel
 * em português. Sem lib de .xlsx no projeto, então só CSV. Os dados vêm dos mesmos hooks
 * das telas (RLS do grupo), nada passa pelo servidor.
 */
type Periodo = "mes" | "12m" | "tudo";
type Modulo = "despesas" | "receitas" | "cartoes" | "caixinhas" | "investimentos";
type Celula = string | number | boolean | null | undefined;

const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "mes", rotulo: "Este mês" },
  { id: "12m", rotulo: "12 meses" },
  { id: "tudo", rotulo: "Tudo" },
];

function celula(v: Celula): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "number") s = Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace(".", ",") : "";
  else if (typeof v === "boolean") s = v ? "Sim" : "Não";
  else s = v;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function data(v: string | null | undefined): string {
  if (!v) return "";
  const [a, m, d] = v.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : v;
}

function montarCsv(cabecalho: string[], linhas: Celula[][]): string {
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}

function baixar(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportarDadosCard({ className }: { className?: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const mesAtual = useCompetenciaVigente();
  const despesas = useDespesas();
  const receitas = useReceitas();
  const cartoes = useCartoes();
  const investimentos = useInvestimentos();
  const caixinhas = useQuery({ queryKey: ["caixinhas"], queryFn: listarCaixinhas, retry: false });

  const desde = periodo === "mes" ? mesAtual : periodo === "12m" ? somarMeses(mesAtual, -11) : null;
  const noPeriodo = (dia: string | null | undefined) => {
    if (!desde) return true;
    if (!dia) return false;
    const c = competenciaDoDia(dia);
    return c >= desde && c <= mesAtual;
  };
  const mesNoPeriodo = (mes: string) => !desde || (mes >= desde && mes <= mesAtual);

  function gerar(modulo: Modulo): { nome: string; csv: string; linhas: number } | null {
    const sufixo = periodo === "mes" ? mesAtual : periodo === "12m" ? `${desde}_a_${mesAtual}` : "completo";
    if (modulo === "despesas") {
      const lista = ((despesas.data ?? []) as any[]).filter((d) => noPeriodo(d.data_compra));
      const linhas = lista.map((d) => [
        data(d.data_compra),
        d.descricao,
        d.estabelecimento,
        d.categoria,
        d.subcategoria,
        d.tipo,
        Number(d.valor_total),
        d.total_parcelas,
        Array.isArray(d.parcelas) ? d.parcelas.filter((p: any) => p.paga).length : null,
        d.moeda,
        d.cartoes?.apelido ?? (d.cartao_final ? `final ${d.cartao_final}` : null),
        d.bancos?.nome ?? d.banco_nome,
        d.responsavel,
        d.observacoes,
      ]);
      return {
        nome: `despesas_${sufixo}.csv`,
        linhas: linhas.length,
        csv: montarCsv(
          ["Data da compra", "Descrição", "Estabelecimento", "Categoria", "Subcategoria", "Tipo", "Valor total", "Parcelas", "Parcelas pagas", "Moeda", "Cartão", "Banco", "Responsável", "Observações"],
          linhas,
        ),
      };
    }
    if (modulo === "receitas") {
      const lista = ((receitas.data ?? []) as any[]).filter((r) => noPeriodo(r.data_recebimento));
      const linhas = lista.map((r) => [
        data(r.data_recebimento),
        r.descricao,
        r.categoria,
        Number(r.valor),
        r.moeda,
        r.recorrente,
        r.recorrente ? (r.recorrencia_sem_prazo ? "Sem prazo" : r.recorrencia_meses) : null,
        r.responsavel,
        r.observacoes,
      ]);
      return {
        nome: `receitas_${sufixo}.csv`,
        linhas: linhas.length,
        csv: montarCsv(["Data", "Descrição", "Categoria", "Valor", "Moeda", "Recorrente", "Meses", "Responsável", "Observações"], linhas),
      };
    }
    if (modulo === "cartoes") {
      const linhas = ((cartoes.data ?? []) as any[]).map((c) => [
        c.apelido,
        c.tipo,
        c.bandeira,
        c.final,
        c.titular,
        c.bancos?.nome,
        c.limite != null ? Number(c.limite) : null,
        c.dia_fechamento,
        c.dia_vencimento,
      ]);
      return {
        nome: "cartoes.csv",
        linhas: linhas.length,
        csv: montarCsv(["Apelido", "Tipo", "Bandeira", "Final", "Titular", "Banco", "Limite", "Dia de fechamento", "Dia de vencimento"], linhas),
      };
    }
    if (modulo === "caixinhas") {
      const linhas: Celula[][] = [];
      for (const c of caixinhas.data ?? []) {
        const meses = Object.keys(c.aportes).filter(mesNoPeriodo).sort();
        if (meses.length === 0) linhas.push([c.nome, Number(c.valorMensal), c.inicio, c.fim ?? "Sem prazo", null, null]);
        for (const m of meses) linhas.push([c.nome, Number(c.valorMensal), c.inicio, c.fim ?? "Sem prazo", m, Number(c.aportes[m])]);
      }
      return {
        nome: `caixinhas_${sufixo}.csv`,
        linhas: linhas.length,
        csv: montarCsv(["Caixinha", "Valor por mês", "Início", "Fim", "Mês do aporte", "Valor aportado"], linhas),
      };
    }
    const linhas = ((investimentos.data ?? []) as any[]).map((i) => [
      i.nome,
      i.tipo,
      i.instituicao,
      data(i.data_investimento),
      Number(i.valor_investido),
      Number(i.valor_atual),
      i.rentabilidade,
      i.percentual_rendimento != null ? Number(i.percentual_rendimento) : null,
      i.responsavel,
      i.observacoes,
    ]);
    return {
      nome: "investimentos.csv",
      linhas: linhas.length,
      csv: montarCsv(["Nome", "Tipo", "Instituição", "Data", "Valor investido", "Valor atual", "Rentabilidade", "Rendimento (%)", "Responsável", "Observações"], linhas),
    };
  }

  const MODULOS: { id: Modulo; rotulo: string; detalhe: string; carregando: boolean; erro: boolean }[] = [
    { id: "despesas", rotulo: "Despesas", detalhe: "Pela data da compra", carregando: despesas.isLoading, erro: despesas.isError },
    { id: "receitas", rotulo: "Receitas", detalhe: "Pela data de recebimento", carregando: receitas.isLoading, erro: receitas.isError },
    { id: "cartoes", rotulo: "Cartões", detalhe: "Cadastro completo", carregando: cartoes.isLoading, erro: cartoes.isError },
    { id: "caixinhas", rotulo: "Caixinhas", detalhe: "Aportes no período", carregando: caixinhas.isLoading, erro: caixinhas.isError },
    { id: "investimentos", rotulo: "Investimentos", detalhe: "Posição atual", carregando: investimentos.isLoading, erro: investimentos.isError },
  ];

  function exportar(modulo: Modulo) {
    const r = gerar(modulo);
    if (!r) return;
    baixar(r.nome, r.csv);
    return r.linhas;
  }

  async function exportarTudo() {
    const prontos = MODULOS.filter((m) => !m.carregando && !m.erro);
    for (const m of prontos) {
      exportar(m.id);
      // Pausa curta: alguns navegadores bloqueiam vários downloads disparados juntos.
      await new Promise((ok) => setTimeout(ok, 350));
    }
    toast.success(`${prontos.length} arquivo${prontos.length === 1 ? "" : "s"} CSV baixado${prontos.length === 1 ? "" : "s"}`);
  }

  const algumCarregando = MODULOS.some((m) => m.carregando);

  return (
    <Card className={cn("rounded-3xl", className)}>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4.5 text-primary" aria-hidden="true" />
              <p className="text-base font-semibold">Exportar dados</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Planilhas CSV que abrem direto no Excel.</p>
          </div>
          <div role="radiogroup" aria-label="Período" className="inline-flex rounded-full bg-muted p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  periodo === p.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y overflow-hidden rounded-2xl border">
          {MODULOS.map((m) => (
            <div key={m.id} className="flex min-h-14 items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.rotulo}</p>
                <p className={cn("text-xs", m.erro ? "text-destructive" : "text-muted-foreground")}>
                  {m.erro ? "Não foi possível carregar" : m.detalhe}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-primary"
                disabled={m.carregando || m.erro}
                onClick={() => {
                  const n = exportar(m.id);
                  if (n === 0) toast(`${m.rotulo}: nenhum registro no período. O arquivo saiu só com o cabeçalho.`);
                }}
              >
                <Download className="size-3.5" aria-hidden="true" />
                {m.carregando ? "Carregando" : "CSV"}
              </Button>
            </div>
          ))}
        </div>

        <Button className="w-full rounded-xl" disabled={algumCarregando} onClick={() => void exportarTudo()}>
          <Download className="size-4" aria-hidden="true" />
          Baixar tudo em CSV
        </Button>
      </CardContent>
    </Card>
  );
}
