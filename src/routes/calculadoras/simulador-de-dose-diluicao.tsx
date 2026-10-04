import { createFileRoute } from "@tanstack/react-router";
import { SimuladorInterativo } from "@/components/ferramentas/SimuladorInterativo";
import { PaginaCalculadoraPublica } from "@/components/ferramentas/PaginaCalculadoraPublica";

export const Route = createFileRoute("/calculadoras/simulador-de-dose-diluicao")({
  head: () => ({
    meta: [
      { title: "Simulador de dose e diluição (uso acadêmico) | Control ALL" },
      {
        name: "description",
        content:
          "Conversor didático de dose/diluição e visualização de seringa. Ferramenta de uso exclusivamente acadêmico — não substitui cálculo ou conferência de dose reais.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://www.controlall.com.br/calculadoras/simulador-de-dose-diluicao" },
    ],
  }),
  component: () => (
    <PaginaCalculadoraPublica
      titulo="Simulador de dose e diluição"
      descricao="Conversor didático de dose/diluição com visualização de seringa — uso exclusivamente acadêmico."
      explicacao="Informe a composição do frasco (massa e volume) e a dose desejada. O simulador calcula o volume correspondente e mostra a posição aproximada na escala de uma seringa. É uma ferramenta de estudo, não uma referência clínica."
      exemplo="Para entender como ler a escala de uma seringa de insulina de 100 UI, escolha essa seringa e veja a posição do êmbolo mudar conforme você ajusta a dose."
    >
      <SimuladorInterativo />
    </PaginaCalculadoraPublica>
  ),
});
