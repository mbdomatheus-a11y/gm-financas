import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminBaixarBackupContaTeste,
  adminListarContasTeste,
  adminResetarContaTeste,
  type ContaTeste,
} from "@/lib/conta-teste.functions";

function dataHora(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function LinhaConta({ conta }: { conta: ContaTeste }) {
  const qc = useQueryClient();
  const resetarFn = useServerFn(adminResetarContaTeste);
  const baixarFn = useServerFn(adminBaixarBackupContaTeste);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");

  const resetar = useMutation({
    mutationFn: () => resetarFn({ data: { userId: conta.id, confirmacao: texto } }),
    onSuccess: (r) => {
      toast.success(`Conta resetada. ${r.total} registros apagados e backup guardado.`);
      setAberto(false);
      setTexto("");
      void qc.invalidateQueries({ queryKey: ["contas-teste"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível resetar."),
  });

  const baixar = useMutation({
    mutationFn: () => baixarFn({ data: { userId: conta.id } }),
    onSuccess: (backup) => {
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `controlall-backup-conta-teste-${conta.email.split("@")[0]}-${backup.criadoEm.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível baixar o backup."),
  });

  const confirmado = texto.trim().toUpperCase() === "RESETAR";

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{conta.nome ?? "Conta de teste"}</p>
          <p className="truncate text-sm text-muted-foreground">{conta.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hoje: {conta.despesas} despesas, {conta.receitas} receitas, {conta.cartoes} cartões. Último reset:{" "}
            {dataHora(conta.ultimoReset)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {conta.ultimoReset && (
            <Button size="sm" variant="outline" onClick={() => baixar.mutate()} disabled={baixar.isPending}>
              <Download className="mr-1.5 h-4 w-4" />
              {baixar.isPending ? "Baixando..." : "Baixar último backup"}
            </Button>
          )}
          {!aberto && (
            <Button size="sm" variant="destructive" onClick={() => setAberto(true)}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Resetar conta
            </Button>
          )}
        </div>
      </div>
      {aberto && (
        <div className="space-y-2 rounded-xl bg-destructive/5 p-3">
          <p className="text-sm">
            Isto apaga todos os lançamentos, cartões, categorias, metas, notas, listas e avisos vistos de{" "}
            <strong>{conta.email}</strong>. Um backup completo é guardado antes. O login e a senha continuam os mesmos e
            a conta volta a ver as boas-vindas.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite RESETAR"
              className="h-10 max-w-[200px]"
              autoComplete="off"
              aria-label={`Digite RESETAR para confirmar o reset de ${conta.email}`}
            />
            <Button
              variant="destructive"
              disabled={!confirmado || resetar.isPending}
              onClick={() => resetar.mutate()}
            >
              {resetar.isPending ? "Resetando..." : "Fazer backup e resetar"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAberto(false);
                setTexto("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Administração > Usuários: reset completo das duas contas de teste (para gravar vídeos). */
export function ResetContaTesteCard() {
  const listarFn = useServerFn(adminListarContasTeste);
  const { data, isLoading, error } = useQuery({
    queryKey: ["contas-teste"],
    queryFn: () => listarFn(),
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-bold">Contas de teste</CardTitle>
        <p className="text-sm text-muted-foreground">
          Reset completo para gravar vídeos. Só estas duas contas podem ser resetadas; nenhuma outra aparece aqui.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {error && (
          <p className="text-sm text-destructive">
            Não foi possível carregar as contas de teste. Confira se o SQL do reset já foi rodado no banco.
          </p>
        )}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta de teste encontrada.</p>}
        {data?.map((c) => <LinhaConta key={c.id} conta={c} />)}
      </CardContent>
    </Card>
  );
}
