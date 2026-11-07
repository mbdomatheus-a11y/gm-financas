import { useState } from "react";
import { Calculator, Copy, Delete } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Calculadora simples de tela (item 18, 2026-10-05): botão no topo de toda
 * tela autenticada. Sem eval: a expressão é interpretada por um parser
 * recursivo próprio (+, -, ×, ÷, parênteses, vírgula decimal e %).
 */
export function avaliarExpressao(entrada: string): number | null {
  const src = entrada
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  if (!src) return null;
  let i = 0;
  function numero(): number {
    const ini = i;
    while (i < src.length && /[0-9.]/.test(src[i]!)) i++;
    if (ini === i) throw new Error("num");
    const n = Number(src.slice(ini, i));
    if (Number.isNaN(n)) throw new Error("num");
    return n;
  }
  function fator(): number {
    if (src[i] === "-") {
      i++;
      return -fator();
    }
    if (src[i] === "+") {
      i++;
      return fator();
    }
    let v: number;
    if (src[i] === "(") {
      i++;
      v = soma();
      if (src[i] !== ")") throw new Error("par");
      i++;
    } else {
      v = numero();
    }
    while (src[i] === "%") {
      i++;
      v = v / 100;
    }
    return v;
  }
  function produto(): number {
    let v = fator();
    while (src[i] === "*" || src[i] === "/") {
      const op = src[i++];
      const d = fator();
      v = op === "*" ? v * d : v / d;
    }
    return v;
  }
  function soma(): number {
    let v = produto();
    while (src[i] === "+" || src[i] === "-") {
      const op = src[i++];
      const d = produto();
      v = op === "+" ? v + d : v - d;
    }
    return v;
  }
  try {
    const r = soma();
    if (i !== src.length || !Number.isFinite(r)) return null;
    return Math.round(r * 1e10) / 1e10;
  } catch {
    return null;
  }
}

const TECLAS = [
  "(", ")", "%", "÷",
  "7", "8", "9", "×",
  "4", "5", "6", "-",
  "1", "2", "3", "+",
  "0", ",", "⌫", "=",
];

export function CalculadoraRapida() {
  const [expr, setExpr] = useState("");
  const resultado = avaliarExpressao(expr);
  const textoResultado =
    resultado === null
      ? ""
      : resultado.toLocaleString("pt-BR", { maximumFractionDigits: 10 });

  function tecla(t: string) {
    if (t === "⌫") return setExpr((e) => e.slice(0, -1));
    if (t === "=") {
      if (resultado !== null) setExpr(String(resultado).replace(".", ","));
      return;
    }
    setExpr((e) => (e + t).slice(0, 80));
  }

  async function copiar() {
    if (resultado === null) return;
    const valor = String(resultado).replace(".", ",");
    try {
      await navigator.clipboard.writeText(valor);
      toast.success(`Valor ${valor} copiado.`);
    } catch {
      toast.error("Não consegui copiar. Selecione o valor e copie manualmente.");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir calculadora"
          title="Calculadora"
          className="size-9 rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Calculator className="size-4.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 space-y-3 rounded-2xl border bg-background/95 shadow-lg backdrop-blur-xl p-4">
        <input
          value={expr}
          onChange={(e) => setExpr(e.target.value.replace(/[^0-9+\-*/×÷().,%\s]/g, "").slice(0, 80))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              tecla("=");
            }
          }}
          inputMode="decimal"
          placeholder="Digite uma conta, ex.: 120+35,5"
          className="h-10 w-full rounded-xl border bg-background px-3 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Expressão"
        />
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
          <span className="min-w-0 truncate text-xl font-semibold tabular-nums">{textoResultado || "0"}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 rounded-full bg-background"
            onClick={copiar}
            disabled={resultado === null}
          >
            <Copy className="size-3.5" /> Copiar
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TECLAS.map((t) => (
            <Button
              key={t}
              type="button"
              variant={/[0-9,]/.test(t) ? "secondary" : "outline"}
              className="h-10 rounded-xl text-base tabular-nums"
              onClick={() => tecla(t)}
            >
              {t === "⌫" ? <Delete className="size-4" /> : t}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-10 w-full rounded-xl text-muted-foreground hover:bg-muted" onClick={() => setExpr("")}>
          Limpar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
