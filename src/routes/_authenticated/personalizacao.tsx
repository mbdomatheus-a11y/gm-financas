import { createFileRoute } from "@tanstack/react-router";
import { Check, Palette } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePreferencias } from "@/hooks/usePreferencias";

export const Route = createFileRoute("/_authenticated/personalizacao")({
  head: () => ({
    meta: [
      { title: "Personalização — Control ALL" },
      {
        name: "description",
        content: "Escolha tema claro ou escuro, paleta de cores, fonte e layout do menu do app.",
      },
      { property: "og:title", content: "Personalização — Control ALL" },
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

function PersonalizacaoPage() {
  const { prefs, save } = usePreferencias();

  const aplicar = (values: Record<string, string>) =>
    save.mutate(values, { onSuccess: () => toast.success("Preferências salvas") });

  return (
    <AppLayout title="Personalização" description="Ajuste a aparência do aplicativo">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Palette className="size-4" /> Tema
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
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
            <CardTitle className="text-sm">Paleta de cores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
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
                <span className="text-[11px] text-muted-foreground">{p.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fonte</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
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
            <CardTitle className="text-sm">Layout do menu (desktop)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
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
    </AppLayout>
  );
}
