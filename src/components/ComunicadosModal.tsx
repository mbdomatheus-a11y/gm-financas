import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { meusComunicados, aceitarComunicado } from "@/lib/comunicados.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile, useSession } from "@/hooks/useAuthData";

function saudacaoPeloHorario(): string {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Aviso administrável exibido a usuários autenticados (2026-09-28, ao
 * preparar o site para os primeiros usuários de fora da família): o admin
 * publica/edita um aviso em Administração > Avisos, e ele aparece aqui como
 * modal bloqueante (sem fechar por fora ou pelo Esc) até o usuário
 * confirmar.
 *
 * Se o usuário marcar "não exibir esta mensagem novamente", a confirmação é
 * permanente (tabela comunicado_aceites) — só volta a aparecer se o admin
 * editar o texto ou clicar em "Reenviar para todos" (o que reseta as
 * confirmações de todo mundo, ignorando quem já tinha lido).
 *
 * Se NÃO marcar a caixa, a confirmação não é salva no servidor: o aviso só
 * some pelo restante desta sessão do navegador (guardado em sessionStorage,
 * por usuário) e volta a aparecer no próximo login.
 */
export function ComunicadosModal({
  onVisibilityChange,
}: {
  /** Avisa o componente pai se há (ou não) um aviso bloqueando a tela agora
   * — usado pra impedir que o tour guiado comece por cima do modal. */
  onVisibilityChange?: (visivel: boolean) => void;
} = {}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const listar = useServerFn(meusComunicados);
  const aceitar = useServerFn(aceitarComunicado);

  const { data: pendentes = [] } = useQuery({
    queryKey: ["comunicados-pendentes"],
    queryFn: () => listar(),
    refetchInterval: 60_000,
    enabled: !!user,
  });

  const [dispensadosSessao, setDispensadosSessao] = useState<Set<string>>(new Set());
  const [naoExibirMais, setNaoExibirMais] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const atual = pendentes.find((c: any) => !dispensadosSessao.has(c.id));

  useEffect(() => {
    if (!user?.id || pendentes.length === 0) return;
    setDispensadosSessao((atual) => {
      const dispensados = new Set(atual);
      for (const c of pendentes) {
        const chave = `comunicado-dispensado-sessao:${user.id}:${c.id}`;
        if (sessionStorage.getItem(chave)) dispensados.add(c.id);
      }
      return dispensados;
    });
  }, [user?.id, pendentes]);

  useEffect(() => {
    setNaoExibirMais(false);
  }, [atual?.id]);

  useEffect(() => {
    onVisibilityChange?.(!!atual);
  }, [atual, onVisibilityChange]);

  if (!atual) return null;

  async function confirmar() {
    if (!atual) return;
    setEnviando(true);
    try {
      if (naoExibirMais) {
        await aceitar({ data: { id: atual.id } });
        qc.invalidateQueries({ queryKey: ["comunicados-pendentes"] });
      } else if (user?.id) {
        sessionStorage.setItem(`comunicado-dispensado-sessao:${user.id}:${atual.id}`, "1");
        setDispensadosSessao((atual2) => new Set(atual2).add(atual.id));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        hideCloseButton
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <p className="text-sm font-medium text-primary">
            {saudacaoPeloHorario()}
            {profile?.nome ? `, ${String(profile.nome).split(" ")[0]}` : ""}!
          </p>
          <DialogTitle>{atual.titulo}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-foreground/90">
            {atual.mensagem}
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={naoExibirMais} onCheckedChange={(v) => setNaoExibirMais(v === true)} />
          Não exibir esta mensagem novamente
        </label>
        <DialogFooter>
          <Button onClick={confirmar} disabled={enviando}>
            Ok, entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
