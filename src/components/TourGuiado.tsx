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
  selector: string;
  titulo: string;
  descricao: string;
};

// Só "lançar receita" e "lançar despesa" nesta primeira versão (2026-09-28).
// Cada passo mora numa rota diferente — ver comentário no componente sobre
// como a navegação entre elas é feita no meio do tour.
const PASSOS: Passo[] = [
  {
    rota: "/despesas",
    selector: '[data-tour="nova-despesa"]',
    titulo: "Lance uma despesa",
    descricao: "Clique aqui sempre que precisar registrar uma nova despesa.",
  },
  {
    rota: "/receitas",
    selector: '[data-tour="nova-receita"]',
    titulo: "Lance uma receita",
    descricao: "E aqui pra registrar uma nova receita. Pronto — você já sabe o essencial!",
  },
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
      allowClose: true,
      overlayOpacity: 0.6,
      stagePadding: 6,
      nextBtnText: "Próximo",
      prevBtnText: "Voltar",
      doneBtnText: "Concluir",
      onDestroyed: () => {
        void finalizar();
      },
      steps: PASSOS.map((passo, i) => ({
        element: passo.selector,
        waitForElement: 4000,
        popover: {
          title: passo.titulo,
          description: passo.descricao,
          ...(i < PASSOS.length - 1
            ? {
                onNextClick: (_el: unknown, _step: unknown, opts: any) => {
                  const proximo = PASSOS[i + 1];
                  if (!proximo) return;
                  navigate({ to: proximo.rota }).then(() => opts.driver.moveNext());
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
