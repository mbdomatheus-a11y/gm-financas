import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Campo de categoria "inteligente", igual ao app (controlall/src/components/seletor-categoria.tsx), 27/10/2026:
 * digite "mer" e aparece Mercado (começa com > palavra começa com > contém), Enter escolhe a primeira,
 * cria uma categoria nova com o texto digitado e renomeia uma existente sem sair do formulário.
 */
export type OpcaoCategoria = { nome: string; cor?: string | null };

const CORES = ["#0079BF", "#1C985A", "#E08A00", "#8E5CD9", "#D6477E", "#DB2B33", "#005BAA", "#5C7AEA", "#64748B"];

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function buscarCategorias(lista: OpcaoCategoria[], termo: string, limite = 8): OpcaoCategoria[] {
  const t = normalizar(termo);
  if (!t) return lista.slice(0, limite);
  const pontuadas: { c: OpcaoCategoria; p: number }[] = [];
  for (const c of lista) {
    const n = normalizar(c.nome);
    let p = -1;
    if (n.startsWith(t)) p = 0;
    else if (n.split(/[\s/>-]+/).some((w) => w.startsWith(t))) p = 1;
    else if (n.includes(t)) p = 2;
    if (p >= 0) pontuadas.push({ c, p });
  }
  return pontuadas
    .sort((a, b) => a.p - b.p || a.c.nome.length - b.c.nome.length || a.c.nome.localeCompare(b.c.nome))
    .slice(0, limite)
    .map((x) => x.c);
}

export function CampoCategoria({
  categorias,
  valor,
  onChange,
  tipo,
  placeholder = "Digite para buscar (ex.: mer)",
  ariaLabel,
}: {
  categorias: OpcaoCategoria[];
  valor: string;
  onChange: (nome: string) => void;
  /** Liga "Criar categoria" e "Editar" no próprio campo. */
  tipo?: "receita" | "despesa";
  placeholder?: string;
  ariaLabel?: string;
}) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [extras, setExtras] = useState<OpcaoCategoria[]>([]);
  const [renomes, setRenomes] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const todas = useMemo(() => {
    const vistas = new Set<string>();
    const out: OpcaoCategoria[] = [];
    for (const x of [...categorias.map((k) => ({ ...k, nome: renomes[k.nome] ?? k.nome })), ...extras]) {
      const chave = normalizar(x.nome);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      out.push(x);
    }
    return out;
  }, [categorias, extras, renomes]);

  const resultados = useMemo(() => buscarCategorias(todas, termo), [todas, termo]);
  const atual = todas.find((x) => x.nome === valor);
  const termoLimpo = termo.replace(/\s+/g, " ").trim();
  const podeCriar = !!tipo && termoLimpo.length >= 2 && !todas.some((x) => normalizar(x.nome) === normalizar(termoLimpo));

  // Clique fora fecha (sem depender de foco: no Safari o botão não recebe foco ao clicar).
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent | TouchEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("touchstart", aoClicar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("touchstart", aoClicar);
    };
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setTermo("");
    setEditando(null);
  }

  function escolher(nome: string) {
    onChange(nome);
    fechar();
  }

  async function criar() {
    if (!tipo || !podeCriar) return;
    if (termoLimpo.length > 40) {
      toast.error("O nome pode ter até 40 caracteres.");
      return;
    }
    setSalvando(true);
    try {
      const cor = CORES[todas.length % CORES.length] ?? "#64748B";
      const { error } = await supabase.from("categorias").insert({ nome: termoLimpo, tipo, cor } as never);
      if (error && !String(error.message).includes("duplicate")) throw error;
      setExtras((e) => [...e, { nome: termoLimpo, cor }]);
      await qc.invalidateQueries({ queryKey: ["categorias", tipo] });
      escolher(termoLimpo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a categoria.");
    } finally {
      setSalvando(false);
    }
  }

  async function renomear(antigo: string) {
    if (!tipo) return;
    const nome = novoNome.replace(/\s+/g, " ").trim();
    if (nome.length < 2 || nome === antigo) {
      setEditando(null);
      return;
    }
    if (nome.length > 40) {
      toast.error("O nome pode ter até 40 caracteres.");
      return;
    }
    setSalvando(true);
    try {
      const { data: linha, error } = await supabase
        .from("categorias")
        .select("id")
        .eq("tipo", tipo)
        .eq("nome", antigo)
        .maybeSingle();
      if (error || !linha) throw new Error("Esta categoria é padrão do sistema. Crie uma nova com o nome que quiser.");
      const { error: e2 } = await supabase.from("categorias").update({ nome } as never).eq("id", (linha as { id: string }).id);
      if (e2) throw new Error(String(e2.message).includes("duplicate") ? "Você já tem uma categoria com esse nome." : e2.message);
      setRenomes((r) => ({ ...r, [antigo]: nome }));
      setExtras((e) => e.map((x) => (x.nome === antigo ? { ...x, nome } : x)));
      if (valor === antigo) onChange(nome);
      await qc.invalidateQueries({ queryKey: ["categorias", tipo] });
      setEditando(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível renomear a categoria.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        aria-label={ariaLabel ?? "Categoria"}
        onClick={() => setAberto(true)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: atual?.cor || "var(--primary)" }} />
        <span className={cn("flex-1 truncate", !valor && "text-muted-foreground")}>{valor || "Escolher categoria"}</span>
        <span className="text-xs font-semibold text-primary">Trocar</span>
      </button>
    );
  }

  return (
    <div
      ref={caixa}
      className="overflow-hidden rounded-md border-2 border-primary bg-background shadow-sm"
    >
      <input
        autoFocus
        aria-label={ariaLabel ?? "Buscar categoria"}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            fechar();
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (resultados[0]) escolher(resultados[0].nome);
            else if (podeCriar) void criar();
          }
        }}
        className="w-full border-b bg-transparent px-3 py-2 text-sm outline-none"
      />
      <div className="max-h-64 overflow-y-auto">
        {resultados.length === 0 && !podeCriar ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
        ) : (
          resultados.map((r) =>
            editando === r.nome ? (
              <div key={r.nome} className="flex items-center gap-2 px-3 py-2">
                <input
                  autoFocus
                  value={novoNome}
                  maxLength={40}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void renomear(r.nome);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditando(null);
                    }
                  }}
                  className="h-8 flex-1 rounded border border-primary bg-transparent px-2 text-sm outline-none"
                />
                {salvando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <button type="button" className="text-xs font-semibold text-primary" onClick={() => void renomear(r.nome)}>
                      Salvar
                    </button>
                    <button type="button" className="text-xs text-muted-foreground" onClick={() => setEditando(null)}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div key={r.nome} className="group flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => escolher(r.nome)}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.cor || "var(--primary)" }} />
                  <span className="flex-1 truncate">{r.nome}</span>
                  {r.nome === valor && <Check className="size-4 text-primary" />}
                </button>
                {tipo && (
                  <button
                    type="button"
                    aria-label={`Renomear ${r.nome}`}
                    title="Renomear"
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditando(r.nome);
                      setNovoNome(r.nome);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </div>
            ),
          )
        )}
        {podeCriar && (
          <button
            type="button"
            disabled={salvando}
            onClick={() => void criar()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {salvando ? "Criando..." : `Criar categoria "${termoLimpo}"`}
          </button>
        )}
      </div>
      <button type="button" onClick={fechar} className="w-full border-t py-2 text-xs text-muted-foreground hover:bg-accent">
        Cancelar
      </button>
    </div>
  );
}
