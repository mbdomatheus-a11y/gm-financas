import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OpcaoBusca = { valor: string; rotulo: string; detalhe?: string };

/**
 * Lista suspensa com busca (2026-10-10).
 *
 * Em listas grandes (categorias, cartões, responsáveis), rolar até achar é
 * lento. Aqui a pessoa digita qualquer parte do nome e a lista filtra na hora,
 * sem diferenciar acento nem maiúscula. Opcionalmente oferece "criar novo"
 * com o que foi digitado.
 */
export function SelectBusca({
  valor,
  opcoes,
  onEscolher,
  placeholder = "Selecione",
  textoBusca = "Digite para filtrar…",
  vazio = "Nada encontrado.",
  className,
  classeConteudo,
  ariaLabel,
  disabled,
  onCriar,
  rotuloCriar = "Criar",
}: {
  valor: string | null;
  opcoes: OpcaoBusca[];
  onEscolher: (valor: string) => void;
  placeholder?: string;
  textoBusca?: string;
  vazio?: string;
  className?: string;
  classeConteudo?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Quando informado, mostra a opção de criar um item novo com o texto digitado. */
  onCriar?: (texto: string) => void;
  rotuloCriar?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const atual = useMemo(() => opcoes.find((o) => o.valor === valor) ?? null, [opcoes, valor]);
  const digitado = busca.trim();
  const jaExiste = useMemo(
    () => opcoes.some((o) => o.rotulo.localeCompare(digitado, "pt-BR", { sensitivity: "base" }) === 0),
    [opcoes, digitado],
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className={cn("w-full justify-between gap-1 font-normal", className)}
        >
          <span className={cn("truncate", !atual && "text-muted-foreground")}>
            {atual?.rotulo ?? placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", classeConteudo)} align="start">
        <Command
          filter={(value, search) => {
            if (!search) return 1;
            const normal = (t: string) =>
              t
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .toLowerCase();
            return normal(value).includes(normal(search)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={textoBusca} value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>
              {onCriar && digitado ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onCriar(digitado);
                    setBusca("");
                    setAberto(false);
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" /> {rotuloCriar} "{digitado}"
                </button>
              ) : (
                vazio
              )}
            </CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => (
                <CommandItem
                  key={o.valor}
                  value={`${o.rotulo} ${o.detalhe ?? ""}`}
                  onSelect={() => {
                    onEscolher(o.valor);
                    setBusca("");
                    setAberto(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", o.valor === valor ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
                  {o.detalhe && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{o.detalhe}</span>
                  )}
                </CommandItem>
              ))}
              {onCriar && digitado && !jaExiste && (
                <CommandItem
                  value={`__criar__ ${digitado}`}
                  onSelect={() => {
                    onCriar(digitado);
                    setBusca("");
                    setAberto(false);
                  }}
                >
                  <Plus className="mr-2 size-4" aria-hidden="true" />
                  {rotuloCriar} "{digitado}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
