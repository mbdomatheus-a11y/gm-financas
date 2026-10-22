import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarPlus,
  ChevronRight,
  FileText,
  Info,
  Languages,
  LogOut,
  Moon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { useProfile } from "@/hooks/useAuthData";
import { usePreferencias } from "@/hooks/usePreferencias";
import { agendaAppVinculada } from "@/lib/agenda-app";
import { ehAppNativo, ponteNativa } from "@/lib/app-nativo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ajustes-app")({
  head: () => ({ meta: [{ title: "Ajustes — Control ALL" }] }),
  component: AjustesAppPage,
});

/** Grupo no estilo dos Ajustes do iPhone: cartão arredondado com linhas separadas. */
function Grupo({ titulo, rodape, children }: { titulo: string; rodape?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-1.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>
      {rodape && <p className="mt-1.5 px-4 text-[11px] text-muted-foreground">{rodape}</p>}
    </section>
  );
}

function Linha({
  icone,
  cor,
  titulo,
  detalhe,
  direita,
  para,
  onClick,
  perigo,
}: {
  icone: ReactNode;
  cor: string;
  titulo: string;
  detalhe?: string;
  direita?: ReactNode;
  para?: string;
  onClick?: () => void;
  perigo?: boolean;
}) {
  const conteudo = (
    <>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-white", cor)}>{icone}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", perigo && "text-destructive")}>{titulo}</span>
        {detalhe && <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>}
      </span>
      {direita ?? ((para || onClick) && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />)}
    </>
  );
  const classe = "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60";
  if (para)
    return (
      <Link to={para} className={classe}>
        {conteudo}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={classe}>
        {conteudo}
      </button>
    );
  return <div className={classe}>{conteudo}</div>;
}

function AjustesAppPage() {
  const { data: perfil } = useProfile();
  const { prefs, save } = usePreferencias();
  const [app, setApp] = useState<{ versao?: string; build?: string } | null>(null);
  const [vinculada, setVinculada] = useState(false);
  const [nativo, setNativo] = useState(false);

  useEffect(() => {
    setNativo(ehAppNativo());
    setVinculada(agendaAppVinculada());
    setApp((window as unknown as { __controlAllApp?: { versao?: string; build?: string } }).__controlAllApp ?? null);
    const aoNotificar = (ev: Event) => {
      const r = (ev as CustomEvent<{ ok: boolean; erro?: string }>).detail;
      if (!r?.ok) toast.error(r?.erro ?? "Não consegui agendar a notificação de teste.");
    };
    window.addEventListener("notificacao-app-resultado", aoNotificar);
    return () => window.removeEventListener("notificacao-app-resultado", aoNotificar);
  }, []);

  function testarNotificacao() {
    const ponte = ponteNativa("notificacoesApp");
    if (!ponte) {
      toast.error("Disponível no app do iPhone (atualize pelo TestFlight).");
      return;
    }
    ponte.postMessage({ acao: "testar" });
    toast.success("Bloqueie a tela agora: a notificação chega em 5 segundos.");
  }

  const perfilInfo = perfil as { nome?: string | null; email?: string | null } | null | undefined;
  const tema = (prefs as { tema?: string }).tema ?? "claro";

  return (
    <AppLayout title="Ajustes" description="Preferências do app">
      <div className="mx-auto max-w-xl">
        <Grupo titulo="Conta">
          <Linha
            icone={<UserRound className="size-4.5" />}
            cor="bg-sky-500"
            titulo={perfilInfo?.nome || "Minha conta"}
            detalhe={perfilInfo?.email ?? "Dados pessoais, senha e segurança"}
            para="/conta"
          />
        </Grupo>

        <Grupo titulo="Preferências">
          <Linha
            icone={<Languages className="size-4.5" />}
            cor="bg-indigo-500"
            titulo="Idioma"
            detalhe="Padrão: português do Brasil"
            direita={<SeletorIdioma mostrarNome />}
          />
          <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white">
              <Moon className="size-4.5" />
            </span>
            <span className="flex-1 text-sm font-medium">Aparência</span>
            <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs" role="group" aria-label="Aparência">
              {(
                [
                  ["claro", "Claro"],
                  ["escuro", "Escuro"],
                  ["automatico", "Auto"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={tema === valor}
                  onClick={() => save.mutate({ tema: valor })}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                    tema === valor ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        </Grupo>

        <Grupo
          titulo="iPhone"
          rodape={
            nativo
              ? "Os lembretes de vencimento chegam na tela de bloqueio às 9h, na véspera e no dia."
              : "Estes recursos funcionam no app do iPhone."
          }
        >
          <Linha
            icone={<Bell className="size-4.5" />}
            cor="bg-rose-500"
            titulo="Testar notificação"
            detalhe="Chega em 5 segundos, com a tela bloqueada"
            onClick={testarNotificacao}
          />
          <Linha
            icone={<CalendarPlus className="size-4.5" />}
            cor="bg-red-500"
            titulo="Agenda do iPhone"
            detalhe={vinculada ? "Vinculada: atualiza sozinha" : "Toque para vincular no Calendário"}
            para="/calendario"
          />
        </Grupo>

        <Grupo titulo="Privacidade">
          <Linha
            icone={<ShieldCheck className="size-4.5" />}
            cor="bg-emerald-600"
            titulo="Aviso de privacidade"
            para="/privacidade"
          />
          <Linha icone={<FileText className="size-4.5" />} cor="bg-zinc-500" titulo="Termos de uso" para="/termos-de-uso" />
        </Grupo>

        <Grupo titulo="Sobre">
          <Linha
            icone={<Info className="size-4.5" />}
            cor="bg-blue-600"
            titulo="Control ALL para iPhone"
            direita={
              <span className="text-xs text-muted-foreground">
                {app?.versao ? `${app.versao} (${app.build})` : "site"}
              </span>
            }
          />
        </Grupo>

        <Grupo titulo="Sessão">
          <Linha
            icone={<LogOut className="size-4.5" />}
            cor="bg-destructive"
            titulo="Sair da conta"
            perigo
            onClick={() => window.dispatchEvent(new Event("sair-da-conta"))}
          />
        </Grupo>
      </div>
    </AppLayout>
  );
}
