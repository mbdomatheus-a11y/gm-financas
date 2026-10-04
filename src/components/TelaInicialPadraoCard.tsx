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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Home className="size-4" /> Tela de abertura padrão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Pra onde o login leva por padrão, em vez do seletor de módulos (Início).
        </p>
        <Select
          value={data?.tela_inicial_padrao ?? "financas"}
          onValueChange={(v) => salvar.mutate(v as TelaInicialPadrao)}
          disabled={salvar.isPending}
        >
          <SelectTrigger className="w-full sm:w-64">
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
      </CardContent>
    </Card>
  );
}
