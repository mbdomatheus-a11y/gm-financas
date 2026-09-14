import { useMemo, useState } from "react";
import { AlertTriangle, Syringe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SeringaTipo = "100ui_1ml" | "50ui_0.5ml" | "3ml" | "20ml";

const SERINGAS: Record<
  SeringaTipo,
  { label: string; capacidadeMax: number; unidade: "UI" | "mL"; titulo: string; marcas: string[] }
> = {
  "100ui_1ml": {
    label: "Seringa de 1 mL (escala de 100 UI)",
    capacidadeMax: 1.0,
    unidade: "UI",
    titulo: "Seringa de 1 mL — escala de 100 UI",
    marcas: ["0 UI", "20 UI", "40 UI", "60 UI", "80 UI", "100 UI"],
  },
  "50ui_0.5ml": {
    label: "Seringa de 0,5 mL (escala de 50 UI)",
    capacidadeMax: 0.5,
    unidade: "UI",
    titulo: "Seringa de 0,5 mL — escala de 50 UI",
    marcas: ["0 UI", "10 UI", "20 UI", "30 UI", "40 UI", "50 UI"],
  },
  "3ml": {
    label: "Seringa geral de 3 mL (escala em mL)",
    capacidadeMax: 3.0,
    unidade: "mL",
    titulo: "Seringa geral de 3 mL",
    marcas: ["0 mL", "0.5 mL", "1.0 mL", "1.5 mL", "2.0 mL", "2.5 mL", "3.0 mL"],
  },
  "20ml": {
    label: "Seringa geral de 20 mL (escala em mL)",
    capacidadeMax: 20.0,
    unidade: "mL",
    titulo: "Seringa geral de 20 mL",
    marcas: ["0 mL", "5 mL", "10 mL", "15 mL", "20 mL"],
  },
};

function paraNumero(v: string): number {
  return parseFloat(v) || 0;
}

/**
 * Simulador Interativo: converte massa (mg) do frasco em volume (mL) e
 * unidades de seringa (UI), e mostra o preenchimento numa seringa
 * desenhada em escala. Adaptado de um HTML de exemplo enviado pelo
 * usuário — mesma lógica de cálculo, reescrito em React/Tailwind pra
 * seguir o design system do site.
 *
 * ATENÇÃO: é só um exercício acadêmico (ver aviso inicial e a tarja fixa
 * sobre o conteúdo). Nunca deve ser usado pra decidir ou conferir uma
 * dose real — isso é ato exclusivo de profissional de saúde habilitado,
 * e um erro aqui, se levado pra vida real, pode ser fatal.
 */
export function SimuladorInterativo() {
  const [aceito, setAceito] = useState(false);

  const [frascoMg, setFrascoMg] = useState("15");
  const [frascoMl, setFrascoMl] = useState("0.5");
  const [seringaTipo, setSeringaTipo] = useState<SeringaTipo>("100ui_1ml");
  const [doseMg, setDoseMg] = useState("2.4");
  const [doseUi, setDoseUi] = useState("8");
  const [volume, setVolume] = useState(0.08); // mL, sempre a fonte da verdade pro desenho da seringa

  function recalcularDeMg(mgStr: string, fMgStr: string, fMlStr: string) {
    const fMg = paraNumero(fMgStr);
    const fMl = paraNumero(fMlStr);
    if (fMg <= 0 || fMl <= 0) {
      setVolume(0);
      return;
    }
    const vol = (paraNumero(mgStr) * fMl) / fMg;
    setVolume(vol);
    setDoseUi((vol * 100).toFixed(1));
  }

  function recalcularDeUi(uiStr: string, fMgStr: string, fMlStr: string) {
    const fMg = paraNumero(fMgStr);
    const fMl = paraNumero(fMlStr);
    if (fMg <= 0 || fMl <= 0) {
      setVolume(0);
      return;
    }
    const vol = paraNumero(uiStr) / 100;
    setVolume(vol);
    setDoseMg(((vol * fMg) / fMl).toFixed(2));
  }

  function onDoseMgChange(v: string) {
    setDoseMg(v);
    recalcularDeMg(v, frascoMg, frascoMl);
  }
  function onDoseUiChange(v: string) {
    setDoseUi(v);
    recalcularDeUi(v, frascoMg, frascoMl);
  }
  function onFrascoMgChange(v: string) {
    setFrascoMg(v);
    recalcularDeMg(doseMg, v, frascoMl);
  }
  function onFrascoMlChange(v: string) {
    setFrascoMl(v);
    recalcularDeMg(doseMg, frascoMg, v);
  }

  const seringa = SERINGAS[seringaTipo];
  const percentual = Math.min(100, Math.max(0, (volume / seringa.capacidadeMax) * 100));
  const labelPreenchido =
    seringa.unidade === "UI" ? `${(volume * 100).toFixed(0)} UI` : `${volume.toFixed(2)} mL`;

  const alerta = useMemo(() => {
    if (volume <= 0) return null;
    if (volume > seringa.capacidadeMax) {
      return {
        tipo: "danger" as const,
        mensagem: `Transbordamento: o volume necessário (${volume.toFixed(2)} mL) excede a capacidade física desta seringa (${seringa.capacidadeMax} ${seringa.unidade === "UI" ? "UI/mL equivalentes" : "mL"}). Escolha uma seringa maior.`,
      };
    }
    if (seringaTipo === "20ml" && volume < 1.0) {
      return {
        tipo: "danger" as const,
        mensagem: `Erro crítico de escala: medir ${volume.toFixed(2)} mL numa seringa de 20 mL não é seguro — os traços dessa seringa são de 1 em 1 mL, sem precisão pra volumes tão pequenos. Escolha uma seringa menor.`,
      };
    }
    return {
      tipo: "success" as const,
      mensagem:
        "Volume perfeitamente visível e mensurável na escala selecionada — o traço indicado acima é onde o êmbolo deveria parar.",
    };
  }, [volume, seringa, seringaTipo]);

  return (
    <div className="relative">
      {!aceito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-2xl">
            <AlertTriangle className="mx-auto size-10 text-destructive" />
            <h3 className="mt-3 text-lg font-bold text-destructive">Aviso de uso acadêmico</h3>
            <p className="mt-3 text-left text-sm text-muted-foreground">
              Este <strong>Simulador Interativo</strong> é só um exercício didático, pensado pra
              ajudar a entender leitura de escala de seringa e cálculo de diluição em sala de aula.
              Não é uma ferramenta clínica e não substitui nenhum protocolo, cálculo ou conferência
              de dose reais.
            </p>
            <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-left text-sm font-semibold text-destructive">
              Um erro real de dose ou diluição pode ser fatal e levar o paciente a óbito. Nunca use
              os resultados daqui pra decidir ou conferir uma dose de verdade — isso é ato exclusivo
              de profissional de saúde legalmente habilitado.
            </p>
            <Button className="mt-5 w-full" onClick={() => setAceito(true)}>
              Entendi, é só um exercício acadêmico
            </Button>
          </div>
        </div>
      )}

      <div className={cn("relative overflow-hidden", !aceito && "pointer-events-none blur-[2px]")}>
        {/* Tarja discreta, sempre visível sobre o conteúdo do simulador */}
        <div className="pointer-events-none absolute inset-x-[-15%] top-[42%] z-10 -rotate-6 select-none">
          <div className="whitespace-nowrap bg-warning/20 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-warning sm:text-xs">
            Uso somente acadêmico — não use para decisões clínicas reais &nbsp;·&nbsp; Uso somente
            acadêmico — não use para decisões clínicas reais &nbsp;·&nbsp; Uso somente acadêmico
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
              <p className="text-sm font-semibold">1. Composição do frasco</p>
              <div className="space-y-1.5">
                <Label htmlFor="frasco-mg">Massa no frasco (mg)</Label>
                <Input
                  id="frasco-mg"
                  type="number"
                  step="any"
                  value={frascoMg}
                  onChange={(e) => onFrascoMgChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="frasco-ml">Volume do frasco (mL)</Label>
                <Input
                  id="frasco-ml"
                  type="number"
                  step="any"
                  value={frascoMl}
                  onChange={(e) => onFrascoMlChange(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-semibold">2. Seringa e dose desejada</p>
              <div className="space-y-1.5">
                <Label>Modelo de seringa</Label>
                <Select value={seringaTipo} onValueChange={(v) => setSeringaTipo(v as SeringaTipo)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SERINGAS) as SeringaTipo[]).map((id) => (
                      <SelectItem key={id} value={id}>
                        {SERINGAS[id].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dose-mg">Dose (mg)</Label>
                  <Input
                    id="dose-mg"
                    type="number"
                    step="any"
                    value={doseMg}
                    onChange={(e) => onDoseMgChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dose-ui">Unidades (UI)</Label>
                  <Input
                    id="dose-ui"
                    type="number"
                    step="any"
                    value={doseUi}
                    onChange={(e) => onDoseUiChange(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">Volume absoluto calculado: </span>
            <span className="text-lg font-bold tabular-nums text-primary">
              {volume.toFixed(3)}
            </span>{" "}
            <span className="text-sm text-muted-foreground">mL</span>
          </div>

          <div className="rounded-lg border border-dashed p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Syringe className="size-4" /> {seringa.titulo}
            </p>
            <div className="relative h-11 overflow-hidden rounded border-2 border-muted-foreground/30 bg-muted">
              <div
                className="h-full border-r-4 border-primary bg-primary/40 transition-[width] duration-200 ease-out"
                style={{ width: `${percentual}%` }}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold">
                {labelPreenchido}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-muted-foreground">
              {seringa.marcas.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>

          {alerta && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm font-semibold",
                alerta.tipo === "danger"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-success/40 bg-success/10 text-success",
              )}
            >
              {alerta.mensagem}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
