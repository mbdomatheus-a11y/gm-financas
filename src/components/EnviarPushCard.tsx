import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminListarUsuarios } from "@/lib/admin.functions";
import { adminEnviarPush, adminResumoPush } from "@/lib/push.functions";

/** Campos usados aqui da lista de adminListarUsuarios (o retorno chega sem tipo). */
type UsuarioAviso = { id: string; nome: string | null; email: string | null; ativo: boolean };

/** Enviar notificação para o celular (app iPhone e Android), 01/11/2026. */
export function EnviarPushCard() {
  const resumoFn = useServerFn(adminResumoPush);
  const listarFn = useServerFn(adminListarUsuarios);
  const enviarFn = useServerFn(adminEnviarPush);
  const { data: resumo } = useQuery({ queryKey: ["admin-push-resumo"], queryFn: () => resumoFn(), staleTime: 30_000 });
  const { data: usuarios = [] } = useQuery({ queryKey: ["admin-usuarios-avisos"], queryFn: () => listarFn(), staleTime: 60_000 });
  const ativos = useMemo(() => usuarios.filter((u: UsuarioAviso) => u.ativo), [usuarios]);
  const [alvo, setAlvo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [confirmarTodos, setConfirmarTodos] = useState(false);

  const enviar = useMutation({
    mutationFn: () => enviarFn({ data: { alvo, titulo, corpo } }),
    onSuccess: (r) => {
      setConfirmarTodos(false);
      if (r.enviados === 0) toast.info("Ninguém recebeu: essa pessoa ainda não tem o app com notificações ligadas.");
      else toast.success(`Notificação enviada para ${r.enviados} aparelho(s)${r.falhas ? ` (${r.falhas} falharam)` : ""}.`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar."),
  });

  const pronto = !!alvo && titulo.trim().length >= 2 && corpo.trim().length >= 2;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Smartphone className="size-4 text-muted-foreground" aria-hidden="true" /> Notificação no celular
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {resumo?.tabelaFalta
            ? "Falta criar a tabela push_tokens no banco (SQL de 01/11)."
            : `${resumo?.pessoas ?? 0} pessoa(s) em ${resumo?.aparelhos ?? 0} aparelho(s) recebem push (iPhone ${resumo?.ios ?? 0}, Android ${resumo?.android ?? 0}). Só quem tem o app novo com notificações ligadas.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <label htmlFor="push-alvo" className="text-sm font-medium">Destinatário</label>
          <select
          id="push-alvo"
          value={alvo}
          onChange={(e) => {
            setAlvo(e.target.value);
            setConfirmarTodos(false);
          }}
          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">Escolha quem recebe</option>
          <option value="todos">Todos os usuários ativos ({ativos.length})</option>
          {ativos.map((u: UsuarioAviso) => (
            <option key={u.id} value={u.id}>
              {u.nome || "Sem nome"}
              {u.email ? ` (${u.email})` : ""}
            </option>
          ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="push-titulo" className="text-sm font-medium">Título</label>
            <span className="text-xs tabular-nums text-muted-foreground">{titulo.length}/80</span>
          </div>
          <Input id="push-titulo" placeholder="Ex.: Sua fatura fecha amanhã" maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="push-corpo" className="text-sm font-medium">Mensagem</label>
            <span className="text-xs tabular-nums text-muted-foreground">{corpo.length}/240</span>
          </div>
          <Textarea id="push-corpo" placeholder="Texto que aparece na notificação" maxLength={240} rows={3} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-1">
        <Button
          disabled={!pronto || enviar.isPending}
          variant={confirmarTodos ? "destructive" : "default"}
          onClick={() => {
            if (alvo === "todos" && !confirmarTodos) {
              setConfirmarTodos(true);
              return;
            }
            enviar.mutate();
          }}
        >
          {confirmarTodos ? `Confirmar envio para ${ativos.length} usuários` : "Enviar notificação"}
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}
