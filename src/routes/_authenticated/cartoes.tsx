import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Gauge, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Field } from "@/routes/_authenticated/receitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBancos, useCartoes, useDespesas } from "@/hooks/useFinance";
import { usePermissoes, useProfile } from "@/hooks/useAuthData";
import { useCotacao } from "@/hooks/useCotacao";
import { formatBRL, toBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões e Bancos — Finanças do Casal" },
      {
        name: "description",
        content: "Cadastre cartões de crédito, contas bancárias e acompanhe a fatura de cada um.",
      },
      { property: "og:title", content: "Cartões e Bancos — Finanças do Casal" },
      {
        property: "og:description",
        content: "Gestão de cartões, limites, faturas e contas bancárias do casal.",
      },
    ],
  }),
  component: CartoesPage,
});

const cartaoSchema = z.object({
  apelido: z.string().trim().min(2, "Informe um apelido").max(60),
  bandeira: z.string().min(1, "Selecione a bandeira"),
  final: z.string().regex(/^\d{4}$/, "Informe os 4 últimos dígitos"),
  limite: z.number().nonnegative(),
  dia_fechamento: z.number().int().min(1).max(31),
  dia_vencimento: z.number().int().min(1).max(31),
  banco_id: z.string().uuid().nullable(),
  cor: z.string(),
  titular: z.string().min(1, "Informe o titular"),
  tipo: z.string().min(1),
});

const bancoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do banco").max(60),
  agencia: z.string().max(20).nullable(),
  conta: z.string().max(30).nullable(),
  tipo_conta: z.string().min(1),
  titular: z.string().min(1, "Informe o titular"),
});

const CORES = [
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#16a34a",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#ea580c",
  "#ef4444",
  "#db2777",
  "#a855f7",
  "#6366f1",
  "#334155",
  "#0f172a",
];

function CartoesPage() {
  const qc = useQueryClient();
  const cotacao = useCotacao();
  const { data: perfil } = useProfile();
  const { can } = usePermissoes();
  const { data: cartoes = [] } = useCartoes();
  const { data: bancos = [] } = useBancos();
  const { data: despesas = [] } = useDespesas();

  const [tab, setTab] = useState("cartoes");
  const [openCartao, setOpenCartao] = useState(false);
  const [openBanco, setOpenBanco] = useState(false);
  const [editCartaoId, setEditCartaoId] = useState<string | null>(null);
  const [editBancoId, setEditBancoId] = useState<string | null>(null);
  const cartaoVazio = {
    apelido: "",
    bandeira: "Visa",
    final: "",
    limite: "",
    dia_fechamento: "1",
    dia_vencimento: "10",
    banco_id: "",
    cor: CORES[0],
    titular: "",
  };
  const bancoVazio = { nome: "", agencia: "", conta: "", tipo: "corrente", titular: "" };
  const [fc, setFc] = useState<any>(cartaoVazio);
  const [fb, setFb] = useState<any>(bancoVazio);
  const perfilNome = perfil?.nome ?? "Casal";

  function novoCartao() {
    setEditCartaoId(null);
    setFc(cartaoVazio);
    setOpenCartao(true);
  }
  function editarCartao(c: any) {
    setEditCartaoId(c.id);
    setFc({
      apelido: c.apelido ?? "",
      bandeira: c.bandeira ?? "Visa",
      final: c.final ?? "",
      limite: c.limite != null ? String(c.limite) : "",
      dia_fechamento: String(c.dia_fechamento ?? 1),
      dia_vencimento: String(c.dia_vencimento ?? 10),
      banco_id: c.banco_id ?? "",
      cor: c.cor ?? CORES[0],
      titular: c.titular ?? "",
    });
    setOpenCartao(true);
  }
  function novoBanco() {
    setEditBancoId(null);
    setFb(bancoVazio);
    setOpenBanco(true);
  }
  function editarBanco(b: any) {
    setEditBancoId(b.id);
    setFb({
      nome: b.nome ?? "",
      agencia: b.agencia ?? "",
      conta: b.conta ?? "",
      tipo: b.tipo_conta ?? "corrente",
      titular: b.titular ?? "",
    });
    setOpenBanco(true);
  }

  const gastoDoCartao = (id: string) =>
    despesas
      .filter((d: any) => d.cartao_id === id)
      .reduce((s: number, d: any) => s + toBRL(Number(d.valor_total), d.moeda, cotacao), 0);

  const salvarCartao = useMutation({
    mutationFn: async () => {
      const parsed = cartaoSchema.parse({
        apelido: fc.apelido,
        bandeira: fc.bandeira,
        final: fc.final,
        limite: Number(String(fc.limite).replace(",", ".")) || 0,
        dia_fechamento: Number(fc.dia_fechamento),
        dia_vencimento: Number(fc.dia_vencimento),
        banco_id: fc.banco_id || null,
        cor: fc.cor,
        titular: fc.titular || perfilNome,
        tipo: "credito",
      });
      const { error } = editCartaoId
        ? await supabase.from("cartoes").update(parsed).eq("id", editCartaoId)
        : await supabase.from("cartoes").insert(parsed);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editCartaoId ? "Cartão atualizado" : "Cartão cadastrado");
      setOpenCartao(false);
      setEditCartaoId(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message),
  });

  const salvarBanco = useMutation({
    mutationFn: async () => {
      const parsed = bancoSchema.parse({
        nome: fb.nome,
        agencia: fb.agencia || null,
        conta: fb.conta || null,
        tipo_conta: fb.tipo,
        titular: fb.titular || perfilNome,
      });
      const { error } = editBancoId
        ? await supabase.from("bancos").update(parsed).eq("id", editBancoId)
        : await supabase.from("bancos").insert(parsed);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editBancoId ? "Banco atualizado" : "Banco cadastrado");
      setOpenBanco(false);
      setEditBancoId(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.errors?.[0]?.message ?? e.message),
  });

  const excluir = useMutation({
    mutationFn: async ({ table, id }: { table: "cartoes" | "bancos"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  type GrupoLimite = {
    banco: string;
    label: string;
    competencia: string | null;
    limite_total: number | null;
    utilizado: number;
    disponivel: number | null;
    comprometidoApp: number;
    historico: any[];
  };

  const limitesPorBanco: GrupoLimite[] = useMemo(() => {
    const porBanco = new Map<string, any[]>();
    for (const f of faturas as any[]) {
      if (f.limite_total == null && f.limite_utilizado == null && f.limite_disponivel == null)
        continue;
      const lista = porBanco.get(f.banco) ?? [];
      lista.push(f);
      porBanco.set(f.banco, lista);
    }
    const hoje = new Date().toISOString().slice(0, 10);
    return Array.from(porBanco, ([banco, lista]) => {
      const ordenadas = [...lista].sort((a, b) =>
        String(b.competencia ?? "").localeCompare(String(a.competencia ?? "")),
      );
      const atual = ordenadas[0];
      const total = atual.limite_total != null ? Number(atual.limite_total) : null;
      const disponivel = atual.limite_disponivel != null ? Number(atual.limite_disponivel) : null;
      const utilizado =
        atual.limite_utilizado != null
          ? Number(atual.limite_utilizado)
          : total != null && disponivel != null
            ? total - disponivel
            : 0;
      const comprometidoApp = (despesas as any[])
        .filter((d) => String(d.banco_nome ?? "").toLowerCase() === banco.toLowerCase())
        .flatMap((d) => (d.parcelas ?? []).map((p: any) => ({ ...p, despesa: d })))
        .filter((p: any) => !p.paga && p.vencimento >= hoje)
        .reduce((s: number, p: any) => s + toBRL(Number(p.valor), p.despesa.moeda, cotacao), 0);
      return {
        banco,
        label: BANCO_LABEL[banco as BancoFatura] ?? banco,
        competencia: atual.competencia ?? null,
        limite_total: total,
        utilizado,
        disponivel,
        comprometidoApp,
        historico: ordenadas.slice(0, 6),
      };
    }).sort((a, b) => (b.limite_total ?? 0) - (a.limite_total ?? 0));
  }, [faturas, despesas, cotacao]);


  return (
    <AppLayout
      title="Cartões e Bancos"
      description="Formas de pagamento usadas nas despesas"
      actions={
        can("cartoes", "editar") && (
          <Button size="sm" onClick={() => (tab === "cartoes" ? novoCartao() : novoBanco())}>
            <Plus className="size-4" /> {tab === "cartoes" ? "Novo cartão" : "Novo banco"}
          </Button>
        )
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="cartoes" className="flex-1 sm:flex-none">
            Cartões
          </TabsTrigger>
          <TabsTrigger value="bancos" className="flex-1 sm:flex-none">
            Bancos
          </TabsTrigger>
          <TabsTrigger value="limites" className="flex-1 sm:flex-none">
            Limites
          </TabsTrigger>
        </TabsList>


        <TabsContent value="cartoes" className="mt-4 grid gap-3 sm:grid-cols-2">
          {cartoes.length === 0 && (
            <Card className="sm:col-span-2">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CreditCard className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
              </CardContent>
            </Card>
          )}
          {cartoes.map((c: any) => {
            const usado = gastoDoCartao(c.id);
            const limite = Number(c.limite) || 0;
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: c.cor }} />
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{c.apelido}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.bandeira} •••• {c.final}
                        {c.bancos ? ` · ${c.bancos.nome}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      {can("cartoes", "editar") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => editarCartao(c)}
                          aria-label="Editar cartão"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {can("cartoes", "excluir") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => excluir.mutate({ table: "cartoes", id: c.id })}
                          aria-label="Excluir cartão"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-muted-foreground">Fecha dia</p>
                      <p className="font-semibold">{c.dia_fechamento}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-muted-foreground">Vence dia</p>
                      <p className="font-semibold">{c.dia_vencimento}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Comprometido</span>
                      <span className="font-semibold">
                        {formatBRL(usado)} / {formatBRL(limite)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${limite ? Math.min(100, (usado / limite) * 100) : 0}%`,
                          backgroundColor: c.cor,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="bancos" className="mt-4 space-y-2">
          {bancos.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Building2 className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum banco cadastrado.</p>
              </CardContent>
            </Card>
          )}
          {bancos.map((b: any) => (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{b.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.agencia ? `Ag. ${b.agencia} · ` : ""}
                    {b.conta ? `Conta ${b.conta}` : "Sem conta informada"}
                  </p>
                </div>
                <Badge variant="secondary">{b.tipo_conta}</Badge>
                {can("cartoes", "editar") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-primary"
                    onClick={() => editarBanco(b)}
                    aria-label="Editar banco"
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                {can("cartoes", "excluir") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => excluir.mutate({ table: "bancos", id: b.id })}
                    aria-label="Excluir banco"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="limites" className="mt-4 space-y-3">
          {limitesPorBanco.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Gauge className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum limite capturado ainda. Importe uma fatura em "Importar Faturas" para ver
                  esta análise.
                </p>
              </CardContent>
            </Card>
          ) : (
            limitesPorBanco.map((g) => {
              const uso = g.limite_total ? Math.min(100, (g.utilizado / g.limite_total) * 100) : 0;
              return (
                <Card key={g.banco}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{g.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Última fatura: {g.competencia ?? "—"}
                        </p>
                      </div>
                      <Badge variant={uso > 80 ? "destructive" : "secondary"}>
                        {uso.toFixed(0)}% do limite usado
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "Limite total", valor: g.limite_total, cor: "text-foreground" },
                        { label: "Utilizado", valor: g.utilizado, cor: "text-destructive" },
                        { label: "Disponível", valor: g.disponivel, cor: "text-success" },
                        {
                          label: "Parcelas futuras no app",
                          valor: g.comprometidoApp,
                          cor: "text-warning",
                        },
                      ].map((k) => (
                        <div key={k.label} className="rounded-lg border bg-muted/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {k.label}
                          </p>
                          <p className={`text-sm font-bold tabular-nums ${k.cor}`}>
                            {k.valor != null ? formatBRL(k.valor) : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${uso}%` }}
                      />
                    </div>
                    {g.historico.length > 1 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {g.historico.map((h) => (
                          <span
                            key={h.competencia}
                            className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            {h.competencia}: {formatBRL(Number(h.limite_utilizado ?? 0))} usados
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>



      <Dialog open={openCartao} onOpenChange={setOpenCartao}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCartaoId ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Apelido" className="sm:col-span-2">
              <Input value={fc.apelido} onChange={(e) => setFc({ ...fc, apelido: e.target.value })} />
            </Field>
            <Field label="Bandeira">
              <Select value={fc.bandeira} onValueChange={(v) => setFc({ ...fc, bandeira: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Visa", "Mastercard", "Elo", "American Express", "Hipercard"].map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="4 últimos dígitos">
              <Input
                inputMode="numeric"
                maxLength={4}
                value={fc.final}
                onChange={(e) => setFc({ ...fc, final: e.target.value.replace(/\D/g, "") })}
              />
            </Field>
            <Field label="Limite">
              <Input
                inputMode="decimal"
                value={fc.limite}
                onChange={(e) => setFc({ ...fc, limite: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Banco emissor">
              <Select value={fc.banco_id} onValueChange={(v) => setFc({ ...fc, banco_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {bancos.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Dia de fechamento">
              <Input
                type="number"
                min={1}
                max={31}
                value={fc.dia_fechamento}
                onChange={(e) => setFc({ ...fc, dia_fechamento: e.target.value })}
              />
            </Field>
            <Field label="Dia de vencimento">
              <Input
                type="number"
                min={1}
                max={31}
                value={fc.dia_vencimento}
                onChange={(e) => setFc({ ...fc, dia_vencimento: e.target.value })}
              />
            </Field>
            <Field label="Titular">
              <Input value={fc.titular} onChange={(e) => setFc({ ...fc, titular: e.target.value })} placeholder={perfilNome} />
            </Field>
            <Field label="Cor" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {CORES.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => setFc({ ...fc, cor })}
                    aria-label={`Cor ${cor}`}
                    className={`size-8 rounded-full border-2 transition-transform ${
                      fc.cor === cor ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => salvarCartao.mutate()} disabled={salvarCartao.isPending}>
              {editCartaoId ? "Salvar alterações" : "Salvar cartão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openBanco} onOpenChange={setOpenBanco}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editBancoId ? "Editar banco" : "Novo banco"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Nome do banco">
              <Input value={fb.nome} onChange={(e) => setFb({ ...fb, nome: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Agência">
                <Input value={fb.agencia} onChange={(e) => setFb({ ...fb, agencia: e.target.value })} />
              </Field>
              <Field label="Conta">
                <Input value={fb.conta} onChange={(e) => setFb({ ...fb, conta: e.target.value })} />
              </Field>
            </div>
            <Field label="Titular">
              <Input value={fb.titular} onChange={(e) => setFb({ ...fb, titular: e.target.value })} placeholder={perfilNome} />
            </Field>
            <Field label="Tipo de conta">
              <Select value={fb.tipo} onValueChange={(v) => setFb({ ...fb, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="pagamento">Conta de pagamento</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => salvarBanco.mutate()} disabled={salvarBanco.isPending}>
              {editBancoId ? "Salvar alterações" : "Salvar banco"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
