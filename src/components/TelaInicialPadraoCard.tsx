import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Home } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  obterConfiguracaoAcesso,
  adminSalvarTelaInicialPadrao,
} from "@/lib/configuracoes-site.functions";
import { TELAS_INICIAIS, ROTULOS_TELA_INICIAL, type TelaInicialPadrao } from "@/lib/tela-inicial-padrao";

/**
 * Tela de abertura padrão (Item 1 da Frente 4, plano de 2026-10-02): admin
 * escolhe pra qual módulo o login cai por padrão, em vez de sempre ir pro
 * seletor de módulos (`/inicio`). Card independente — mesmo espírito de
 * `IaLancamentoModoSiteCard.tsx`, nunca threadado na mutação grande
 * `adminSalvarConfiguracaoAcesso`.
 */
export function TelaInicialPadraoCard() {
  const qc = useQueryClient();
  const obterFn = useServerFn(obterConfiguracaoAcesso);
  const salvarFn = useServerFn(adminSalvarTelaInicialPadrao);

  const { data } = useQuery({
    queryKey: ["admin-tela-inicial-padrao"],
    queryFn: () => obterFn(),
  });

  const salvar = useMutation({
    mutationFn: (tela: TelaInicialPadrao) => salvarFn({ data: { tela } }),
    onSuccess: () => {
      toast.success("Tela de abertura padrão atualizada");
      qc.invalidateQueries({ queryKey: ["admin-tela-inicial-padrao"] });
      qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica"] });
      qc.invalidateQueries({ queryKey: ["configuracao-acesso-publica-entrar"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar"),
  });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Home className="size-4 text-muted-foreground" aria-hidden="true" /> Tela de abertura
        </CardTitle>
        <p className="text-sm text-muted-foreground">Para onde o login leva, em vez do seletor de módulos.</p>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-2xl border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Tela padrão</p>
              <p className="text-xs text-muted-foreground">Vale para todos os usuários.</p>
            </div>
        <Select
          value={data?.tela_inicial_padrao ?? "financas"}
          onValueChange={(v) => salvar.mutate(v as TelaInicialPadrao)}
          disabled={salvar.isPending}
        >
          <SelectTrigger className="w-44 shrink-0 sm:w-56" aria-label="Tela de abertura padrão">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TELAS_INICIAIS.map((tela) => (
              <SelectItem key={tela} value={tela}>
                {ROTULOS_TELA_INICIAL[tela]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
