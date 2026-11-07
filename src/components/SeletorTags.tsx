import { useMemo, useState } from "react";
import { Check, Plus, Tag as TagIcon, X } from "lucide-react";
import { toast } from "sonner";

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
import { CORES_TAGS, type Tag, useTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

/** Chip de uma tag, com a cor dela. */
export function ChipTag({
  tag,
  onRemover,
  className,
}: {
  tag: Pick<Tag, "nome" | "cor">;
  onRemover?: (() => void) | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      style={{ backgroundColor: `${tag.cor}1f`, color: tag.cor }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tag.cor }} aria-hidden="true" />
      <span className="truncate">{tag.nome}</span>
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          className="-mr-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          aria-label={`Remover tag ${tag.nome}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function chave(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Multi-seleção de tags em Popover, com busca e "criar tag" na hora (07/11/2026).
 * Controlado: recebe os ids escolhidos e devolve a nova lista em `onChange`.
 * Para gravar no lançamento use `definirTagsDoLancamento` ou `useVincularTags().definir` (useTags.ts).
 */
export function SeletorTags({
  valor,
  onChange,
  placeholder = "Adicionar tags",
  disabled,
  className,
}: {
  valor: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { tags, tabelaPendente, criar } = useTags();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const escolhidas = useMemo(() => new Set(valor), [valor]);
  const selecionadas = useMemo(() => tags.filter((t) => escolhidas.has(t.id)), [tags, escolhidas]);
  const digitado = busca.replace(/\s+/g, " ").trim();
  const jaExiste = tags.some((t) => chave(t.nome) === chave(digitado));

  function alternar(id: string) {
    onChange(escolhidas.has(id) ? valor.filter((v) => v !== id) : [...valor, id]);
  }

  function criarNaHora() {
    if (!digitado || jaExiste) return;
    const cor = CORES_TAGS[tags.length % CORES_TAGS.length]!.valor;
    criar.mutate(
      { nome: digitado, cor },
      {
        onSuccess: (nova) => {
          onChange([...valor, nova.id]);
          setBusca("");
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível criar a tag."),
      },
    );
  }

  if (tabelaPendente) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {selecionadas.map((t) => (
        <ChipTag key={t.id} tag={t} onRemover={disabled ? undefined : () => alternar(t.id)} />
      ))}
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-7 gap-1 rounded-full px-2.5 text-xs font-normal"
            aria-label={placeholder}
          >
            <TagIcon className="size-3.5" aria-hidden="true" />
            {selecionadas.length === 0 ? placeholder : "Tags"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 rounded-2xl p-0" align="start">
          <Command
            filter={(value, search) => (chave(value).includes(chave(search)) ? 1 : 0)}
          >
            <CommandInput
              placeholder="Buscar ou criar tag…"
              value={busca}
              onValueChange={setBusca}
              onKeyDown={(e) => {
                if (e.key === "Enter" && digitado && !jaExiste) {
                  e.preventDefault();
                  criarNaHora();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>{digitado ? "Nenhuma tag com esse nome." : "Nenhuma tag criada ainda."}</CommandEmpty>
              {tags.length > 0 && (
                <CommandGroup>
                  {tags.map((t) => (
                    <CommandItem key={t.id} value={t.nome} onSelect={() => alternar(t.id)} className="gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.cor }} aria-hidden="true" />
                      <span className="flex-1 truncate">{t.nome}</span>
                      <Check className={cn("size-4", escolhidas.has(t.id) ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {digitado && !jaExiste && (
                <CommandGroup forceMount>
                  <CommandItem value={`__criar__${digitado}`} onSelect={criarNaHora} disabled={criar.isPending} className="gap-2" forceMount>
                    <Plus className="size-4" />
                    Criar tag "{digitado}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
