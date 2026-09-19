import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Upload,
  RotateCcw,
  ShieldAlert,
  Database,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/useAuthData";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "Backup e Reset — Control ALL" },
      {
        name: "description",
        content:
          "Exporte, restaure ou reinicie os dados do casal módulo por módulo: receitas, despesas, notas fiscais, de-para, veículo e mais.",
      },
      { property: "og:title", content: "Backup e Reset — Control ALL" },
      {
        property: "og:description",
        content: "Backup seletivo em JSON, restauração e reset administrativo por módulo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupPage,
});

/**
 * Um módulo por linha de UI. `tabelas` é usado no backup/restauração (ordem
 * não importa ali, é upsert). `resetOrder` é usado só no reset e importa:
 * filhos antes de pais, mesmo quando a maioria das FKs já é CASCADE/SET NULL
 * — deixamos explícito para não depender só do comportamento do banco.
 */
const MODULOS = [
  {
    key: "receitas",
    label: "Receitas",
    tabelas: ["receitas"],
    resetOrder: ["receitas"],
  },
  {
    key: "despesas",
    label: "Despesas (fixas, variáveis, parcelas e fatura do mês)",
    tabelas: ["despesas", "parcelas", "parcela_auditoria", "fatura_mes"],
    resetOrder: ["parcela_auditoria", "parcelas", "fatura_mes", "despesas"],
  },
  {
    key: "cartoes_bancos",
    label: "Cartões e bancos",
    tabelas: ["cartoes", "bancos", "cartao_vinculos"],
    resetOrder: ["cartao_vinculos", "cartoes", "bancos"],
  },
  {
    key: "categorias",
    label: "Categorias",
    tabelas: ["categorias"],
    resetOrder: ["categorias"],
  },
  {
    key: "de_para",
    label: "De-para de categorias",
    tabelas: ["categoria_regras"],
    resetOrder: ["categoria_regras"],
  },
  {
    key: "investimentos",
    label: "Investimentos",
    tabelas: ["investimentos", "investimento_movimentos"],
    resetOrder: ["investimento_movimentos", "investimentos"],
  },
  {
    key: "veiculos",
    label: "Meu Veículo (documentos e eventos)",
    tabelas: ["veiculos", "veiculo_documentos", "veiculo_eventos"],
    resetOrder: ["veiculo_eventos", "veiculo_documentos", "veiculos"],
  },
  {
    key: "notas_fiscais",
    label: "Notas fiscais",
    tabelas: ["notas_fiscais", "nota_itens", "nota_arquivos", "nota_vinculos"],
    resetOrder: ["nota_vinculos", "nota_arquivos", "nota_itens", "notas_fiscais"],
  },
  {
    key: "lista_compras",
    label: "Lista de compras",
    tabelas: ["lista_compras"],
    resetOrder: ["lista_compras"],
  },
  {
    key: "importacao",
    label: "Faturas importadas (histórico, comprovantes e layouts aprendidos)",
    tabelas: ["import_lotes", "import_faturas", "fatura_layouts", "comprovantes"],
    resetOrder: ["comprovantes", "import_faturas", "import_lotes", "fatura_layouts"],
  },
  {
    key: "configuracoes",
    label: "Configurações do casal (ex.: pasta do Google Drive)",
    tabelas: ["configuracoes_casal"],
    resetOrder: ["configuracoes_casal"],
  },
] as const;

type ModuloKey = (typeof MODULOS)[number]["key"];
type Backup = {
  versao: number;
  gerado_em: string;
  modulos: ModuloKey[];
  dados: Record<string, any[]>;
};

async function baixarModulos(chaves: ModuloKey[]): Promise<Backup> {
  const dados: Record<string, any[]> = {};
  const tabelas = MODULOS.filter((m) => chaves.includes(m.key)).flatMap((m) => m.tabelas);
  for (const t of tabelas) {
    const { data, error } = await supabase.from(t as any).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    dados[t] = data ?? [];
  }
  return { versao: 2, gerado_em: new Date().toISOString(), modulos: chaves, dados };
}

function BackupPage() {
  const { isAdmin, exclusaoBloqueada } = usePermissoes();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<ModuloKey>>(
    new Set(MODULOS.map((m) => m.key)),
  );
  const [modulosBackupados, setModulosBackupados] = useState<Set<ModuloKey>>(new Set());
  const [resumo, setResumo] = useState<Record<string, number> | null>(null);
  const [reset, setReset] = useState<(typeof MODULOS)[number] | null>(null);
  const [confirma, setConfirma] = useState("");

  function toggle(chave: ModuloKey) {
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  }

  const todosSelecionados = selecionados.size === MODULOS.length;

  async function exportar() {
    if (selecionados.size === 0) {
      toast.error("Selecione ao menos um módulo");
      return;
    }
    setBusy("export");
    try {
      const chaves = Array.from(selecionados);
      const backup = await baixarModulos(chaves);
      const contagem: Record<string, number> = {};
      for (const [k, v] of Object.entries(backup.dados)) contagem[k] = v.length;
      setResumo(contagem);

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sufixo = todosSelecionados ? "completo" : chaves.join("-");
      a.download = `financas-backup-${sufixo}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setModulosBackupados((s) => new Set([...s, ...chaves]));
      toast.success("Backup gerado com sucesso");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar backup");
    } finally {
      setBusy(null);
    }
  }

  async function importar(file: File) {
    setBusy("import");
    try {
      const json = JSON.parse(await file.text()) as Backup;
      if (!json?.dados) throw new Error("Arquivo inválido");
      const todasTabelas = MODULOS.flatMap((m) => m.tabelas);
      let total = 0;
      for (const t of todasTabelas) {
        const linhas = json.dados[t];
        if (!linhas?.length) continue;
        for (let i = 0; i < linhas.length; i += 200) {
          const lote = linhas.slice(i, i + 200);
          const { error } = await supabase.from(t as any).upsert(lote as any, { onConflict: "id" });
          if (error) throw new Error(`${t}: ${error.message}`);
          total += lote.length;
        }
      }
      await qc.invalidateQueries();
      toast.success(`${total} registros restaurados`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao importar");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function executarReset() {
    if (!reset) return;
    if (exclusaoBloqueada) {
      toast.error("Este administrador não possui permissão para excluir dados.");
      return;
    }
    setBusy("reset");
    try {
      for (const tabela of reset.resetOrder) {
        const { error } = await supabase
          .from(tabela as any)
          .delete()
          .not("id", "is", null);
        if (error) throw error;
      }
      await qc.invalidateQueries();
      toast.success(`${reset.label} zerado(a)`);
      setReset(null);
      setConfirma("");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao resetar");
    } finally {
      setBusy(null);
    }
  }

  if (!isAdmin) {
    return (
      <AppLayout title="Backup e Reset" description="Área restrita a administradores">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <ShieldAlert className="size-5 text-destructive" />
            Somente administradores podem exportar, importar ou resetar dados.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Backup e Reset"
      description="Escolha os módulos, exporte, restaure ou reinicie individualmente"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Download className="size-4.5 text-primary" />
              <p className="font-semibold">1. Backup seletivo (JSON)</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Marque os módulos que quer incluir neste arquivo. Dá pra fazer um backup só de notas
              fiscais, só do de-para, ou de tudo de uma vez.
            </p>
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-medium text-primary"
              onClick={() =>
                setSelecionados(todosSelecionados ? new Set() : new Set(MODULOS.map((m) => m.key)))
              }
            >
              {todosSelecionados ? (
                <CheckSquare className="size-3.5" />
              ) : (
                <Square className="size-3.5" />
              )}
              Selecionar tudo
            </button>
            <div className="space-y-1.5">
              {MODULOS.map((m) => (
                <label
                  key={m.key}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selecionados.has(m.key)}
                    onCheckedChange={() => toggle(m.key)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <Button onClick={exportar} disabled={busy !== null} className="gap-2">
              <Download className="size-4" />
              {busy === "export" ? "Gerando..." : `Baixar backup (${selecionados.size})`}
            </Button>
            {resumo && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(resumo).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-[11px]">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Upload className="size-4.5 text-primary" />
              <p className="font-semibold">2. Restaurar backup</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Reimporta um arquivo gerado aqui — completo ou de um módulo só. Registros com o mesmo
              identificador são atualizados, então você recomeça exatamente de onde parou.
            </p>
            <Input
              ref={fileRef}
              type="file"
              accept="application/json"
              disabled={busy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
              }}
            />
            {busy === "import" && <p className="text-xs text-muted-foreground">Importando...</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-destructive/40">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Database className="size-4.5 text-destructive" />
              <p className="font-semibold">3. Reset por módulo</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Apaga só os dados do módulo escolhido — dá pra resetar as notas fiscais ou o veículo
              sem mexer no resto. Cada módulo só libera o reset depois que você baixar um backup
              dele nesta sessão.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULOS.map((m) => {
                const liberado = modulosBackupados.has(m.key);
                return (
                  <div
                    key={m.key}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <span className="text-xs">{m.label}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 shrink-0 gap-1 text-[11px]"
                      disabled={exclusaoBloqueada || !liberado || busy !== null}
                      title={
                        exclusaoBloqueada
                          ? "Este administrador não pode excluir dados"
                          : liberado
                            ? undefined
                            : "Baixe o backup deste módulo primeiro"
                      }
                      onClick={() => {
                        setReset(m);
                        setConfirma("");
                      }}
                    >
                      <RotateCcw className="size-3.5" /> Resetar
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={reset !== null} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reset de {reset?.label}</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Digite <strong>RESETAR</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            placeholder="RESETAR"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReset(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirma !== "RESETAR" || busy !== null}
              onClick={() => void executarReset()}
            >
              {busy === "reset" ? "Apagando..." : "Apagar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
