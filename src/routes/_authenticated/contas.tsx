import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  ArrowRight,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { IconeConta } from "@/components/IconeConta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ContaBancaria,
  type TipoConta,
  TIPOS_CONTA,
  rotuloTipoConta,
  useArquivarConta,
  useContas,
  useContasComSaldo,
  useCriarConta,
  useCriarTransferencia,
  useEditarConta,
  useExcluirTransferencia,
} from "@/hooks/useContas";
import { useBancos, useDespesas, useReceitas } from "@/hooks/useFinance";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { formatDate, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LogoBanco } from "@/components/LogoBanco";
import { nomeBanco } from "@/lib/bancos-catalogo";

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => ({ meta: [{ title: "Cartões e contas | Control ALL" }] }),
  // 07/11/2026: Contas virou aba de "Cartões e contas".
  beforeLoad: () => {
    throw redirect({ to: "/cartoes", search: { tab: "contas" } });
  },
});

const SEM_BANCO = "__sem_banco__";

function lerValor(texto: string): number {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (!limpo) return 0;
  const n = limpo.includes(",")
    ? Number(limpo.replace(/\./g, "").replace(",", "."))
    : Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
const valorParaTexto = (v: number) => (v ? String(v).replace(".", ",") : "");

/**
 * Contas (07/11/2026): bancos e carteira com saldo de cada um. O saldo parte do saldo inicial
 * informado e soma receitas e despesas pagas lançadas na conta (cartão fica de fora, sai pela fatura)
 * mais as transferências entre contas.
 */
export function ContasConteudo({ embutido = false }: { embutido?: boolean }) {
  const { formatar } = usePrivacidadeValores("contas");
  const { data: receitas = [] } = useReceitas();
  const { data: despesas = [] } = useDespesas();
  const { todas: todasContas } = useContas({ incluirArquivadas: true });
  const { linhas, total, transferencias, isLoading, tabelaPendente, erro } = useContasComSaldo(
    receitas,
    despesas,
  );
  const arquivar = useArquivarConta();
  const excluirTransf = useExcluirTransferencia();

  const [editando, setEditando] = useState<ContaBancaria | "nova" | null>(null);
  const [transferindo, setTransferindo] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false);

  const arquivadas = todasContas.filter((c) => c.arquivada);
  const nomeConta = (id: string) => todasContas.find((c) => c.id === id)?.nome ?? "Conta removida";
  const recentes = transferencias.slice(0, 15);

  const acoes = (
        !tabelaPendente && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
              disabled={linhas.length < 2}
              title={
                linhas.length < 2 ? "Cadastre ao menos duas contas para transferir" : undefined
              }
              onClick={() => setTransferindo(true)}
            >
              <ArrowLeftRight className="size-4" /> Transferir
            </Button>
            <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setEditando("nova")}>
              <Plus className="size-4" /> Nova conta
            </Button>
          </div>
        )
  );
  const corpo = (
    <>
      {tabelaPendente ? (
        <Card className="rounded-3xl">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <Landmark className="size-6" aria-hidden="true" />
            </span>
            <p className="text-lg font-semibold">Quase pronto</p>
            <p className="max-w-md text-sm text-muted-foreground">
              As contas ainda não foram ativadas no banco de dados. Rode a migration{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                20261107100000_contas_bancarias.sql
              </code>{" "}
              (com backup) e recarregue a página.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardContent className="p-6 sm:p-8">
              <p className="text-sm text-muted-foreground">Total em todas as contas</p>
              <p
                className={cn(
                  "mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl",
                  total < 0 && "text-destructive",
                )}
              >
                {formatar(total)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {linhas.length === 0
                  ? "Nenhuma conta cadastrada ainda"
                  : `${linhas.length} ${linhas.length === 1 ? "conta ativa" : "contas ativas"}`}
              </p>
            </CardContent>
          </Card>

          {erro && (
            <p className="text-sm text-destructive">
              Não foi possível carregar as contas: {erro.message}
            </p>
          )}
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {!isLoading && linhas.length === 0 && (
            <Card className="rounded-3xl">
              <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <Wallet className="size-6" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">Saiba quanto tem em cada lugar</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Cadastre sua conta corrente, poupança ou o dinheiro da carteira com o saldo de
                    hoje. O Control ALL acompanha o resto.
                  </p>
                </div>
                <Button className="gap-1.5 rounded-full" onClick={() => setEditando("nova")}>
                  <Plus className="size-4" /> Cadastrar primeira conta
                </Button>
              </CardContent>
            </Card>
          )}

          {linhas.length > 0 && (
            <Card className="overflow-hidden rounded-3xl">
              <ul className="divide-y">
                {linhas.map(({ conta, saldo, ultima }) => (
                  <li key={conta.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                    <IconeConta conta={conta} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{conta.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {rotuloTipoConta(conta.tipo)}
                        {conta.bancos?.nome && conta.tipo !== "carteira"
                          ? ` · ${conta.bancos.nome}`
                          : ""}
                        {" · "}
                        {ultima
                          ? `Última movimentação em ${formatDate(ultima)}`
                          : "Sem movimentação"}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-right font-semibold tabular-nums",
                        saldo < 0 ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {formatar(saldo)}
                    </p>
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar conta"
                        onClick={() => setEditando(conta)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Arquivar conta"
                        className="text-muted-foreground"
                        disabled={arquivar.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Arquivar "${conta.nome}"? Ela sai da lista, mas o histórico fica guardado.`,
                            )
                          )
                            arquivar.mutate({ id: conta.id });
                        }}
                      >
                        <Archive className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {arquivadas.length > 0 && (
            <div>
              <button
                type="button"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setVerArquivadas((v) => !v)}
              >
                {verArquivadas ? "Ocultar arquivadas" : `Ver arquivadas (${arquivadas.length})`}
              </button>
              {verArquivadas && (
                <Card className="mt-3 overflow-hidden rounded-3xl">
                  <ul className="divide-y">
                    {arquivadas.map((conta) => (
                      <li
                        key={conta.id}
                        className="flex items-center gap-4 px-5 py-3 opacity-75 sm:px-6"
                      >
                        <IconeConta conta={conta} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{conta.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {rotuloTipoConta(conta.tipo)} · arquivada
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 rounded-full"
                          disabled={arquivar.isPending}
                          onClick={() => arquivar.mutate({ id: conta.id, arquivada: false })}
                        >
                          <ArchiveRestore className="size-4" /> Reativar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {linhas.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Transferências recentes</h2>
                {linhas.length >= 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={() => setTransferindo(true)}
                  >
                    <ArrowLeftRight className="size-4" /> Nova
                  </Button>
                )}
              </div>
              {recentes.length === 0 ? (
                <Card className="rounded-3xl">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    {linhas.length >= 2
                      ? "Nenhuma transferência ainda. Use Transferir para mover dinheiro entre suas contas."
                      : "Com duas contas cadastradas você pode transferir entre elas."}
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden rounded-3xl">
                  <ul className="divide-y">
                    {recentes.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                          <ArrowLeftRight className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                            <span className="truncate">{nomeConta(t.conta_origem_id)}</span>
                            <ArrowRight
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="truncate">{nomeConta(t.conta_destino_id)}</span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(t.data)}
                            {t.descricao ? ` · ${t.descricao}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">{formatar(t.valor)}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir transferência"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={excluirTransf.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Excluir esta transferência? Os saldos voltam ao que eram.",
                              )
                            )
                              excluirTransf.mutate(t.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          )}
        </div>
      )}

      {editando && (
        <FormConta
          conta={editando === "nova" ? null : editando}
          onFechar={() => setEditando(null)}
        />
      )}
      {transferindo && (
        <FormTransferencia
          contas={linhas.map((l) => l.conta)}
          onFechar={() => setTransferindo(false)}
        />
      )}
    </>
  );
  return embutido ? (
    <div className="space-y-4">
      {!tabelaPendente && <div className="flex justify-end">{acoes}</div>}
      {corpo}
    </div>
  ) : (
    <AppLayout
      title="Contas"
      description="Bancos e carteira, com saldo de cada um"
      actions={acoes}
    >
      {corpo}
    </AppLayout>
  );
}

function FormConta({ conta, onFechar }: { conta: ContaBancaria | null; onFechar: () => void }) {
  const { data: bancos = [] } = useBancos();
  const criar = useCriarConta();
  const editar = useEditarConta();
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? "corrente");
  const [bancoId, setBancoId] = useState<string>(conta?.banco_id ?? SEM_BANCO);
  const [saldo, setSaldo] = useState(conta ? valorParaTexto(conta.saldo_inicial) : "");
  const [dataSaldo, setDataSaldo] = useState(
    conta?.data_saldo_inicial?.slice(0, 10) ?? toISODate(new Date()),
  );
  const salvando = criar.isPending || editar.isPending;

  const valorSaldo = lerValor(saldo);
  const valido = nome.trim().length > 0 && Number.isFinite(valorSaldo) && !!dataSaldo;

  const salvar = () => {
    if (!valido) return;
    const dados = {
      nome,
      tipo,
      banco_id: tipo === "carteira" || bancoId === SEM_BANCO ? null : bancoId,
      saldo_inicial: valorSaldo,
      data_saldo_inicial: dataSaldo,
    };
    if (conta) editar.mutate({ id: conta.id, ...dados }, { onSuccess: onFechar });
    else criar.mutate(dados, { onSuccess: onFechar });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{conta ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            Informe o saldo de um dia que você sabe. Dali em diante o saldo é calculado.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="conta-nome">Nome</Label>
            <Input
              id="conta-nome"
              autoFocus
              placeholder="Ex.: Nubank, Carteira"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConta)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CONTA.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Banco (opcional)</Label>
              <Select value={bancoId} onValueChange={setBancoId} disabled={tipo === "carteira"}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem banco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_BANCO}>Sem banco</SelectItem>
                  {bancos.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-2">
                        <LogoBanco nome={b.nome} className="size-5" />
                        {nomeBanco(b.nome)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="conta-saldo">Saldo inicial</Label>
              <Input
                id="conta-saldo"
                inputMode="decimal"
                placeholder="0,00"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-data">Data do saldo</Label>
              <Input
                id="conta-data"
                type="date"
                value={dataSaldo}
                onChange={(e) => setDataSaldo(e.target.value)}
              />
            </div>
          </div>
          {!Number.isFinite(valorSaldo) && (
            <p className="text-xs text-destructive">Valor inválido.</p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full" disabled={!valido || salvando}>
              {salvando ? "Salvando…" : conta ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormTransferencia({
  contas,
  onFechar,
}: {
  contas: ContaBancaria[];
  onFechar: () => void;
}) {
  const criar = useCriarTransferencia();
  const [origem, setOrigem] = useState(contas[0]?.id ?? "");
  const [destino, setDestino] = useState(contas[1]?.id ?? "");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(toISODate(new Date()));
  const [descricao, setDescricao] = useState("");

  const v = lerValor(valor);
  const iguais = !!origem && origem === destino;
  const valido = !!origem && !!destino && !iguais && Number.isFinite(v) && v > 0 && !!data;
  const destinos = useMemo(() => contas.filter((c) => c.id !== origem), [contas, origem]);

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir entre contas</DialogTitle>
          <DialogDescription>
            Não conta como receita nem despesa, só move o saldo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido)
              criar.mutate(
                { conta_origem_id: origem, conta_destino_id: destino, valor: v, data, descricao },
                { onSuccess: onFechar },
              );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>De</Label>
              <Select
                value={origem}
                onValueChange={(id) => {
                  setOrigem(id);
                  if (id === destino) setDestino(contas.find((c) => c.id !== id)?.id ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Para</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {destinos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="transf-valor">Valor</Label>
              <Input
                id="transf-valor"
                autoFocus
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transf-data">Data</Label>
              <Input
                id="transf-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transf-desc">Descrição (opcional)</Label>
            <Input
              id="transf-desc"
              placeholder="Ex.: Reserva do mês"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={120}
            />
          </div>
          {iguais && <p className="text-xs text-destructive">Escolha contas diferentes.</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full" disabled={!valido || criar.isPending}>
              {criar.isPending ? "Salvando…" : "Transferir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
