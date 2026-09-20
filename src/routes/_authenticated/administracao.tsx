import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/useAuthData";
import {
  adminAtualizarLayout,
  adminCriarComunicado,
  adminListarLayouts,
  adminListarLogs,
  adminMetricas,
  adminObterLayoutUrl,
} from "@/lib/admin-avancado.functions";
import {
  adminListarSolicitacoesPrivacidade,
  adminTratarSolicitacaoPrivacidade,
} from "@/lib/privacidade.functions";
import { confirmarLogo, prepararUploadLogo } from "@/lib/identidade-site.functions";

export const Route = createFileRoute("/_authenticated/administracao")({ component: Admin });
function Admin() {
  const { isSiteAdmin } = usePermissoes();
  const qc = useQueryClient();
  const layoutsFn = useServerFn(adminListarLayouts),
    privFn = useServerFn(adminListarSolicitacoesPrivacidade),
    metricsFn = useServerFn(adminMetricas),
    logsFn = useServerFn(adminListarLogs),
    atualizar = useServerFn(adminAtualizarLayout),
    obterLayoutUrl = useServerFn(adminObterLayoutUrl),
    tratar = useServerFn(adminTratarSolicitacaoPrivacidade),
    criar = useServerFn(adminCriarComunicado),
    prepararLogo = useServerFn(prepararUploadLogo),
    confirmar = useServerFn(confirmarLogo);
  const logoInput = useRef<HTMLInputElement>(null);
  const { data: layouts = [] } = useQuery({
    queryKey: ["admin-layouts"],
    enabled: isSiteAdmin,
    queryFn: () => layoutsFn(),
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ["admin-privacidade"],
    enabled: isSiteAdmin,
    queryFn: () => privFn(),
  });
  const { data: metricas } = useQuery({
    queryKey: ["admin-metricas"],
    enabled: isSiteAdmin,
    queryFn: () => metricsFn(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["admin-logs"],
    enabled: isSiteAdmin,
    queryFn: () => logsFn(),
  });
  const [titulo, setTitulo] = useState("");
  const [msg, setMsg] = useState("");
  const atualizarLayout = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "corrigida" | "descartada" }) =>
      atualizar({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Solicitação atualizada e arquivo descartado.");
      qc.invalidateQueries({ queryKey: ["admin-layouts"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    },
    onError: (error) => toast.error(error.message),
  });
  async function abrirLayout(id: string) {
    const aba = window.open("", "_blank");
    if (!aba) {
      toast.error("Permita abrir uma nova aba para consultar o arquivo.");
      return;
    }
    try {
      const { url } = await obterLayoutUrl({ data: { id } });
      aba.location.replace(url);
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    } catch (error) {
      aba.close();
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o arquivo.");
    }
  }
  const concluirPedido = useMutation({
    mutationFn: (id: string) => tratar({ data: { id, status: "concluida" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-privacidade"] }),
  });
  const comunicado = useMutation({
    mutationFn: () => criar({ data: { titulo, mensagem: msg, exigeAceite: true } }),
    onSuccess: () => {
      toast.success("Aviso publicado com aceite registrado.");
      setTitulo("");
      setMsg("");
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    },
  });
  async function subirLogo(files: FileList | null) {
    const arquivo = files?.[0];
    if (!arquivo) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
      toast.error("Envie JPG, PNG, WEBP ou GIF de até 5 MB.");
      return;
    }
    try {
      const envio = await prepararLogo({ data: { nome: arquivo.name } });
      const { error } = await supabase.storage
        .from("site_assets")
        .uploadToSignedUrl(envio.path, envio.token, arquivo);
      if (error) throw error;
      await confirmar({ data: { path: envio.path } });
      qc.invalidateQueries({ queryKey: ["identidade-visual-site"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast.success("Logo atualizada em todo o site.");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível atualizar a logo.");
    } finally {
      if (logoInput.current) logoInput.current.value = "";
    }
  }
  if (!isSiteAdmin)
    return (
      <AppLayout title="Administração">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Área restrita ao administrador do site.
          </CardContent>
        </Card>
      </AppLayout>
    );
  return (
    <AppLayout
      title="Administração do site"
      description="Indicadores quantitativos, sem acesso a dados financeiros"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <b>{metricas?.total ?? 0}</b>
            <p className="text-xs text-muted-foreground">usuários cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <b>{metricas?.ativos ?? 0}</b>
            <p className="text-xs text-muted-foreground">contas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <b>{metricas?.tempoMedioMin ?? 0} min</b>
            <p className="text-xs text-muted-foreground">tempo médio de sessão</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="font-semibold">Logo do Control ALL</h2>
            <p className="text-xs text-muted-foreground">
              A imagem será usada na Home, login e áreas internas.
            </p>
          </div>
          <input
            ref={logoInput}
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => subirLogo(e.target.files)}
          />
          <Button variant="outline" onClick={() => logoInput.current?.click()}>
            Enviar ou trocar logo
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Banner de aviso</h2>
            <Input
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <Textarea
              placeholder="Mensagem para todos os usuários"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <Button disabled={!titulo || !msg} onClick={() => comunicado.mutate()}>
              Publicar e exigir aceite
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Solicitações de privacidade</h2>
            {pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>
            ) : (
              pedidos.map((p: any) => (
                <div className="rounded-lg border p-3" key={p.id}>
                  <b>{p.email}</b>
                  <p className="text-xs">
                    {p.telefone} · {p.status}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.motivo || "Sem detalhe"}</p>
                  {p.status !== "concluida" && (
                    <Button size="sm" className="mt-2" onClick={() => concluirPedido.mutate(p.id)}>
                      Concluir
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Faturas enviadas para modelagem</h2>
          {layouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo aguardando análise.</p>
          ) : (
            layouts.map((l: any) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                key={l.id}
              >
                <div>
                  <b>{l.arquivo_nome}</b>
                  <p className="text-xs text-muted-foreground">
                    {l.banco_informado || "Banco não informado"} · {l.status}
                  </p>
                </div>
                {l.status !== "corrigida" && l.status !== "descartada" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void abrirLayout(l.id)}>
                      Abrir arquivo
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => atualizarLayout.mutate({ id: l.id, status: "corrigida" })}
                    >
                      Marcar corrigida e avisar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => atualizarLayout.mutate({ id: l.id, status: "descartada" })}
                    >
                      Descartar
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardContent className="space-y-2 p-4">
          <h2 className="font-semibold">Log administrativo</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            logs.map((l: any) => (
              <div className="border-b py-2 text-xs" key={l.id}>
                <b>{l.acao.replaceAll("_", " ")}</b>
                <span className="ml-2 text-muted-foreground">
                  {l.profiles?.nome ?? l.profiles?.email ?? "Usuário removido"} ·{" "}
                  {new Date(l.criado_em).toLocaleString("pt-BR")}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
