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

/** Enviar notificação para o celular (app iPhone e Android), 01/11/2026. */
export function EnviarPushCard() {
  const resumoFn = useServerFn(adminResumoPush);
  const listarFn = useServerFn(adminListarUsuarios);
  const enviarFn = useServerFn(adminEnviarPush);
  const { data: resumo } = useQuery({ queryKey: ["admin-push-resumo"], queryFn: () => resumoFn(), staleTime: 30_000 });
  const { data: usuarios = [] } = useQuery({ queryKey: ["admin-usuarios-avisos"], queryFn: () => listarFn(), staleTime: 60_000 });
  const ativos = useMemo(() => usuarios.filter((u) => u.ativo), [usuarios]);
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Smartphone className="size-4" /> Notificação no celular (app)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {resumo?.tabelaFalta
            ? "Falta criar a tabela push_tokens no banco (SQL de 01/11)."
            : `${resumo?.pessoas ?? 0} pessoa(s) em ${resumo?.aparelhos ?? 0} aparelho(s) recebem push (iPhone ${resumo?.ios ?? 0}, Android ${resumo?.android ?? 0}). Só quem tem o app novo com notificações ligadas.`}
        </p>
        <select
          value={alvo}
          onChange={(e) => {
            setAlvo(e.target.value);
            setConfirmarTodos(false);
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Destinatário"
        >
          <option value="">Escolha quem recebe</option>
          <option value="todos">Todos os usuários ativos ({ativos.length})</option>
          {ativos.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome || "Sem nome"}
              {u.email ? ` (${u.email})` : ""}
            </option>
          ))}
        </select>
        <Input placeholder="Título (até 80 caracteres)" maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <Textarea placeholder="Mensagem (até 240 caracteres)" maxLength={240} rows={3} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
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
      </CardContent>
    </Card>
  );
}
