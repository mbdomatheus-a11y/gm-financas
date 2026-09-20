import { createFileRoute } from "@tanstack/react-router";
import { DataMaisIntervalo } from "@/components/ferramentas/DataMaisIntervalo";
import { PaginaCalculadoraPublica } from "@/components/ferramentas/PaginaCalculadoraPublica";

export const Route = createFileRoute("/calculadoras/somar-dias-a-data")({
  head: () => ({ meta: [
    { title: "Somar ou subtrair dias de uma data | Control ALL" },
    { name: "description", content: "Some ou subtraia dias, meses e anos de qualquer data. Descubra a data final gratuitamente, sem cadastro." },
  ], links: [{ rel: "canonical", href: "https://www.controlall.com.br/calculadoras/somar-dias-a-data" }] }),
  component: () => <PaginaCalculadoraPublica titulo="Somar ou subtrair dias de uma data" descricao="Descubra qual será a data após acrescentar ou retirar dias, meses ou anos." explicacao="Escolha a data de partida, defina se deseja somar ou subtrair, informe a quantidade e selecione a unidade de tempo. A data calculada aparece logo abaixo." exemplo="Selecione uma data, escolha somar 90 dias e veja o dia correspondente ao fim desse intervalo."><DataMaisIntervalo /></PaginaCalculadoraPublica>,
});
