import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListarUsuarios } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminAlternarBetaAndroid,
  adminRedefinirAvisosUsuario,
  adminRedispararAviso,
  obterConfiguracaoAcesso,
} from "@/lib/configuracoes-site.functions";

/**
 * Avisos que a pessoa dispensa uma vez e não vê mais (convite de amigos e aviso de cookies).
 * O admin pode mostrar de novo para todos: isso cria uma "rodada" nova do aviso.
 */
export function RedispararAvisosCard() {
  const qc = useQueryClient();
  const obterFn = useServerFn(obterConfiguracaoAcesso);
  const redispararFn = useServerFn(adminRedispararAviso);
  const betaAndroidFn = useServerFn(adminAlternarBetaAndroid);
  const betaAndroid = useMutation({
    mutationFn: (aberto: boolean) => betaAndroidFn({ data: { aberto } }),
    onSuccess: (_r, aberto) => {
      toast.success(aberto ? "Vagas do beta Android abertas no site (limite de 50)." : "Beta Android fechado no site.");
      void qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível alterar."),
  });
  const { data: config } = useQuery({
    queryKey: ["configuracao-acesso-publica"],
    queryFn: () => obterFn(),
    staleTime: 60_000,
  });
  const redisparar = useMutation({
    mutationFn: (aviso: "convite" | "privacidade" | "beta") => redispararFn({ data: { aviso } }),
    onSuccess: (r, aviso) => {
      toast.success(
        aviso === "beta"
          ? `Aviso do app beta disparado para todos (rodada ${r.rodada}).`
          : aviso === "convite"
            ? `Convite de amigos vai aparecer de novo para todos (rodada ${r.rodada}).`
            : `Aviso de cookies vai aparecer de novo para todos (rodada ${r.rodada}).`,
      );
      void qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível redisparar."),
  });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <BellRing className="size-4 text-muted-foreground" aria-hidden="true" /> Avisos dispensáveis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Quem dispensa um aviso não vê mais em nenhum aparelho. Aqui você mostra de novo para todos.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <div className="divide-y rounded-2xl border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Aviso do app beta (TestFlight)</p>
              <p className="text-xs text-muted-foreground">
                {Number(config?.rodada_aviso_beta ?? 0) > 0 ? (
                  <>Rodada atual <span className="tabular-nums">{config?.rodada_aviso_beta}</span></>
                ) : (
                  "Ainda não disparado"
                )}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              disabled={redisparar.isPending}
              onClick={() => redisparar.mutate("beta")}
            >
              {Number(config?.rodada_aviso_beta ?? 0) > 0 ? "Disparar de novo" : "Disparar"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Vagas do beta Android</p>
              <p className="text-xs text-muted-foreground">
                {config?.beta_android_aberto ? (
                  <span className="text-success">Abertas no site, Google Play, até 50 vagas</span>
                ) : (
                  "Fechadas no site"
                )}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              variant={config?.beta_android_aberto ? "outline" : "default"}
              disabled={betaAndroid.isPending}
              onClick={() => betaAndroid.mutate(!config?.beta_android_aberto)}
            >
              {config?.beta_android_aberto ? "Fechar vagas" : "Abrir vagas"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Convite de amigos</p>
              <p className="text-xs text-muted-foreground">
                Rodada atual <span className="tabular-nums">{config?.rodada_aviso_convite ?? 1}</span>
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={redisparar.isPending}
              onClick={() => redisparar.mutate("convite")}
            >
              Redisparar
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Aviso de cookies</p>
              <p className="text-xs text-muted-foreground">
                Rodada atual <span className="tabular-nums">{config?.rodada_aviso_privacidade ?? 1}</span>. Use após mudar a política de privacidade.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={redisparar.isPending}
              onClick={() => redisparar.mutate("privacidade")}
            >
              Redisparar
            </Button>
          </div>
        </div>
        <RedefinirAvisosUsuario />
      </CardContent>
    </Card>
  );
}

/** Campos usados aqui da lista de adminListarUsuarios (o retorno chega sem tipo). */
type UsuarioAviso = { id: string; nome: string | null; email: string | null; ativo: boolean };

/**
 * Redefine os avisos de um usuário escolhido ou de todos os ativos (28/10/2026, para gravar vídeos).
 * Volta tudo que a pessoa já viu ou dispensou: cookies, convite de amigos, aviso do app beta, tour,
 * primeiros passos, instalar o app, primeira fatura e afins. Vale no site e no app, na próxima abertura.
 */
function RedefinirAvisosUsuario() {
  const listarFn = useServerFn(adminListarUsuarios);
  const redefinirFn = useServerFn(adminRedefinirAvisosUsuario);
  const { data: usuarios = [], isLoading } = useQuery({ queryKey: ["admin-usuarios-avisos"], queryFn: () => listarFn(), staleTime: 60_000 });
  const [busca, setBusca] = useState("");
  const [alvo, setAlvo] = useState<string>("");
  const [confirmarTodos, setConfirmarTodos] = useState(false);
  const ativos = useMemo(() => usuarios.filter((u: UsuarioAviso) => u.ativo), [usuarios]);
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return ativos;
    return ativos.filter((u: UsuarioAviso) => `${u.nome ?? ""} ${u.email ?? ""}`.toLowerCase().includes(t));
  }, [ativos, busca]);
  const redefinir = useMutation({
    mutationFn: (a: string) => redefinirFn({ data: { alvo: a } }),
    onSuccess: (_r, a) => {
      setConfirmarTodos(false);
      const nome = ativos.find((u: UsuarioAviso) => u.id === a)?.nome;
      toast.success(
        a === "todos"
          ? `Avisos redefinidos para os ${ativos.length} usuários ativos. Aparecem de novo na próxima abertura do site ou do app.`
          : `Avisos de ${nome ?? "usuário"} redefinidos. Aparecem de novo na próxima abertura do site ou do app.`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível redefinir."),
  });

  function clicar() {
    if (!alvo) return;
    if (alvo === "todos" && !confirmarTodos) {
      setConfirmarTodos(true);
      return;
    }
    redefinir.mutate(alvo);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-base font-bold">
          <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" /> Redefinir avisos de um usuário
        </p>
        <p className="text-sm text-muted-foreground">
          Volta tudo que a pessoa já viu ou dispensou (cookies, convites, tour, primeiros passos). Útil para gravar vídeos.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="redefinir-busca" className="text-sm font-medium">Buscar</label>
          <Input
            id="redefinir-busca"
            placeholder="Nome ou e-mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
        <label htmlFor="redefinir-alvo" className="text-sm font-medium">Usuário</label>
        <select
          id="redefinir-alvo"
          value={alvo}
          onChange={(e) => {
            setAlvo(e.target.value);
            setConfirmarTodos(false);
          }}
          className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">{isLoading ? "Carregando usuários..." : "Escolha o usuário"}</option>
          <option value="todos">Todos os usuários ativos ({ativos.length})</option>
          {filtrados.map((u: UsuarioAviso) => (
            <option key={u.id} value={u.id}>
              {u.nome || "Sem nome"}
              {u.email ? ` · ${u.email}` : ""}
            </option>
          ))}
        </select>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button
          variant={confirmarTodos ? "destructive" : "default"}
          disabled={!alvo || redefinir.isPending}
          onClick={clicar}
        >
          {confirmarTodos ? "Confirmar: redefinir para todos" : "Redefinir avisos"}
        </Button>
      </div>
    </div>
  );
}
