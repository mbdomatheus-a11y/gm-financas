import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { contarDadosExemplo, removerDadosExemplo } from "@/lib/dados-exemplo.functions";
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
import { ExcluirContaCard } from "@/components/ExcluirContaCard";
import { ExportarDadosCard } from "@/components/ExportarDadosCard";
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
import { MODULOS, baixarModulos, type Backup, type ModuloKey } from "@/lib/exportar-dados";
import { usePermissoes } from "@/hooks/useAuthData";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "Backup e Reset | Control ALL" },
      {
        name: "description",
        content:
          "Exporte, restaure ou reinicie os dados do casal módulo por módulo: receitas, despesas, notas fiscais, de-para, veículo e mais.",
      },
      { property: "og:title", content: "Backup e Reset | Control ALL" },
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


function BackupPage() {
  const { isAdmin, exclusaoBloqueada } = usePermissoes();
  const contarExemplos = useServerFn(contarDadosExemplo);
  const removerExemplos = useServerFn(removerDadosExemplo);
  const { data: exemplos, refetch: recontarExemplos } = useQuery({
    queryKey: ["dados-exemplo-total"],
    queryFn: () => contarExemplos(),
  });

  async function apagarExemplos() {
    setBusy("exemplos");
    try {
      const r = await removerExemplos();
      await qc.invalidateQueries();
      await recontarExemplos();
      toast.success(`Dados de exemplo removidos (${r.removidos} item(ns)).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover os dados de exemplo.");
    } finally {
      setBusy(null);
    }
  }
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<ModuloKey>>(
    new Set(MODULOS.map((m) => m.key)),
  );
  const [modulosBackupados, setModulosBackupados] = useState<Set<ModuloKey>>(new Set());
  const [resumo, setResumo] = useState<Record<string, number> | null>(null);
  // Um módulo (botão da linha) ou todos de uma vez (depois de "Baixar backup" com todos marcados).
  const [reset, setReset] = useState<Array<(typeof MODULOS)[number]> | null>(null);
  const [confirma, setConfirma] = useState("");
  const [resetCompleto, setResetCompleto] = useState(false);
  const [confirmaCompleto, setConfirmaCompleto] = useState("");

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

  const todosBackupados = MODULOS.every((m) => modulosBackupados.has(m.key));

  async function apagarModulo(m: (typeof MODULOS)[number]) {
    for (const tabela of m.resetOrder) {
      const { error } = await supabase
        .from(tabela as any)
        .delete()
        .not("id", "is", null);
      if (error) throw error;
    }
  }

  /** Reset completo do grupo: lançamentos, cartões, categorias e dados importados dos bancos (backup automático no banco). */
  async function executarResetCompleto() {
    if (exclusaoBloqueada) {
      toast.error("Este administrador não possui permissão para excluir dados.");
      return;
    }
    setBusy("reset-completo");
    try {
      const { data, error } = await (supabase as any).rpc("resetar_grupo_completo", {
        p_confirmacao: confirmaCompleto,
      });
      if (error) throw new Error(error.message);
      await qc.invalidateQueries();
      const d = (data ?? {}) as Record<string, number>;
      toast.success(
        `Reset completo feito: ${d["despesas"] ?? 0} despesas, ${d["receitas"] ?? 0} receitas e ${d["cartoes"] ?? 0} cartões apagados. Backup guardado.`,
      );
      setResetCompleto(false);
      setConfirmaCompleto("");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao resetar");
    } finally {
      setBusy(null);
    }
  }

  async function executarReset() {
    if (!reset?.length) return;
    if (exclusaoBloqueada) {
      toast.error("Este administrador não possui permissão para excluir dados.");
      return;
    }
    setBusy("reset");
    try {
      // Vários módulos: um pode depender de outro (ex.: vínculo de nota com
      // despesa). Tenta em ordem e repete os que falharam enquanto houver progresso.
      let pendentes = [...reset];
      let ultimoErro: any = null;
      while (pendentes.length) {
        const falharam: typeof pendentes = [];
        for (const m of pendentes) {
          try {
            await apagarModulo(m);
          } catch (e) {
            ultimoErro = e;
            falharam.push(m);
          }
        }
        if (falharam.length === pendentes.length) {
          await qc.invalidateQueries();
          throw new Error(
            `Não foi possível zerar: ${falharam.map((m) => m.label).join(", ")}. ${ultimoErro?.message ?? ""}`,
          );
        }
        pendentes = falharam;
      }
      await qc.invalidateQueries();
      toast.success(
        reset.length === 1 ? `${reset[0]!.label} zerado(a)` : "Todos os módulos foram zerados",
      );
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
        <ExportarDadosCard className="mb-6" />
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
      description="Exporte, restaure ou reinicie seus dados por módulo"
    >
      <ExportarDadosCard className="mb-6" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Download className="size-4.5 text-primary" />
              <p className="text-base font-semibold">Backup</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Marque os módulos que entram no arquivo JSON.
            </p>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-primary"
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
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted/40"
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
                  <Badge key={k} variant="secondary" className="text-xs">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Upload className="size-4.5 text-primary" />
              <p className="text-base font-semibold">Restaurar</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Reimporta um arquivo gerado aqui. Registros iguais são atualizados, sem duplicar.
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
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <RotateCcw className="size-4.5 text-destructive" />
              <p className="text-base font-semibold">Reset completo</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Apaga lançamentos, faturas, cartões, bancos, categorias, regras e o que veio do Open
              Finance. As conexões com os bancos continuam. Veículos, notas fiscais e lista de compras
              ficam intactos. Um backup completo é guardado antes, e se algo falhar nada é apagado.
            </p>
            <Button
              variant="destructive"
              className="gap-1"
              disabled={exclusaoBloqueada || busy !== null}
              title={exclusaoBloqueada ? "Este administrador não pode excluir dados" : undefined}
              onClick={() => {
                setConfirmaCompleto("");
                setResetCompleto(true);
              }}
            >
              <RotateCcw className="size-3.5" /> Reset completo
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-destructive/40">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Database className="size-4.5 text-destructive" />
              <p className="font-semibold">Reset por módulo</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Apaga só o módulo escolhido. Cada um é liberado depois que você baixa o backup dele
              nesta sessão.
            </p>
            {!!exemplos?.total && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted px-4 py-3">
                <span className="mr-auto text-sm">
                  <b>Dados de exemplo</b> da conta nova. Não precisa de backup.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  disabled={busy !== null}
                  onClick={() => void apagarExemplos()}
                >
                  <RotateCcw className="size-3.5" />{" "}
                  {busy === "exemplos" ? "Removendo..." : "Remover dados de exemplo"}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/5 px-4 py-3">
              <span className="mr-auto text-sm font-medium">Todos os módulos</span>
              <Button
                size="sm"
                variant="destructive"
                className="shrink-0 gap-1"
                disabled={exclusaoBloqueada || !todosBackupados || busy !== null}
                title={
                  exclusaoBloqueada
                    ? "Este administrador não pode excluir dados"
                    : todosBackupados
                      ? undefined
                      : "Baixe o backup com todos os módulos marcados primeiro"
                }
                onClick={() => {
                  setReset([...MODULOS]);
                  setConfirma("");
                }}
              >
                <RotateCcw className="size-3.5" /> Resetar todos
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULOS.map((m) => {
                const liberado = modulosBackupados.has(m.key);
                return (
                  <div
                    key={m.key}
                    className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
                  >
                    <span className="text-sm">{m.label}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="shrink-0 gap-1"
                      disabled={exclusaoBloqueada || !liberado || busy !== null}
                      title={
                        exclusaoBloqueada
                          ? "Este administrador não pode excluir dados"
                          : liberado
                            ? undefined
                            : "Baixe o backup deste módulo primeiro"
                      }
                      onClick={() => {
                        setReset([m]);
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

        <ExcluirContaCard className="lg:col-span-2 border-destructive/30" />
      </div>

      <Dialog open={reset !== null} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reset && reset.length > 1
                ? "Confirmar reset de todos os módulos"
                : `Confirmar reset de ${reset?.[0]?.label ?? ""}`}
            </DialogTitle>
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
      <Dialog open={resetCompleto} onOpenChange={(o) => !o && setResetCompleto(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reset completo</DialogTitle>
            <DialogDescription>
              Isso apaga lançamentos, cartões, categorias e os dados importados dos bancos. Um backup
              é guardado antes. Digite <strong>RESETAR</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmaCompleto}
            onChange={(e) => setConfirmaCompleto(e.target.value)}
            placeholder="RESETAR"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetCompleto(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmaCompleto.trim().toUpperCase() !== "RESETAR" || busy !== null}
              onClick={() => void executarResetCompleto()}
            >
              {busy === "reset-completo" ? "Apagando..." : "Apagar tudo e recomeçar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
