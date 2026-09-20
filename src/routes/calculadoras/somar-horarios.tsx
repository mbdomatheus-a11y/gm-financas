import { createFileRoute } from "@tanstack/react-router";
import { CalculadoraHorarios } from "@/components/ferramentas/CalculadoraHorarios";
import { PaginaCalculadoraPublica } from "@/components/ferramentas/PaginaCalculadoraPublica";

export const Route = createFileRoute("/calculadoras/somar-horarios")({
  head: () => ({ meta: [
    { title: "Somar e subtrair horários online | Control ALL" },
    { name: "description", content: "Some e subtraia horas e minutos em várias linhas. Calculadora de horários gratuita e sem cadastro." },
  ], links: [{ rel: "canonical", href: "https://www.controlall.com.br/calculadoras/somar-horarios" }] }),
  component: () => <PaginaCalculadoraPublica titulo="Somar e subtrair horários" descricao="Faça contas com durações em horas e minutos, com quantas linhas precisar." explicacao="Digite as horas e os minutos da primeira duração. Adicione outras linhas e escolha o sinal de soma ou subtração em cada uma. O total aparece em horas e minutos." exemplo="Para calcular 8h00 + 7h20 − 1h15, crie três linhas e escolha o sinal de cada duração."><CalculadoraHorarios /></PaginaCalculadoraPublica>,
});
