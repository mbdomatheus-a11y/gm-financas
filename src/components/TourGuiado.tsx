import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { meuTourStatus, concluirTour } from "@/lib/tour.functions";
import { useSession } from "@/hooks/useAuthData";

type Passo = {
  rota: string;
  /** Sem selector = passo de boas-vindas, centralizado na tela. */
  selector?: string;
  titulo: string;
  descricao: string;
};

// Primeira versão (2026-09-28): só "lançar receita" e "lançar despesa".
// Estendido na Frente 4 (plano de 2026-10-02) com lançamento/resumo por IA,
// nota fiscal e lista de compras — cobrindo os fluxos mais usados do site.
// Cada passo mora numa rota diferente — ver comentário no componente sobre
// como a navegação entre elas é feita no meio do tour.
// 15/11/2026: tour com destaque, 6 passos no Início (uma ideia por passo). Anel azul do Control ALL em
// volta da função e caixa curta ao lado. Tocar na função destacada também avança.
const PASSOS: Passo[] = [
  { rota: "/inicio", selector: '[data-tour="inicio-sobra"]', titulo: "Vai sobrar", descricao: "Quanto sobra até o próximo salário, já contando contas e faturas." },
  { rota: "/inicio", selector: '[data-tour="inicio-lancar"]', titulo: "Lançar", descricao: "Gasto, entrada ou fatura em poucos toques." },
  { rota: "/inicio", selector: '[data-tour="inicio-ia"]', titulo: "IA", descricao: "Escreva ou fale \"almoço 45 no Nubank\" e a IA lança para você." },
  { rota: "/inicio", selector: '[data-tour="inicio-cartoes"]', titulo: "Contas e cartões", descricao: "Saldo das contas e quando cada fatura sai do bolso." },
  { rota: "/inicio", selector: '[data-tour="inicio-saude"]', titulo: "Saúde financeira", descricao: "Uma nota de 0 a 100 e o que fazer para subir." },
  { rota: "/inicio", selector: '[data-tour="menu"]', titulo: "Tudo à mão", descricao: "Metas, relatórios, notas e configurações ficam no menu. O tour pode ser visto de novo em Ajuda." },
];

/**
 * Tour guiado, exibido depois do aviso de boas-vindas pra quem é novo no
 * site: destaca onde lançar despesa e receita, avançando de tela em tela.
 *
 * Como os passos moram em rotas diferentes, um `driver.js` comum (que só
 * troca de elemento na MESMA página) não basta. Por isso cada passo que não
 * é o último sobrescreve `onNextClick` pra navegar manualmente pra rota do
 * próximo passo e só então chamar `driver.moveNext()` — o `waitForElement`
 * de cada passo absorve o tempo que a nova tela leva pra renderizar o botão
 * de destino. No último passo e ao fechar (X/Esc), o comportamento padrão
 * do driver.js já destrói a instância e dispara `onDestroyed`, que é onde
 * marcamos o tour como concluído.
 *
 * `bloqueado` (o aviso de boas-vindas ainda aberto) impede o tour de
 * tentar começar por cima do modal bloqueante.
 *
 * Admin controla isso em Administração > Avisos: pode desligar o tour pra
 * todo mundo, ou "reenviar" (mesmo mecanismo de reset via delete usado nos
 * comunicados — apaga as linhas de `tour_concluido`, fazendo reaparecer
 * pra quem já tinha visto).
 */
/** O menu existe duas vezes (lateral no computador, botão no celular): destaca o que está na tela. */
function elementoVisivel(seletor: string): Element | undefined {
  const lista = Array.from(document.querySelectorAll(seletor));
  return lista.find((el) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed") ?? lista[0];
}

export function TourGuiado({ bloqueado }: { bloqueado: boolean }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const statusFn = useServerFn(meuTourStatus);
  const concluirFn = useServerFn(concluirTour);
  const iniciadoRef = useRef(false);
  const concluidoRef = useRef(false);

  const { data } = useQuery({
    queryKey: ["tour-guiado-status"],
    queryFn: () => statusFn(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || bloqueado || iniciadoRef.current) return;
    // 15/11/2026: quem acabou de passar pelas boas-vindas nesta visita vê o tour na próxima, não em seguida.
    try {
      if (sessionStorage.getItem("control-all.boas-vindas-sessao")) return;
    } catch {
      // sem sessionStorage: segue
    }
    if (!data?.ativo || data.concluido) return;
    iniciadoRef.current = true;

    async function finalizar() {
      if (concluidoRef.current) return;
      concluidoRef.current = true;
      try {
        await concluirFn();
      } catch {
        // Se falhar, sem problema — volta a aparecer no próximo login.
      } finally {
        qc.invalidateQueries({ queryKey: ["tour-guiado-status"] });
      }
    }

    const instancia = driver({
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      popoverClass: "tour-control-all",
      stageRadius: 18,
      allowClose: true,
      overlayOpacity: 0.6,
      stagePadding: 8,
      nextBtnText: "Próximo",
      showButtons: ["next", "close"],
      doneBtnText: "Começar a usar",
      // Só conta como concluído quando a PESSOA fecha/conclui o tour. Antes,
      // `onDestroyed` marcava como concluído até quando o tour era destruído
      // sozinho (elemento não encontrado, troca de rota), e o usuário novo
      // nunca chegava a ver o tour (corrigido em 2026-10-04).
      onDestroyStarted: (_el: unknown, _step: unknown, opts: any) => {
        void finalizar();
        opts.driver.destroy();
      },
      // Tocar na função destacada conta como "entendi": avança para o próximo passo.
      onHighlighted: (el: Element | undefined, _step: unknown, opts: any) => {
        el?.addEventListener(
          "click",
          () => {
            if (opts.driver.isActive()) {
              if (opts.driver.isLastStep()) opts.driver.destroy();
              else opts.driver.moveNext();
            }
          },
          { once: true },
        );
      },
      steps: PASSOS.map((passo, i) => ({
        ...(passo.selector ? { element: () => elementoVisivel(passo.selector!) as Element, waitForElement: 4000 } : {}),
        popover: {
          title: passo.titulo,
          description: passo.descricao,
          ...(i < PASSOS.length - 1
            ? {
                onNextClick: (_el: unknown, _step: unknown, opts: any) => {
                  const proximo = PASSOS[i + 1];
                  if (!proximo) return;
                  if (window.location.pathname === proximo.rota) opts.driver.moveNext();
                  else navigate({ to: proximo.rota }).then(() => opts.driver.moveNext());
                },
              }
            : {}),
        },
      })),
    });

    const primeiro = PASSOS[0];
    if (primeiro) navigate({ to: primeiro.rota }).then(() => instancia.drive(0));

    return () => {
      instancia.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, bloqueado, data?.ativo, data?.concluido]);

  return null;
}
