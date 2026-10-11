import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MacroEstrutura } from "@/lib/macro-categorias";
import { cn } from "@/lib/utils";

/**
 * Seletor em duas etapas (2026-10-11).
 *
 * Campo "categoria": mostra as macro categorias em negrito. Ao escolher uma
 * macro, abrem as subcategorias dela (com a opção de usar só a macro).
 * Digitando, a busca também acha subcategorias ("veterinário" leva a
 * "Pets › Veterinário" e preenche macro e subcategoria de uma vez).
 *
 * Campo "subcategoria": lista as subcategorias da categoria escolhida e
 * permite criar uma nova ali mesmo.
 */

const normal = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function SeletorCategoria({
  campo,
  valor,
  categoriaAtual,
  estrutura,
  onEscolher,
  onCriarMacro,
  onCriarSub,
  placeholder,
  className,
  ariaLabel,
}: {
  campo: "categoria" | "subcategoria";
  valor: string | null;
  categoriaAtual?: string | null;
  estrutura: MacroEstrutura[];
  onEscolher: (categoria: string, subcategoria: string | null) => void;
  onCriarMacro?: (nome: string) => void;
  onCriarSub?: (macro: string, nome: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [macroAberta, setMacroAberta] = useState<string | null>(null);
  const termo = normal(busca.trim());

  const subsDaMacro = useMemo(
    () => estrutura.find((e) => e.macro === (macroAberta ?? categoriaAtual ?? ""))?.subcategorias ?? [],
    [estrutura, macroAberta, categoriaAtual],
  );

  const fechar = () => {
    setAberto(false);
    setBusca("");
    setMacroAberta(null);
  };

  function escolherMacro(macro: string) {
    onEscolher(macro, null);
    fechar();
  }

  function escolherSub(macro: string, sub: string) {
    onEscolher(macro, sub);
    fechar();
  }

  const textoExibido = valor;

  return (
    <Popover
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (!o) {
          setBusca("");
          setMacroAberta(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          aria-label={ariaLabel ?? placeholder ?? campo}
          className={cn("w-full justify-between gap-1 px-2 font-normal", className)}
        >
          <span className={cn("truncate", !textoExibido && "text-muted-foreground")}>
            {textoExibido ?? placeholder ?? (campo === "categoria" ? "Categoria" : "Subcategoria")}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={campo === "categoria" ? "Digite para buscar (ex.: veterinário)" : "Buscar subcategoria"}
            className="h-8 text-xs"
          />
        </div>

        <div className="max-h-72 overflow-y-auto py-1 text-sm">
          {campo === "categoria" && (
            <CategoriaLista
              estrutura={estrutura}
              termo={termo}
              macroAberta={macroAberta}
              setMacroAberta={setMacroAberta}
              escolherMacro={escolherMacro}
              escolherSub={escolherSub}
              valorAtual={valor}
              onCriarMacro={onCriarMacro}
              busca={busca.trim()}
              subsDaMacro={subsDaMacro}
              fechar={fechar}
            />
          )}

          {campo === "subcategoria" && (
            <SubLista
              macro={categoriaAtual ?? null}
              subs={subsDaMacro}
              termo={termo}
              valorAtual={valor}
              busca={busca.trim()}
              onEscolher={(sub) => {
                onEscolher(categoriaAtual ?? "", sub);
                fechar();
              }}
              onCriarSub={
                onCriarSub
                  ? (m, n) => {
                      onCriarSub(m, n);
                      fechar();
                    }
                  : undefined
              }
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Linha({
  onClick,
  children,
  destaque,
  ativa,
}: {
  onClick: () => void;
  children: React.ReactNode;
  destaque?: boolean;
  ativa?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent",
        destaque && "font-semibold",
        ativa && "bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}

function CategoriaLista({
  estrutura,
  termo,
  macroAberta,
  setMacroAberta,
  escolherMacro,
  escolherSub,
  valorAtual,
  onCriarMacro,
  busca,
  subsDaMacro,
  fechar,
}: {
  estrutura: MacroEstrutura[];
  termo: string;
  macroAberta: string | null;
  setMacroAberta: (m: string | null) => void;
  escolherMacro: (m: string) => void;
  escolherSub: (macro: string, sub: string) => void;
  valorAtual: string | null;
  onCriarMacro?: ((nome: string) => void) | undefined;
  busca: string;
  subsDaMacro: string[];
  fechar: () => void;
}) {
  // Modo busca: macros e subcategorias que casam com o texto digitado.
  if (termo) {
    const resultados: { macro: string; sub: string | null }[] = [];
    for (const e of estrutura) {
      if (normal(e.macro).includes(termo)) resultados.push({ macro: e.macro, sub: null });
      for (const s of e.subcategorias) {
        if (normal(s).includes(termo) || normal(`${e.macro} ${s}`).includes(termo))
          resultados.push({ macro: e.macro, sub: s });
      }
    }
    const existe = estrutura.some((e) => normal(e.macro) === termo);
    return (
      <>
        {resultados.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nada encontrado.</p>}
        {resultados.slice(0, 80).map((r) => (
          <Linha
            key={`${r.macro}|${r.sub ?? ""}`}
            ativa={valorAtual === r.macro && !r.sub}
            onClick={() => (r.sub ? escolherSub(r.macro, r.sub) : escolherMacro(r.macro))}
          >
            <span className={cn("min-w-0 flex-1 truncate", !r.sub && "font-semibold")}>
              {r.sub ? `${r.macro} › ${r.sub}` : r.macro}
            </span>
          </Linha>
        ))}
        {onCriarMacro && !existe && (
          <Linha
            onClick={() => {
              onCriarMacro(busca);
              fechar();
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Criar categoria "{busca}"</span>
          </Linha>
        )}
      </>
    );
  }

  // Dentro de uma macro: subcategorias.
  if (macroAberta) {
    return (
      <>
        <Linha onClick={() => setMacroAberta(null)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span className="text-muted-foreground">Voltar</span>
        </Linha>
        <Linha ativa={valorAtual === macroAberta} destaque onClick={() => escolherMacro(macroAberta)}>
          <span className="min-w-0 flex-1 truncate">Usar só "{macroAberta}"</span>
        </Linha>
        {subsDaMacro.map((s) => (
          <Linha key={s} onClick={() => escolherSub(macroAberta, s)}>
            <span className="min-w-0 flex-1 truncate pl-3">{s}</span>
          </Linha>
        ))}
      </>
    );
  }

  // Lista de macros.
  return (
    <>
      {estrutura.map((e) => (
        <Linha key={e.macro} ativa={valorAtual === e.macro} onClick={() => setMacroAberta(e.macro)}>
          <span className="min-w-0 flex-1 truncate font-semibold">{e.macro}</span>
          {e.subcategorias.length > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">{e.subcategorias.length}</span>
          )}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Linha>
      ))}
    </>
  );
}

function SubLista({
  macro,
  subs,
  termo,
  valorAtual,
  busca,
  onEscolher,
  onCriarSub,
}: {
  macro: string | null;
  subs: string[];
  termo: string;
  valorAtual: string | null;
  busca: string;
  onEscolher: (sub: string | null) => void;
  onCriarSub?: ((macro: string, nome: string) => void) | undefined;
}) {
  if (!macro) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Escolha a categoria primeiro.</p>;
  }
  const filtradas = termo ? subs.filter((s) => normal(s).includes(termo)) : subs;
  const existe = subs.some((s) => normal(s) === termo);
  return (
    <>
      <Linha ativa={!valorAtual} onClick={() => onEscolher(null)}>
        <span className="text-muted-foreground">Nenhuma</span>
      </Linha>
      {filtradas.map((s) => (
        <Linha key={s} ativa={valorAtual === s} onClick={() => onEscolher(s)}>
          <span className="min-w-0 flex-1 truncate">{s}</span>
        </Linha>
      ))}
      {onCriarSub && busca && !existe && (
        <Linha onClick={() => onCriarSub(macro, busca)}>
          <Plus className="size-4" aria-hidden="true" />
          <span>Criar subcategoria "{busca}"</span>
        </Linha>
      )}
    </>
  );
}
