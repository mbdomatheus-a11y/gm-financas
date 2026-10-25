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
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarPlus className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Ver no seu calendário</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Faturas, vencimentos, receitas previstas, garantias e lista de compras aparecem no Google Agenda, no
              Outlook ou no Calendário do iPhone/Mac e se atualizam sozinhos. O link é privado: não compartilhe.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!!carregando} onClick={() => executar("google")}>
            {carregando === "google" ? "Abrindo..." : "Adicionar ao Google Agenda"}
          </Button>
          <Button size="sm" variant="outline" disabled={!!carregando} onClick={() => executar("abrir")}>
            {carregando === "abrir" ? "Abrindo..." : "Abrir no app de calendário"}
          </Button>
          <Button size="sm" variant="outline" disabled={!!carregando} onClick={() => executar("copiar")}>
            <Copy className="size-4" /> Copiar link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={!!carregando}
            onClick={() => setConfirmar(true)}
          >
            <RefreshCw className="size-4" /> Gerar novo link
          </Button>
        </div>
      </CardContent>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual para de funcionar: as agendas que assinaram com ele (e quem mais tiver o link) deixam de
              receber os eventos. Depois é só assinar de novo com o link novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={renovar}>Gerar novo link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
