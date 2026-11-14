import { createFileRoute } from "@tanstack/react-router";
import { Check, Palette } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePreferencias, type ChaveRegraSaldo } from "@/hooks/usePreferencias";

export const Route = createFileRoute("/_authenticated/personalizacao")({
  head: () => ({
    meta: [
      { title: "Personalização | Control ALL" },
      {
        name: "description",
        content: "Escolha tema claro ou escuro, paleta de cores, fonte e layout do menu do app.",
      },
      { property: "og:title", content: "Personalização | Control ALL" },
      { property: "og:description", content: "Deixe o app com a cara do casal: tema, cores e fontes." },
    ],
  }),
  component: PersonalizacaoPage,
});

const PALETAS = [
  { id: "azul", label: "Azul", cor: "#2563eb" },
  { id: "verde", label: "Verde", cor: "#16a34a" },
  { id: "roxo", label: "Roxo", cor: "#7c3aed" },
  { id: "laranja", label: "Laranja", cor: "#ea580c" },
  { id: "rosa", label: "Rosa", cor: "#db2777" },
  { id: "grafite", label: "Grafite", cor: "#334155" },
  { id: "turquesa", label: "Turquesa", cor: "#0ea5a4" },
  { id: "indigo", label: "Índigo", cor: "#4f46e5" },
  { id: "vinho", label: "Vinho", cor: "#9f1239" },
  { id: "ouro", label: "Ouro", cor: "#ca8a04" },
  { id: "menta", label: "Menta", cor: "#34d399" },
  { id: "coral", label: "Coral", cor: "#f97316" },
  { id: "lavanda", label: "Lavanda", cor: "#a78bfa" },
  { id: "oceano", label: "Oceano", cor: "#1d4ed8" },
];

const TEMAS = [
  { id: "claro", label: "Claro" },
  { id: "escuro", label: "Escuro" },
  { id: "auto", label: "Automático" },
];

const FONTES = ["Plus Jakarta Sans", "Inter", "Nunito", "Roboto"];
const LAYOUTS = [
  { id: "lateral", label: "Menu lateral" },
  { id: "superior", label: "Menu superior" },
];

/** Regras de saldo (07/11/2026): o que entra nos totais de saldo e nas previsões. */
const REGRAS_SALDO: { chave: ChaveRegraSaldo; titulo: string; detalhe: string }[] = [
  {
    chave: "somar_transferencias",
    titulo: "Somar transferências",
    detalhe: "Dinheiro movido entre suas contas entra no saldo. Desligado, não muda o total.",
  },
  {
    chave: "somar_pagamento_fatura",
    titulo: "Somar pagamento de fatura",
    detalhe: "Conta o pagamento da fatura como saída. Desligado, só as compras do cartão contam.",
  },
  {
    chave: "mostrar_fatura_aberta",
    titulo: "Mostrar fatura aberta",
    detalhe: "Inclui na previsão a fatura que ainda não fechou, com as compras feitas até agora.",
  },
  {
    chave: "somar_investimentos",
    titulo: "Somar investimentos",
    detalhe: "Aportes e resgates entram no saldo. Desligado, ficam só na tela de investimentos.",
  },
];

function PersonalizacaoPage() {
  const { prefs, save } = usePreferencias();

  const aplicar = (values: Record<string, string>) =>
    save.mutate(values, { onSuccess: () => toast.success("Preferências salvas") });

  const aplicarRegra = (chave: ChaveRegraSaldo, valor: boolean) =>
    save.mutate(
      { [chave]: valor },
      {
        onSuccess: () => toast.success("Preferências salvas"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar. Tente de novo."),
      },
    );

  return (
    <AppLayout title="Personalização" description="Ajuste a aparência do aplicativo">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="size-4" /> Tema
            </CardTitle>
            <p className="text-sm text-muted-foreground">Claro, escuro ou conforme o sistema.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {TEMAS.map((t) => (
              <Button
                key={t.id}
                variant={prefs.tema === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => aplicar({ tema: t.id })}
              >
                {prefs.tema === t.id && <Check className="size-4" />} {t.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paleta de cores</CardTitle>
            <p className="text-sm text-muted-foreground">Cor de destaque dos botões e realces.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {PALETAS.map((p) => (
              <button
                key={p.id}
                onClick={() => aplicar({ paleta: p.id })}
                className="flex flex-col items-center gap-1.5"
                aria-label={`Paleta ${p.label}`}
              >
                <span
                  className={`flex size-10 items-center justify-center rounded-full border-2 transition-transform ${
                    prefs.paleta === p.id ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: p.cor }}
                >
                  {prefs.paleta === p.id && <Check className="size-4 text-white" />}
                </span>
                <span className="text-xs text-muted-foreground">{p.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fonte</CardTitle>
            <p className="text-sm text-muted-foreground">Tipografia usada em todo o app.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {FONTES.map((f) => (
              <Button
                key={f}
                variant={prefs.fonte === f ? "default" : "outline"}
                size="sm"
                onClick={() => aplicar({ fonte: f })}
                style={{ fontFamily: `"${f}"` }}
              >
                {f}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Layout do menu</CardTitle>
            <p className="text-sm text-muted-foreground">Posição da navegação no computador.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {LAYOUTS.map((l) => (
              <Button
                key={l.id}
                variant={prefs.layout_menu === l.id ? "default" : "outline"}
                size="sm"
                onClick={() => aplicar({ layout_menu: l.id })}
              >
                {l.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8 max-w-2xl">
        <h2 className="mb-2 px-4 text-sm font-semibold text-muted-foreground">Unidade dos valores</h2>
        <div className="rounded-3xl border bg-card px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["completo", "Completo (R$ 12.345,67)"],
              ["mil", "Mil (R$ 12,3 mil)"],
              ["k", "K (R$ 12,3k)"],
            ] as const).map(([id, rotulo]) => (
              <Button
                key={id}
                size="sm"
                variant={prefs.formato_valores === id ? "default" : "outline"}
                disabled={save.isPending}
                onClick={() => save.mutate({ formato_valores: id }, { onSuccess: () => toast.success("Preferências salvas") })}
              >
                {rotulo}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Vale para cards de resumo e gráficos. Listas, formulários e faturas continuam completos.
          </p>
        </div>
      </section>

      <section className="mt-8 max-w-2xl">
        <h2 className="mb-2 px-4 text-sm font-semibold text-muted-foreground">Saldos e valores</h2>
        <div className="divide-y overflow-hidden rounded-3xl border bg-card">
          {REGRAS_SALDO.map((r) => (
            <div key={r.chave} className="flex min-h-14 items-center gap-4 px-5 py-3">
              <label htmlFor={`regra-${r.chave}`} className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{r.titulo}</span>
                <span className="block text-xs text-muted-foreground">{r.detalhe}</span>
              </label>
              <Switch
                id={`regra-${r.chave}`}
                className="shrink-0"
                checked={prefs[r.chave]}
                disabled={save.isPending}
                onCheckedChange={(v) => aplicarRegra(r.chave, v)}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 px-4 text-xs text-muted-foreground">
          Vale para os seus relatórios e previsões. Os lançamentos não mudam.
        </p>
      </section>
    </AppLayout>
  );
}
