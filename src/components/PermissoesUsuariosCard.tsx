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
import { adminSetRole, grupoAdminSetRole } from "@/lib/admin.functions";
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
  { key: "importar", label: "Importar Lançamentos" },
];

/** Etapa D (plano-importacao-v2.md): colunas extras só fazem sentido para o
 * módulo "importar" — nas demais linhas aparece um "—" em vez de switch. */
const CAMPOS_IMPORTACAO = [
  { campo: "pode_importar_lancamentos" as const, label: "Lançamentos" },
  { campo: "pode_importar_parcelamentos" as const, label: "Parcelamentos" },
  { campo: "pode_importar_limite" as const, label: "Limite do cartão" },
];

/**
 * Gerenciamento de privilégios (papel admin/comum + matriz de permissões por
 * módulo) de outros usuários do grupo. Extraído de `/usuarios` para poder ser
 * reaproveitado como atalho direto na tela de perfil (`/conta`) do admin, sem
 * precisar navegar até a área completa de Usuários e Privilégios.
 */
export function PermissoesUsuariosCard({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { isSiteAdmin, isAdmin } = usePermissoes();
  const { data: perfis = [] } = useProfilesList();
  const { data: roles = [] } = useRolesList();
  const setRole = useServerFn(adminSetRole);
  const grupoSetRole = useServerFn(grupoAdminSetRole);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const { data: permissoes = [] } = useQuery({
    queryKey: ["permissoes-todas"],
    enabled: isSiteAdmin,
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
    mutationFn: async ({ id, role }: { id: string; role: "admin" | "comum" }) => {
      if (isSiteAdmin) return setRole({ data: { userId: id, role } });
      return grupoSetRole({ data: { userId: id, role } });
    },
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
      pode_importar_lancamentos?: boolean;
      pode_importar_parcelamentos?: boolean;
      pode_importar_limite?: boolean;
    }) => {
      const { error } = await supabase
        .from("permissoes")
        .upsert(row, { onConflict: "user_id,modulo" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissoes-todas"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Item 7 (parte 2): o admin do site nunca perde acesso a este card, mesmo
  // que o papel dele (user_roles, por grupo) tenha sido alterado por engano
  // — foi exatamente essa combinação (isAdmin=false escondendo o card) que
  // trancou o Matheus fora da administração em 2026-09-27.
  if (!isAdmin && !isSiteAdmin) return null;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" /> Permissões de outros usuários
        </CardTitle>
        {!compact && (
          <p className="text-sm text-muted-foreground">
            Dê ou revogue acesso por módulo. Criar usuário, senha e nome ficam em Usuários e Privilégios.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="max-h-[28rem] divide-y overflow-y-auto rounded-2xl border">
          {perfis.map((p: any) => {
            const role = roleDe(p.id);
            const aberto = detalhe === p.id;
            return (
              <div key={p.id} className="px-4 py-3 transition-colors hover:bg-muted/40">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(p.nome ?? "").trim().charAt(0).toUpperCase() || <Users className="size-4" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">CPF {maskCpf(p.cpf)}</p>
                  </div>
                  <Badge className="rounded-full text-xs font-medium" variant={role === "admin" ? "default" : "secondary"}>
                    {role === "admin" ? "Administrador" : "Comum"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
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
                    className="h-8 text-xs"
                    onClick={() => setDetalhe(aberto ? null : p.id)}
                  >
                    {aberto ? "Ocultar módulos" : "Editar por módulo"}
                  </Button>
                </div>
                {aberto && (
                  <div className="mt-3 overflow-x-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="p-1.5 text-left font-medium">Módulo</th>
                          <th className="p-1.5 font-medium">Ver</th>
                          <th className="p-1.5 font-medium">Editar</th>
                          <th className="p-1.5 font-medium">Excluir</th>
                          {CAMPOS_IMPORTACAO.map((c) => (
                            <th key={c.campo} className="p-1.5 font-medium">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MODULOS.map((m) => {
                          const row = permDe(p.id, m.key);
                          const ehImportar = m.key === "importar";
                          const atual = {
                            user_id: p.id,
                            modulo: m.key,
                            pode_ver: row?.pode_ver ?? true,
                            pode_editar: row?.pode_editar ?? true,
                            pode_excluir: row?.pode_excluir ?? false,
                            pode_importar_lancamentos: row?.pode_importar_lancamentos ?? true,
                            pode_importar_parcelamentos: row?.pode_importar_parcelamentos ?? true,
                            pode_importar_limite: row?.pode_importar_limite ?? true,
                          };
                          return (
                            <tr key={m.key} className="border-t">
                              <td className="p-1.5">{m.label}</td>
                              {(["pode_ver", "pode_editar", "pode_excluir"] as const).map(
                                (campo) => (
                                  <td key={campo} className="p-1.5 text-center">
                                    {campo !== "pode_ver" && ehImportar ? (
                                      <span className="text-muted-foreground" aria-label="Não se aplica">·</span>
                                    ) : (
                                      <Switch
                                        checked={atual[campo]}
                                        onCheckedChange={(v) =>
                                          salvarPermissao.mutate({ ...atual, [campo]: v })
                                        }
                                      />
                                    )}
                                  </td>
                                ),
                              )}
                              {CAMPOS_IMPORTACAO.map(({ campo }) => (
                                <td key={campo} className="p-1.5 text-center">
                                  {ehImportar ? (
                                    <Switch
                                      checked={atual[campo]}
                                      onCheckedChange={(v) =>
                                        salvarPermissao.mutate({ ...atual, [campo]: v })
                                      }
                                    />
                                  ) : (
                                    <span className="text-muted-foreground" aria-label="Não se aplica">·</span>
                                  )}
                                </td>
                              ))}
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
