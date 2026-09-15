import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useProfilesList, useRolesList } from "@/hooks/useFinance";
import { usePermissoes, type Modulo } from "@/hooks/useAuthData";
import { adminSetRole } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { maskCpf } from "@/lib/cpf";

const MODULOS: { key: Modulo; label: string }[] = [
  { key: "receitas", label: "Receitas" },
  { key: "despesas", label: "Despesas" },
  { key: "cartoes", label: "Cartões e Bancos" },
  { key: "investimentos", label: "Investimentos" },
  { key: "veiculos", label: "Meu Veículo" },
  { key: "compartilhar", label: "Compartilhar" },
  { key: "personalizacao", label: "Personalização" },
];

/**
 * Gerenciamento de privilégios (papel admin/comum + matriz de permissões por
 * módulo) de outros usuários do grupo. Extraído de `/usuarios` para poder ser
 * reaproveitado como atalho direto na tela de perfil (`/conta`) do admin, sem
 * precisar navegar até a área completa de Usuários e Privilégios.
 */
export function PermissoesUsuariosCard({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { isAdmin } = usePermissoes();
  const { data: perfis = [] } = useProfilesList();
  const { data: roles = [] } = useRolesList();
  const setRole = useServerFn(adminSetRole);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const { data: permissoes = [] } = useQuery({
    queryKey: ["permissoes-todas"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("permissoes").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const roleDe = (id: string) => roles.find((r: any) => r.user_id === id)?.role ?? "comum";
  const permDe = (id: string, modulo: string) =>
    permissoes.find((p: any) => p.user_id === id && p.modulo === modulo);

  const alterarRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "admin" | "comum" }) =>
      setRole({ data: { userId: id, role } }),
    onSuccess: () => {
      toast.success("Privilégio atualizado");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const salvarPermissao = useMutation({
    mutationFn: async (row: {
      user_id: string;
      modulo: string;
      pode_ver: boolean;
      pode_editar: boolean;
      pode_excluir: boolean;
    }) => {
      const { error } = await supabase
        .from("permissoes")
        .upsert(row, { onConflict: "user_id,modulo" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissoes-todas"] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" /> Permissões de outros usuários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!compact && (
          <p className="text-xs text-muted-foreground">
            Atalho rápido para o mesmo controle que existe em "Usuários e Privilégios" — dê ou
            revogue acesso por módulo sem sair do seu perfil. Criar usuário, redefinir senha ou
            editar nome continua em Usuários e Privilégios.
          </p>
        )}
        <div className="max-h-[28rem] space-y-2 overflow-y-auto">
          {perfis.map((p: any) => {
            const role = roleDe(p.id);
            const aberto = detalhe === p.id;
            return (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="text-[11px] text-muted-foreground">CPF {maskCpf(p.cpf)}</p>
                  </div>
                  <Badge variant={role === "admin" ? "default" : "secondary"}>
                    {role === "admin" ? "Administrador" : "Comum"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      alterarRole.mutate({ id: p.id, role: role === "admin" ? "comum" : "admin" })
                    }
                  >
                    <ShieldCheck className="size-3.5" />
                    {role === "admin" ? "Tornar comum" : "Tornar administrador"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setDetalhe(aberto ? null : p.id)}
                  >
                    {aberto ? "Ocultar módulos" : "Editar por módulo"}
                  </Button>
                </div>
                {aberto && (
                  <div className="mt-2 overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                        <tr>
                          <th className="p-1.5 text-left font-medium">Módulo</th>
                          <th className="p-1.5 font-medium">Ver</th>
                          <th className="p-1.5 font-medium">Editar</th>
                          <th className="p-1.5 font-medium">Excluir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MODULOS.map((m) => {
                          const row = permDe(p.id, m.key);
                          const atual = {
                            user_id: p.id,
                            modulo: m.key,
                            pode_ver: row?.pode_ver ?? true,
                            pode_editar: row?.pode_editar ?? true,
                            pode_excluir: row?.pode_excluir ?? false,
                          };
                          return (
                            <tr key={m.key} className="border-t">
                              <td className="p-1.5">{m.label}</td>
                              {(["pode_ver", "pode_editar", "pode_excluir"] as const).map(
                                (campo) => (
                                  <td key={campo} className="p-1.5 text-center">
                                    <Switch
                                      checked={atual[campo]}
                                      onCheckedChange={(v) =>
                                        salvarPermissao.mutate({ ...atual, [campo]: v })
                                      }
                                    />
                                  </td>
                                ),
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
