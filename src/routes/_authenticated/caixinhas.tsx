import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  type LucideIcon,
  Baby,
  Bike,
  Briefcase,
  Car,
  Check,
  Gem,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PawPrint,
  Pencil,
  PiggyBank,
  Plane,
  Plus,
  ShieldCheck,
  Smartphone,
  Sofa,
  Trash2,
  TreePalm,
  ImagePlus,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePrivacidadeValores } from "@/hooks/usePrivacidadeValores";
import { formatBRL, monthLabelLong, competenciaAtual } from "@/lib/format";
import { useCompetenciaVigente } from "@/lib/periodo-vigente";
import { TEMAS_CAIXINHA, sugerirTema, temaPorId, urlImagemTema } from "@/lib/caixinhas-temas";
import {
  type Caixinha,
  aportadoNoMes,
  apagarFotoCaixinha,
  enviarFotoCaixinha,
  excluirCaixinha,
  linhaDoTempo,
  listarCaixinhasComMetas,
  mesesEntre,
  metaDoMes,
  progressoMeta,
  registrarAporte,
  salvarCaixinha,
  totalGuardado,
} from "@/lib/poupar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/caixinhas")({
  head: () => ({ meta: [{ title: "Caixinhas e metas | Control ALL" }] }),
  component: CaixinhasPage,
});

/** Ícones das metas (07/11/2026): o nome fica em caixinhas.imagem. Valor fora da lista é tratado como emoji. */
const ICONES_CAIXINHA: { id: string; rotulo: string; icon: LucideIcon }[] = [
  { id: "piggy-bank", rotulo: "Geral", icon: PiggyBank },
  { id: "plane", rotulo: "Viagem", icon: Plane },
  { id: "tree-palm", rotulo: "Férias", icon: TreePalm },
  { id: "house", rotulo: "Casa", icon: House },
  { id: "sofa", rotulo: "Móveis", icon: Sofa },
  { id: "car", rotulo: "Carro", icon: Car },
  { id: "bike", rotulo: "Bicicleta", icon: Bike },
  { id: "graduation-cap", rotulo: "Estudo", icon: GraduationCap },
  { id: "shield-check", rotulo: "Reserva", icon: ShieldCheck },
  { id: "gift", rotulo: "Presente", icon: Gift },
  { id: "heart-pulse", rotulo: "Saúde", icon: HeartPulse },
  { id: "paw-print", rotulo: "Pet", icon: PawPrint },
  { id: "baby", rotulo: "Filhos", icon: Baby },
  { id: "gem", rotulo: "Casamento", icon: Gem },
  { id: "smartphone", rotulo: "Eletrônicos", icon: Smartphone },
  { id: "briefcase", rotulo: "Negócio", icon: Briefcase },
];

const CORES_CAIXINHA = ["#1670B8", "#0EA5E9", "#14B8A6", "#1C985A", "#84CC16", "#E08A00", "#EA580C", "#DB2B33", "#D6477E", "#8E5CD9", "#6366F1", "#64748B"];
const COR_PADRAO = "#1670B8";

/** "2027-03" vira "03/27". */
const mmaa = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(2, 4)}`;
const paraNumero = (t: string) => Number(t.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || 0;
const paraTexto = (v: number | null | undefined) => (v != null && v > 0 ? String(v).replace(".", ",") : "");

function IconeCaixinha({
  imagem,
  cor,
  className,
}: {
  imagem?: string | null | undefined;
  cor?: string | null | undefined;
  className?: string | undefined;
}) {
  const item = ICONES_CAIXINHA.find((i) => i.id === imagem);
  const Icone = item?.icon ?? PiggyBank;
  const emoji = imagem && !item ? imagem : null;
  return (
    <span
      className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-white", className)}
      style={{ backgroundColor: cor || COR_PADRAO }}
      aria-hidden="true"
    >
      {emoji ? <span className="text-xl leading-none">{emoji}</span> : <Icone className="size-5" />}
    </span>
  );
}

/**
 * Imagem da caixinha (07/11/2026): foto do usuário, senão a foto do tema (Unsplash). Se a imagem não
 * carregar, mostra gradiente + ícone do tema. Filhos ficam por cima (progresso, ações).
 */
function ImagemCaixinha({
  temaId,
  fotoUrl,
  className,
  children,
}: {
  temaId?: string | null | undefined;
  fotoUrl?: string | null | undefined;
  className?: string | undefined;
  children?: React.ReactNode;
}) {
  const tema = temaPorId(temaId);
  const [falhou, setFalhou] = useState(false);
  const src = fotoUrl || urlImagemTema(tema);
  useEffect(() => setFalhou(false), [src]);
  const Icone = ICONES_CAIXINHA.find((i) => i.id === tema.icone)?.icon ?? PiggyBank;
  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${tema.cor1}, ${tema.cor2})` }}
    >
      {falhou ? (
        <Icone className="absolute right-4 top-4 size-16 text-white/30" aria-hidden="true" />
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 -z-10 size-full object-cover"
          onError={() => setFalhou(true)}
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
      {children}
    </div>
  );
}

/**
 * Caixinhas e metas (27/10/2026, metas em 07/11/2026): objetivo com valor por mês e aporte marcado mês a
 * mês, agora com valor alvo, prazo, ícone e cor opcionais. O valor a guardar no mês entra na Previsão do
 * mês (Início) do site e do app. Sem a migration 20261107130000, os campos de meta ficam escondidos.
 */
function CaixinhasPage() {
  const qc = useQueryClient();
  const mes = useCompetenciaVigente();
  const { formatar } = usePrivacidadeValores("caixinhas");
  const { data, isLoading } = useQuery({ queryKey: ["caixinhas", "metas"], queryFn: listarCaixinhasComMetas });
  const caixinhas = data?.lista ?? [];
  const metasPendentes = data?.metasPendentes ?? false;
  const imagemPendente = data?.imagemPendente ?? false;
  const [editando, setEditando] = useState<Caixinha | "nova" | null>(null);

  const aporte = useMutation({
    mutationFn: ({ c, m, valor }: { c: Caixinha; m: string; valor: number | null }) => registrarAporte(c.id, m, valor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caixinhas"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar."),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirCaixinha(id),
    onSuccess: () => {
      toast.success("Caixinha excluída.");
      qc.invalidateQueries({ queryKey: ["caixinhas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });

  const meta = metaDoMes(caixinhas, mes);
  const aportado = aportadoNoMes(caixinhas, mes);

  return (
    <AppLayout
      title="Caixinhas e metas"
      description="Objetivos com valor, prazo e quanto guardar todo mês"
      actions={
        <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setEditando("nova")}>
          <Plus className="size-4" /> Nova meta
        </Button>
      }
    >
      <Card className="mb-6 rounded-3xl">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">A guardar em {monthLabelLong(mes)}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatar(meta)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Já guardado neste mês</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-success">{formatar(aportado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total guardado em todas</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatar(caixinhas.reduce((s, c) => s + totalGuardado(c), 0))}</p>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            O valor a guardar entra na Previsão do mês.
            {metasPendentes && " Valor alvo, prazo, ícone e cor ficam disponíveis após a atualização do banco."}
          </p>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && caixinhas.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <PiggyBank className="size-6" aria-hidden="true" />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">
              Crie uma meta (viagem, reserva, carro novo) e veja quanto falta e quanto guardar por mês.
            </p>
            <Button className="rounded-full" onClick={() => setEditando("nova")}>
              <Plus className="size-4" /> Criar meta
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {caixinhas.map((c) => {
          const meses = linhaDoTempo(c, competenciaAtual());
          const total = totalGuardado(c);
          const prog = progressoMeta(c, competenciaAtual());
          const prazo = c.dataAlvo ?? c.fim ?? null;
          const doMes = c.aportes[mes] ?? 0;
                    return (
            <Card key={c.id} className="overflow-hidden rounded-3xl">
              <ImagemCaixinha temaId={c.tema ?? sugerirTema(c.nome)} fotoUrl={c.fotoUrl} className="min-h-44 text-white">
                <div className="flex min-h-44 flex-col justify-between p-5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold drop-shadow">{c.nome}</p>
                      <p className="text-xs text-white/85">
                        {formatar(c.valorMensal)} por mês · desde {mmaa(c.inicio)}
                        {c.fim ? ` até ${mmaa(c.fim)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/20 hover:text-white" aria-label="Editar" onClick={() => setEditando(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        className="rounded-full text-white hover:bg-white/20 hover:text-white"
                        onClick={() => {
                          if (window.confirm(`Excluir a caixinha "${c.nome}" e os aportes marcados?`)) excluir.mutate(c.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs tabular-nums">
                      <span>
                        Guardado <b>{formatar(total)}</b>
                        {prog && <span className="text-white/80"> de {formatar(prog.alvo)}</span>}
                      </span>
                      {prog && <span className="font-semibold">{Math.round(prog.percentual)}%</span>}
                    </div>
                    {prog && (
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/30" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog.percentual)}>
                        <div className="h-full rounded-full bg-white transition-all" style={{ width: `${prog.percentual}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </ImagemCaixinha>
              <CardContent className="space-y-4 p-5">
                {prog && (
                  <p className="text-xs text-muted-foreground">
                    {prog.concluida ? (
                      <span className="font-medium text-success">Meta atingida. Parabéns!</span>
                    ) : prog.atrasada ? (
                      <>Prazo encerrado em {mmaa(prazo!)}. Faltam <b className="text-foreground">{formatar(prog.falta)}</b>.</>
                    ) : prazo ? (
                      <>
                        Faltam <b className="text-foreground">{formatar(prog.falta)}</b> até {mmaa(prazo)}
                        {prog.porMesNecessario != null && (
                          <>
                            {" "}· guarde <b className="text-foreground">{formatar(prog.porMesNecessario)}</b> por mês para chegar no prazo
                            {prog.porMesNecessario > c.valorMensal + 0.005 && (
                              <span className="text-warning-foreground dark:text-warning"> (acima dos {formatar(c.valorMensal)} planejados)</span>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>Faltam <b className="text-foreground">{formatar(prog.falta)}</b> · sem prazo definido</>
                    )}
                  </p>
                )}

                <Button
                  size="sm"
                  variant={doMes >= c.valorMensal - 0.005 ? "secondary" : "default"}
                  className="w-full gap-1.5 rounded-full"
                  disabled={aporte.isPending || mes < c.inicio || (!!c.fim && mes > c.fim)}
                  onClick={() => aporte.mutate({ c, m: mes, valor: doMes > 0 ? null : c.valorMensal })}
                >
                  <Check className="size-4" />
                  {doMes > 0 ? `Guardado em ${monthLabelLong(mes)} · desmarcar` : `Guardar ${formatar(c.valorMensal)} em ${monthLabelLong(mes)}`}
                </Button>
                <div className="flex flex-wrap gap-1.5">
                  {meses.slice(-12).map((m) => (
                    <button
                      key={m.mes}
                      type="button"
                      title={`${monthLabelLong(m.mes)}: ${formatar(m.aportado)} de ${formatar(m.meta)}`}
                      disabled={m.situacao === "futuro" || aporte.isPending}
                      onClick={() => aporte.mutate({ c, m: m.mes, valor: m.aportado > 0 ? null : c.valorMensal })}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                        m.situacao === "atingiu" && "bg-success/15 text-success",
                        m.situacao === "faltou" && "bg-destructive/15 text-destructive",
                        m.situacao === "aberto" && "bg-warning/15 text-warning-foreground dark:text-warning",
                        m.situacao === "futuro" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {monthLabelLong(m.mes).slice(0, 3)}/{m.mes.slice(2, 4)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editando && (
        <FormCaixinha
          caixinha={editando === "nova" ? null : editando}
          metasPendentes={metasPendentes}
          imagemPendente={imagemPendente}
          onFechar={() => setEditando(null)}
        />
      )}
    </AppLayout>
  );
}

function FormCaixinha({
  caixinha,
  metasPendentes,
  imagemPendente,
  onFechar,
}: {
  caixinha: Caixinha | null;
  metasPendentes: boolean;
  imagemPendente: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(caixinha?.nome ?? "");
  const [valor, setValor] = useState(caixinha ? paraTexto(caixinha.valorMensal) : "");
  const [inicio, setInicio] = useState(caixinha?.inicio ?? competenciaAtual());
  const [fim, setFim] = useState(caixinha?.fim ?? "");
  const [alvo, setAlvo] = useState(paraTexto(caixinha?.valorAlvo));
  const [dataAlvo, setDataAlvo] = useState(caixinha?.dataAlvo ?? "");
  const [imagem, setImagem] = useState(caixinha?.imagem ?? "piggy-bank");
  const [cor, setCor] = useState(caixinha?.cor ?? COR_PADRAO);
  // Imagem: tema (foto padrão) ou foto do usuário (arquivo novo ou já salvo).
  const [tema, setTema] = useState(caixinha?.tema ?? sugerirTema(caixinha?.nome ?? "") ?? "outro");
  const [temaManual, setTemaManual] = useState(!!caixinha?.tema);
  const [fotoPath, setFotoPath] = useState<string | null>(caixinha?.fotoPath ?? null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(caixinha?.fotoUrl ?? null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (fotoUrl?.startsWith("blob:")) URL.revokeObjectURL(fotoUrl);
  }, [fotoUrl]);

  function mudarNome(v: string) {
    setNome(v);
    if (!temaManual) setTema(sugerirTema(v) ?? "outro");
  }
  function escolherFoto(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast.error("Use uma imagem JPG, PNG ou WebP."); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("A foto passa de 5 MB. Escolha uma menor."); return; }
    setArquivo(f);
    setFotoUrl(URL.createObjectURL(f));
  }
  function voltarParaTema() {
    setArquivo(null);
    setFotoPath(null);
    setFotoUrl(null);
  }

  // Sugestão de quanto guardar por mês para chegar no alvo dentro do prazo.
  const alvoNum = paraNumero(alvo);
  const jaGuardado = caixinha ? totalGuardado(caixinha) : 0;
  const hoje = competenciaAtual();
  const desde = inicio > hoje ? inicio : hoje;
  const mesesAteAlvo = dataAlvo ? mesesEntre(desde, dataAlvo) : 0;
  const sugestao =
    !metasPendentes && alvoNum > jaGuardado && mesesAteAlvo > 0
      ? Math.ceil(((alvoNum - jaGuardado) / mesesAteAlvo) * 100) / 100
      : null;

  const salvar = useMutation({
    mutationFn: async () => {
      let novoPath = fotoPath;
      if (!imagemPendente && arquivo) novoPath = await enviarFotoCaixinha(arquivo);
      await salvarCaixinha(
        {
          nome,
          valorMensal: paraNumero(valor),
          inicio,
          fim: fim || null,
          ...(metasPendentes
            ? {}
            : { valorAlvo: alvoNum > 0 ? alvoNum : null, dataAlvo: dataAlvo || null, imagem: imagem || null, cor: cor || null }),
          ...(imagemPendente ? {} : { tema, fotoPath: novoPath }),
        },
        caixinha?.id,
      );
      if (!imagemPendente && caixinha?.fotoPath && caixinha.fotoPath !== novoPath) await apagarFotoCaixinha(caixinha.fotoPath);
    },
    onSuccess: () => {
      toast.success("Meta salva.");
      qc.invalidateQueries({ queryKey: ["caixinhas"] });
      onFechar();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{caixinha ? "Editar meta" : "Nova meta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            {!metasPendentes && <IconeCaixinha imagem={imagem} cor={cor} />}
            <div className="flex-1 space-y-1">
              <Label htmlFor="caixinha-nome">Objetivo</Label>
              <Input id="caixinha-nome" value={nome} onChange={(e) => mudarNome(e.target.value)} placeholder="Ex.: Viagem, reserva de emergência" />
            </div>
          </div>

          {!imagemPendente && (
            <div className="space-y-2">
              <ImagemCaixinha temaId={tema} fotoUrl={fotoUrl} className="h-32 rounded-2xl" />
              <div className="flex flex-wrap gap-1.5">
                {TEMAS_CAIXINHA.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={tema === t.id}
                    onClick={() => {
                      setTema(t.id);
                      setTemaManual(true);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      tema === t.id ? "border-transparent bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {t.rotulo}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={inputFoto} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
                <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-full" onClick={() => inputFoto.current?.click()}>
                  <ImagePlus className="size-4" /> Usar minha foto
                </Button>
                {fotoUrl && (
                  <Button type="button" size="sm" variant="ghost" className="gap-1.5 rounded-full" onClick={voltarParaTema}>
                    <Undo2 className="size-4" /> Voltar para a imagem do tema
                  </Button>
                )}
              </div>
            </div>
          )}

          {!metasPendentes && (
            <>
              <div className="space-y-1.5">
                <Label>Ícone</Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {ICONES_CAIXINHA.map((i) => {
                    const Icone = i.icon;
                    const ativo = imagem === i.id;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        title={i.rotulo}
                        aria-label={i.rotulo}
                        aria-pressed={ativo}
                        onClick={() => setImagem(i.id)}
                        className={cn(
                          "grid aspect-square place-items-center rounded-xl border transition-colors",
                          ativo ? "border-transparent text-white" : "bg-muted/40 text-muted-foreground hover:bg-accent",
                        )}
                        style={ativo ? { backgroundColor: cor } : undefined}
                      >
                        <Icone className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {CORES_CAIXINHA.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      aria-pressed={cor === c}
                      onClick={() => setCor(c)}
                      className={cn(
                        "size-7 rounded-full border-2 transition-transform",
                        cor === c ? "scale-110 border-foreground" : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="caixinha-alvo">Valor da meta (opcional)</Label>
                  <Input id="caixinha-alvo" inputMode="decimal" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="10.000,00" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="caixinha-prazo">Prazo (opcional)</Label>
                  <Input id="caixinha-prazo" type="month" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="caixinha-valor">Valor por mês (R$)</Label>
            <Input id="caixinha-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="500,00" />
            {sugestao != null && (
              <p className="text-xs text-muted-foreground">
                Para chegar em {formatBRL(alvoNum)} até {mmaa(dataAlvo)}, guarde {formatBRL(sugestao)} por mês.{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setValor(paraTexto(sugestao))}>
                  Usar este valor
                </button>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="caixinha-inicio">Começa em</Label>
              <Input id="caixinha-inicio" type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caixinha-fim">Para de guardar em (opcional)</Label>
              <Input id="caixinha-fim" type="month" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={onFechar}>Cancelar</Button>
          <Button className="rounded-full" onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
