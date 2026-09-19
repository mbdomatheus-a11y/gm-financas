import { useMemo, useRef, useState } from "react";
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
  {
    label: string;
    capacidadeMax: number; // sempre em mL
    unidade: "UI" | "mL";
    titulo: string;
    passoMaior: number; // intervalo entre marcas grandes numeradas, na unidade de exibição
    passoMenor: number; // intervalo entre traços finos, na unidade de exibição
  }
> = {
  "100ui_1ml": {
    label: "Seringa de 1 mL (escala de 100 UI)",
    capacidadeMax: 1.0,
    unidade: "UI",
    titulo: "Seringa de 1 mL — escala de 100 UI",
    passoMaior: 10,
    passoMenor: 2,
  },
  "50ui_0.5ml": {
    label: "Seringa de 0,5 mL (escala de 50 UI)",
    capacidadeMax: 0.5,
    unidade: "UI",
    titulo: "Seringa de 0,5 mL — escala de 50 UI",
    passoMaior: 5,
    passoMenor: 1,
  },
  "3ml": {
    label: "Seringa geral de 3 mL (escala em mL)",
    capacidadeMax: 3.0,
    unidade: "mL",
    titulo: "Seringa geral de 3 mL",
    passoMaior: 0.5,
    passoMenor: 0.1,
  },
  "20ml": {
    label: "Seringa geral de 20 mL (escala em mL)",
    capacidadeMax: 20.0,
    unidade: "mL",
    titulo: "Seringa geral de 20 mL",
    passoMaior: 5,
    passoMenor: 1,
  },
};

/** Converte um volume em mL para a unidade de exibição da seringa (UI ou mL). */
function volumeParaUnidade(volumeMl: number, seringa: (typeof SERINGAS)[SeringaTipo]): number {
  return seringa.unidade === "UI" ? volumeMl * 100 : volumeMl;
}

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

  const barraRef = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState(false);

  /** Define o volume (mL) direto a partir de uma posição arrastada na barra,
   * e recalcula mg/UI a partir dele — mesma lógica de recalcularDeUi, mas
   * partindo do volume já calculado em vez de reconverter a partir do texto. */
  function definirVolumePorArraste(vol: number) {
    const fMg = paraNumero(frascoMg);
    const fMl = paraNumero(frascoMl);
    const volClamped = Math.min(seringa.capacidadeMax, Math.max(0, vol));
    setVolume(volClamped);
    setDoseUi((volClamped * 100).toFixed(1));
    if (fMg > 0 && fMl > 0) {
      setDoseMg(((volClamped * fMg) / fMl).toFixed(2));
    }
  }

  function volumeNaPosicao(clientX: number): number {
    const el = barraRef.current;
    if (!el) return volume;
    const rect = el.getBoundingClientRect();
    const fracao = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return fracao * seringa.capacidadeMax;
  }

  function onPointerDownBarra(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastando(true);
    definirVolumePorArraste(volumeNaPosicao(e.clientX));
  }
  function onPointerMoveBarra(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    definirVolumePorArraste(volumeNaPosicao(e.clientX));
  }
  function onPointerUpBarra(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setArrastando(false);
  }

  const seringa = SERINGAS[seringaTipo];
  const percentual = Math.min(100, Math.max(0, (volume / seringa.capacidadeMax) * 100));
  const labelPreenchido =
    seringa.unidade === "UI" ? `${(volume * 100).toFixed(1)} UI` : `${volume.toFixed(3)} mL`;

  // Traços da régua: maiores (numerados) e intermediários (finos), sempre
  // posicionados proporcionalmente à escala real, não só espaçados por CSS.
  const tracosMaiores = useMemo(() => {
    const max = volumeParaUnidade(seringa.capacidadeMax, seringa);
    const lista: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += seringa.passoMaior) lista.push(Math.round(v * 100) / 100);
    return lista;
  }, [seringa]);
  const tracosMenores = useMemo(() => {
    const max = volumeParaUnidade(seringa.capacidadeMax, seringa);
    const lista: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += seringa.passoMenor) lista.push(Math.round(v * 100) / 100);
    return lista;
  }, [seringa]);

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
        "Visualização didática da posição do êmbolo. Esta simulação não representa a precisão de uma seringa real.",
    };
  }, [volume, seringa, seringaTipo]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -right-1 -top-5 z-10 -rotate-12 select-none rounded-sm border border-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning/50">
        Uso somente acadêmico
      </div>
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
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Syringe className="size-4" /> {seringa.titulo}
              </p>
              <span className="text-xs text-muted-foreground">arraste na régua para ajustar</span>
            </div>

            {/* Barra arrastável: clique ou toque em qualquer ponto e arraste
                para definir a dose direto na escala — atualiza mg/UI acima. */}
            <div
              ref={barraRef}
              onPointerDown={onPointerDownBarra}
              onPointerMove={onPointerMoveBarra}
              onPointerUp={onPointerUpBarra}
              onPointerCancel={onPointerUpBarra}
              className={cn(
                "relative h-14 touch-none select-none overflow-hidden rounded border-2 bg-muted",
                arrastando ? "border-primary" : "border-muted-foreground/30",
              )}
              role="slider"
              aria-label={`Volume na ${seringa.titulo}`}
              aria-valuemin={0}
              aria-valuemax={seringa.capacidadeMax}
              aria-valuenow={volume}
            >
              <div
                className="h-full bg-primary/40 transition-[width] duration-100 ease-out"
                style={{ width: `${percentual}%` }}
              />
              {/* Marcas intermediárias existentes na escala, sem criar graduações fictícias. */}
              {tracosMenores.map((v) => {
                const pos = (v / volumeParaUnidade(seringa.capacidadeMax, seringa)) * 100;
                return (
                  <div
                    key={`menor-${v}`}
                    className="pointer-events-none absolute top-0 h-1/2 w-px bg-muted-foreground/55"
                    style={{ left: `${pos}%` }}
                  />
                );
              })}
              {/* Traços grandes (numerados) */}
              {tracosMaiores.map((v) => {
                const pos = (v / volumeParaUnidade(seringa.capacidadeMax, seringa)) * 100;
                return (
                  <div
                    key={`maior-${v}`}
                    className="pointer-events-none absolute top-0 h-4/5 w-0.5 bg-muted-foreground/75"
                    style={{ left: `${pos}%` }}
                  />
                );
              })}
              {/* Ponteiro/êmbolo: sempre visível, mesmo com volume muito baixo */}
              <div
                className="absolute top-0 h-full w-1 -translate-x-1/2 bg-primary shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
                style={{ left: `${percentual}%` }}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-card/90 px-1.5 py-0.5 text-sm font-bold shadow-sm">
                {labelPreenchido}
              </span>
            </div>

            <div className="relative mt-1 h-4 text-[11px] font-semibold text-muted-foreground">
              {tracosMaiores.map((v) => {
                const pos = (v / volumeParaUnidade(seringa.capacidadeMax, seringa)) * 100;
                return (
                  <span
                    key={`label-${v}`}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${pos}%` }}
                  >
                    {v % 1 === 0 ? v : v.toFixed(1)}
                  </span>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Escala em {seringa.unidade} · traço maior a cada {seringa.passoMaior}{" "}
              {seringa.unidade}, traço fino a cada {seringa.passoMenor} {seringa.unidade}.
            </p>
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
