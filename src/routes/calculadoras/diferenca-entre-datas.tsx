import { createFileRoute } from "@tanstack/react-router";
import { DiferencaEntreDatas } from "@/components/ferramentas/DiferencaEntreDatas";
import { PaginaCalculadoraPublica } from "@/components/ferramentas/PaginaCalculadoraPublica";

export const Route = createFileRoute("/calculadoras/diferenca-entre-datas")({
  head: () => ({ meta: [
    { title: "Diferença entre datas: calcular dias, horas e anos | Control ALL" },
    { name: "description", content: "Descubra quantos dias, horas, minutos ou anos existem entre duas datas. Calculadora gratuita e sem cadastro." },
  ], links: [{ rel: "canonical", href: "https://www.controlall.com.br/calculadoras/diferenca-entre-datas" }] }),
  component: () => <PaginaCalculadoraPublica titulo="Diferença entre datas" descricao="Veja o intervalo entre duas datas em dias, horas, minutos, segundos, anos ou séculos." explicacao="Informe a data inicial e a data final, depois escolha a unidade. A calculadora atualiza o resultado automaticamente. Se trocar a ordem das datas, você verá a diferença com sinal negativo." exemplo="Para saber quantos dias faltam entre hoje e uma viagem, selecione hoje como data inicial e o dia da viagem como data final."><DiferencaEntreDatas /></PaginaCalculadoraPublica>,
});
