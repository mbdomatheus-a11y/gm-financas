import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, RotateCcw, ShieldAlert, Database } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
      { title: "Backup e Reset — Finanças do Casal" },
      {
        name: "description",
        content:
          "Exporte todos os dados do casal em JSON, importe de volta quando quiser e reinicie receitas ou despesas com segurança.",
      },
      { property: "og:title", content: "Backup e Reset — Finanças do Casal" },
      {
        property: "og:description",
        content: "Backup completo em JSON, restauração e reset administrativo de lançamentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupPage,
});

/** Ordem importa: pais antes de filhos, para importar sem quebrar vínculos. */
const TABELAS = [
  "bancos",
  "cartoes",
  "categorias",
  "cartao_vinculos",
  "import_lotes",
  "import_faturas",
  "receitas",
  "despesas",
  "parcelas",
  "investimentos",
  "investimento_movimentos",
  "lista_compras",
] as const;

type Tabela = (typeof TABELAS)[number];
type Backup = { versao: number; gerado_em: string; dados: Record<string, any[]> };

async function baixarTudo(): Promise<Backup> {
  const dados: Record<string, any[]> = {};
  for (const t of TABELAS) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    dados[t] = data ?? [];
  }
  return { versao: 1, gerado_em: new Date().toISOString(), dados };
}

function BackupPage() {
  const { isAdmin } = usePermissoes();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [backupFeito, setBackupFeito] = useState(false);
  const [resumo, setResumo] = useState<Record<string, number> | null>(null);
  const [reset, setReset] = useState<null | "receitas" | "despesas">(null);
  const [confirma, setConfirma] = useState("");

  async function exportar() {
    setBusy("export");
    try {
      const backup = await baixarTudo();
      const contagem: Record<string, number> = {};
      for (const [k, v] of Object.entries(backup.dados)) contagem[k] = v.length;
      setResumo(contagem);

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupFeito(true);
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
      let total = 0;
      for (const t of TABELAS) {
        const linhas = json.dados[t];
        if (!linhas?.length) continue;
        for (let i = 0; i < linhas.length; i += 200) {
          const lote = linhas.slice(i, i + 200);
          const { error } = await supabase
            .from(t as Tabela)
            .upsert(lote as any, { onConflict: t === "preferencias_usuario" ? "user_id" : "id" });
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
    setBusy("reset");
    try {
      if (reset === "receitas") {
        const { error } = await supabase.from("receitas").delete().not("id", "is", null);
        if (error) throw error;
      } else {
        const p = await supabase.from("parcelas").delete().not("id", "is", null);
        if (p.error) throw p.error;
        const d = await supabase.from("despesas").delete().not("id", "is", null);
        if (d.error) throw d.error;
      }
      await qc.invalidateQueries();
      toast.success(reset === "receitas" ? "Receitas zeradas" : "Despesas zeradas");
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
      description="Exporte tudo em JSON, restaure quando quiser e reinicie lançamentos"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Download className="size-4.5 text-primary" />
              <p className="font-semibold">1. Backup completo (JSON)</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Baixa receitas, despesas, parcelas, cartões, bancos, categorias, investimentos,
              faturas importadas e lista de compras em um único arquivo.
            </p>
            <Button onClick={exportar} disabled={busy !== null} className="gap-2">
              <Download className="size-4" />
              {busy === "export" ? "Gerando..." : "Baixar backup"}
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
              Reimporta um arquivo gerado aqui. Registros com o mesmo identificador são
              atualizados, então você recomeça exatamente de onde parou.
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
              <p className="font-semibold">3. Reset administrativo</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Apaga <strong>todas</strong> as receitas ou <strong>todas</strong> as despesas (com
              suas parcelas). Disponível apenas depois de baixar o backup nesta sessão.
            </p>
            {!backupFeito && (
              <p className="text-xs font-medium text-destructive">
                Faça o backup acima para liberar os botões de reset.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={!backupFeito || busy !== null}
                onClick={() => {
                  setReset("receitas");
                  setConfirma("");
                }}
                className="gap-2"
              >
                <RotateCcw className="size-4" /> Resetar receitas
              </Button>
              <Button
                variant="destructive"
                disabled={!backupFeito || busy !== null}
                onClick={() => {
                  setReset("despesas");
                  setConfirma("");
                }}
                className="gap-2"
              >
                <RotateCcw className="size-4" /> Resetar despesas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={reset !== null} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reset de {reset}</DialogTitle>
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
