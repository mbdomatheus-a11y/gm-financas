import { useState } from "react";
import { CalendarPlus, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assinatura do calendário (iCalendar) no site, igual à do app (25/10/2026). Usa a mesma Edge
 * Function `calendario-ics`: o link é privado e atualiza sozinho no Google Agenda, Outlook ou
 * Calendário do iPhone/Mac. "Gerar novo link" invalida o anterior.
 */
async function pedirLink(renovar: boolean): Promise<string> {
  const { data, error } = await supabase.functions.invoke("calendario-ics", {
    body: { action: renovar ? "renovar" : "link" },
  });
  const url = (data as { url?: string } | null)?.url;
  if (error || !url) throw new Error((data as { error?: string } | null)?.error ?? "Não foi possível gerar o link agora.");
  return url;
}

const paraWebcal = (url: string) => url.replace(/^https?:\/\//i, "webcal://");
const googleAgenda = (url: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(paraWebcal(url))}`;

export function AssinaturaCalendario() {
  const [carregando, setCarregando] = useState<null | "google" | "abrir" | "copiar" | "renovar">(null);
  const [confirmar, setConfirmar] = useState(false);

  async function executar(tipo: "google" | "abrir" | "copiar") {
    setCarregando(tipo);
    try {
      const url = await pedirLink(false);
      if (tipo === "google") window.open(googleAgenda(url), "_blank", "noopener,noreferrer");
      else if (tipo === "abrir") window.location.href = paraWebcal(url);
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado. Cole em \"Adicionar calendário por URL\" no app de agenda.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o link.");
    } finally {
      setCarregando(null);
    }
  }

  async function renovar() {
    setConfirmar(false);
    setCarregando("renovar");
    try {
      await pedirLink(true);
      toast.success("Link novo gerado. O antigo parou de funcionar; assine de novo na sua agenda.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar um novo link.");
    } finally {
      setCarregando(null);
    }
  }

  return (
    <Card className="mt-4">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <CalendarPlus className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">Ver no seu calendário</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Faturas, vencimentos e compras no Google Agenda, Outlook ou iPhone, sempre atualizados. O link é privado.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button size="sm" className="h-10 rounded-full px-4" disabled={!!carregando} onClick={() => executar("google")}>
            {carregando === "google" ? "Abrindo..." : "Adicionar ao Google Agenda"}
          </Button>
          <Button size="sm" variant="outline" className="h-10 rounded-full px-4" disabled={!!carregando} onClick={() => executar("abrir")}>
            {carregando === "abrir" ? "Abrindo..." : "Abrir no app de calendário"}
          </Button>
          <Button size="sm" variant="outline" className="h-10 rounded-full px-4" disabled={!!carregando} onClick={() => executar("copiar")}>
            <Copy className="size-4" /> Copiar link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 rounded-full px-4 text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto"
            disabled={!!carregando}
            onClick={() => setConfirmar(true)}
          >
            <RefreshCw className="size-4" /> Gerar novo link
          </Button>
        </div>
      </CardContent>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent className="gap-4 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual para de funcionar e você precisará assinar de novo na sua agenda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:space-x-0">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={renovar}>Gerar novo link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
