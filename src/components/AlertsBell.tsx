import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { alertasDosVeiculos } from "@/lib/veiculo-alertas";
import { diasRestantes } from "@/lib/nfe";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useServerFn } from "@tanstack/react-start";
import {
  limparVersoesSite,
  meuHistoricoAlertas,
  minhasChavesAlertasLidos,
  marcarAlertaLido,
  versoesAtivasSite,
} from "@/lib/comunicados.functions";
import { useIsAdmin } from "@/hooks/useAuthData";

type Aviso = { chave: string; texto: string; destino?: "/notas" | "/veiculos" | "/lista-compras" };

export function AlertsBell() {
  const historicoFn = useServerFn(meuHistoricoAlertas);
  const chavesFn = useServerFn(minhasChavesAlertasLidos);
  const marcarFn = useServerFn(marcarAlertaLido);
  const versoesFn = useServerFn(versoesAtivasSite);
  const limparFn = useServerFn(limparVersoesSite);
  const { data: isAdmin } = useIsAdmin();
  const { data: versoes = [], refetch: refetchVersoes } = useQuery({
    queryKey: ["versoes-site"],
    queryFn: () => versoesFn(),
  });
  const { data: chavesLidas = [], refetch: refetchLidas } = useQuery({
    queryKey: ["alertas-lidos"],
    queryFn: () => chavesFn(),
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["historico-alertas"],
    queryFn: () => historicoFn(),
  });
  const { data: avisos = [] } = useQuery({
    queryKey: ["alertas-globais"],
    queryFn: async (): Promise<Aviso[]> => {
      const [veiculos, notas, compras] = await Promise.all([
        supabase
          .from("veiculos")
          .select(
            "id,nome,km_atual,km_proxima_troca_oleo,data_proxima_troca_oleo,data_vencimento_ipva,data_vencimento_seguro",
          ),
        supabase
          .from("notas_fiscais")
          .select("id,estabelecimento,descricao,garantia_fim")
          .not("garantia_fim", "is", null),
        supabase
          .from("lista_compras")
          .select("id,nome,comprado,aprovacoes_necessarias,aprovado_por,alerta_em")
          .eq("comprado", false),
      ]);
      if (veiculos.error || notas.error || compras.error)
        throw new Error("Não foi possível carregar os alertas.");
      const alertas: Aviso[] = alertasDosVeiculos(veiculos.data ?? []).map((alerta) => {
        const veiculo = (veiculos.data ?? []).find((item) => item.id === alerta.veiculoId);
        const referencia =
          alerta.tipo === "oleo"
            ? `${veiculo?.km_proxima_troca_oleo ?? ""}:${veiculo?.data_proxima_troca_oleo ?? ""}`
            : alerta.tipo === "ipva"
              ? veiculo?.data_vencimento_ipva
              : veiculo?.data_vencimento_seguro;
        return {
          chave: `veiculo:${alerta.veiculoId}:${alerta.tipo}:${referencia ?? "sem-data"}`,
          texto: `${alerta.veiculoNome}: ${alerta.mensagem}`,
          destino: "/veiculos",
        };
      });
      for (const nota of notas.data ?? []) {
        if (!nota.garantia_fim) continue;
        const dias = diasRestantes(nota.garantia_fim);
        if (dias !== null && dias >= -30 && dias <= 30)
          alertas.push({
            chave: `garantia:${nota.id}:${nota.garantia_fim}`,
            texto: `${nota.estabelecimento ?? nota.descricao ?? "Nota fiscal"}: garantia ${dias < 0 ? `vencida há ${Math.abs(dias)} dias` : `vence em ${dias} dias`}`,
            destino: "/notas",
          });
      }
      for (const compra of compras.data ?? []) {
        const aprovadores = Array.isArray(compra.aprovado_por) ? compra.aprovado_por : [];
        if (
          (compra.aprovacoes_necessarias ?? 0) > 0 &&
          aprovadores.length >= (compra.aprovacoes_necessarias ?? 0)
        ) {
          alertas.push({
            chave: `compra-aprovada:${compra.id}:${aprovadores.length}`,
            texto: `${compra.nome}: compra aprovada`,
            destino: "/lista-compras",
          });
        } else if (compra.alerta_em && compra.alerta_em <= new Date().toISOString().slice(0, 10)) {
          alertas.push({
            chave: `compra-alerta:${compra.id}:${compra.alerta_em}`,
            texto: `${compra.nome}: lembrete da lista de compras`,
            destino: "/lista-compras",
          });
        }
      }
      return alertas.slice(0, 50);
    },
    refetchInterval: 60_000,
  });
  const avisosComVersao: Aviso[] = [
    ...avisos,
    ...versoes.map((v: any) => ({
      chave: `versao:${v.versao}`,
      texto: `Nova versão publicada: build ${v.versao} · ${new Date(v.build_em ?? v.criado_em).toLocaleString("pt-BR")}`,
    })),
  ];
  const naoLidos = avisosComVersao.filter((aviso) => !chavesLidas.includes(aviso.chave));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${naoLidos.length} alertas não lidos`}
          className="relative"
        >
          <Bell className="size-5" />
          {naoLidos.length > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {naoLidos.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-96 w-80 overflow-y-auto p-2">
        <p className="px-2 py-1 text-sm font-semibold">Alertas ({naoLidos.length})</p>
        {naoLidos.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum alerta no momento.</p>
        ) : (
          naoLidos.map((aviso, indice) =>
            aviso.destino ? (
              <Link
                key={`${aviso.destino}-${indice}`}
                to={aviso.destino}
                className="block rounded-md px-2 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  void marcarFn({
                    data: {
                      chave: aviso.chave,
                      titulo: "Alerta do Control ALL",
                      mensagem: aviso.texto,
                    },
                  }).then(() => refetchLidas());
                }}
              >
                {aviso.texto}
              </Link>
            ) : (
              <button
                key={aviso.chave}
                className="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() =>
                  void marcarFn({
                    data: {
                      chave: aviso.chave,
                      titulo: "Atualização do Control ALL",
                      mensagem: aviso.texto,
                    },
                  }).then(() => refetchLidas())
                }
              >
                {aviso.texto}
              </button>
            ),
          )
        )}
        {isAdmin && versoes.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => void limparFn().then(() => refetchVersoes())}
          >
            Limpar versões para todos
          </Button>
        )}
        {historico.length > 0 && (
          <>
            <p className="mt-2 border-t px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">
              Histórico de avisos
            </p>
            {historico.slice(0, 8).map((aviso: any) => (
              <div key={aviso.id} className="rounded-md px-2 py-2 text-sm">
                <p className="font-medium">{aviso.titulo}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{aviso.mensagem}</p>
              </div>
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
