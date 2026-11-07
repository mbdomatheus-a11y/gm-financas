import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Compass, FileUp, PencilLine, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { IconeBanco, useCatalogoLogos } from "@/components/IconeBanco";
import { CelularPrevisao } from "@/components/landing/VitrineDispositivos";
import { useAvisoConta } from "@/components/boas-vindas/useAvisoConta";
import { useProfile, useSession } from "@/hooks/useAuthData";
import { useBancos } from "@/hooks/useFinance";
import { useContas, useCriarConta } from "@/hooks/useContas";
import { supabase } from "@/integrations/supabase/client";
import { chaveBanco } from "@/lib/bancos-logos";
import { cartaoSchema, melhorDiaCompra, salvarCartao } from "@/lib/cartao-salvar";
import { toISODate } from "@/lib/format";
import { z } from "zod";

/**
 * Boas-vindas pós-cadastro (07/11/2026): tela cheia, uma única vez para conta nova.
 * 4 telas de apresentação, configuração inicial em 2 passos (bancos e cartão) e
 * "Como quer começar?". O "já vi" fica na conta (avisos_dispensados, aviso "boas_vindas").
 */

/** Contas criadas antes desta data não veem as boas-vindas (já conhecem o site). */
const DATA_CORTE = "2026-11-07T00:00:00Z";
/** Depois de 30 dias de conta, não mostra mais (mesmo sem ter visto). */
const JANELA_MS = 30 * 24 * 3600_000;
/** Mesmo marcador do passo único de retenção (retencao/PrimeirosPassos): espera até fechar o navegador. */
const CHAVE_RETENCAO_ADIADO = "control-all.primeiros-passos-adiado";

const BANCOS_POPULARES = [
  "Nubank",
  "Itaú",
  "Bradesco",
  "Banco do Brasil",
  "Caixa",
  "Santander",
  "Inter",
  "C6 Bank",
  "Mercado Pago",
  "PicPay",
  "BTG Pactual",
  "PagBank",
  "Sicoob",
  "Sicredi",
  "Neon",
  "Pernambucanas",
];

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard"];

type Etapa = "apresentacao" | "bancos" | "cartao" | "fim";

const APRESENTACAO = [
  {
    chamada: "Previsão do mês",
    titulo: "Saiba quanto sobra no fim do mês",
    texto: "Receitas, contas e faturas juntas numa conta simples: o que entra, o que sai e o que fica.",
  },
  {
    chamada: "Tudo junto",
    titulo: "Contas e cartões num só lugar",
    texto: "Saldo das contas, faturas abertas e o melhor dia de compra de cada cartão, sem abrir cinco apps.",
  },
  {
    chamada: "Inteligência artificial",
    titulo: "A IA lança e explica seus gastos",
    texto: "Fale ou digite do seu jeito. A IA entende, classifica e mostra para onde o dinheiro está indo.",
  },
  {
    chamada: "Metas de verdade",
    titulo: "Caixinhas e limites que funcionam",
    texto: "Guarde para seus objetivos e receba um aviso antes de passar do limite de cada categoria.",
  },
];

function useNovoUsuario(): boolean {
  const { user } = useSession();
  if (!user?.created_at) return false;
  const criado = new Date(user.created_at).getTime();
  return criado >= new Date(DATA_CORTE).getTime() && Date.now() - criado < JANELA_MS;
}

function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduzido(mq.matches);
      const ouvir = (e: MediaQueryListEvent) => setReduzido(e.matches);
      mq.addEventListener("change", ouvir);
      return () => mq.removeEventListener("change", ouvir);
    } catch {
      return undefined;
    }
  }, []);
  return reduzido;
}

export function BoasVindas({
  bloqueado = false,
  onVisibilityChange,
}: {
  bloqueado?: boolean;
  onVisibilityChange?: (aberto: boolean) => void;
}) {
  const { user } = useSession();
  const novo = useNovoUsuario();
  const { dispensado, carregando, dispensar } = useAvisoConta("boas_vindas", novo ? user?.id : null);
  const [fechado, setFechado] = useState(false);

  // Enquanto confere se é a primeira vez, já segura os outros avisos (evita dois na tela).
  const pendente = novo && !fechado && (carregando || !dispensado);
  const visivel = pendente && !carregando && !bloqueado;

  useEffect(() => {
    onVisibilityChange?.(pendente);
  }, [pendente, onVisibilityChange]);

  useEffect(() => {
    if (!visivel) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [visivel]);

  if (!visivel) return null;

  function concluir(depois?: () => void) {
    setFechado(true);
    void dispensar();
    try {
      sessionStorage.setItem(CHAVE_RETENCAO_ADIADO, "1");
    } catch {
      // sem storage
    }
    if (depois) window.setTimeout(depois, 120);
  }

  return <TelaBoasVindas concluir={concluir} />;
}

function TelaBoasVindas({ concluir }: { concluir: (depois?: () => void) => void }) {
  const navigate = useNavigate();
  const reduzido = useMovimentoReduzido();
  const { tabelaPendente, isLoading: contasCarregando } = useContas();
  const [etapa, setEtapa] = useState<Etapa>("apresentacao");
  const [pagina, setPagina] = useState(0);
  const [bancosEscolhidos, setBancosEscolhidos] = useState<string[]>([]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (etapa !== "apresentacao") return;
      if (e.key === "ArrowRight") avancarApresentacao();
      if (e.key === "ArrowLeft") setPagina((p) => Math.max(0, p - 1));
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  function irParaConfiguracao() {
    // Contas ainda não ativadas no banco: pula direto para o cartão.
    setEtapa(tabelaPendente ? "cartao" : "bancos");
  }
  function avancarApresentacao() {
    if (pagina < APRESENTACAO.length - 1) setPagina((p) => p + 1);
    else irParaConfiguracao();
  }

  const animacao = reduzido ? "" : "entrar-surge";
  const tela = APRESENTACAO[pagina] ?? APRESENTACAO[0]!;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="boas-vindas-titulo"
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-background text-foreground"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-xl sm:px-8">
        {etapa === "apresentacao" && pagina > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setPagina((p) => p - 1)}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        ) : etapa === "cartao" && !tabelaPendente ? (
          <Button variant="ghost" size="sm" onClick={() => setEtapa("bancos")}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        ) : (
          <span />
        )}
        {etapa === "apresentacao" && (
          <Button variant="ghost" size="sm" onClick={irParaConfiguracao} className="text-muted-foreground">
            Pular
          </Button>
        )}
        {(etapa === "bancos" || etapa === "cartao") && (
          <span className="text-xs font-medium text-muted-foreground">
            Configuração inicial · Passo {etapa === "bancos" || tabelaPendente ? 1 : 2} de {tabelaPendente ? 1 : 2}
          </span>
        )}
        {etapa === "fim" && (
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => concluir()}>
            <X className="size-4" />
          </Button>
        )}
      </header>

      <main className="flex flex-1 flex-col px-4 pb-10 sm:px-8">
        {etapa === "apresentacao" && (
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
            <div
              key={pagina}
              className={`${animacao} grid flex-1 items-center gap-10 py-6 lg:grid-cols-[1.1fr_minmax(0,24rem)] lg:gap-16`}
            >
              <div className="order-2 lg:order-1">
                <p className="text-base font-semibold text-primary">{tela.chamada}</p>
                <h1
                  id="boas-vindas-titulo"
                  className="mt-3 text-balance text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl"
                >
                  {tela.titulo}
                </h1>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                  {tela.texto}
                </p>
              </div>
              <div className="order-1 flex justify-center lg:order-2" aria-hidden="true">
                <Ilustracao indice={pagina} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-6 pt-2">
              <div className="flex items-center gap-2" role="tablist" aria-label="Páginas">
                {APRESENTACAO.map((a, i) => (
                  <button
                    key={a.titulo}
                    type="button"
                    role="tab"
                    aria-selected={i === pagina}
                    aria-label={`Página ${i + 1} de ${APRESENTACAO.length}`}
                    onClick={() => setPagina(i)}
                    className={`h-2 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                      i === pagina ? "w-6 bg-foreground" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
              </div>
              <Button size="lg" className="h-12 w-full max-w-sm rounded-full text-base" onClick={avancarApresentacao}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {etapa === "bancos" && (
          <PassoBancos
            animacao={animacao}
            carregando={contasCarregando}
            escolhidos={bancosEscolhidos}
            setEscolhidos={setBancosEscolhidos}
            onPronto={() => setEtapa("cartao")}
          />
        )}

        {etapa === "cartao" && (
          <PassoCartao animacao={animacao} sugeridos={bancosEscolhidos} onPronto={() => setEtapa("fim")} />
        )}

        {etapa === "fim" && (
          <div className={`${animacao} mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-6`}>
            <p className="text-base font-semibold text-primary">Tudo pronto</p>
            <h1
              id="boas-vindas-titulo"
              className="mt-3 text-balance text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl"
            >
              Como quer começar?
            </h1>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <OpcaoInicio
                icone={<PencilLine className="size-5" />}
                titulo="Registrar meu primeiro gasto"
                texto="Fale ou digite. Leva segundos."
                destaque
                onClick={() => concluir(() => window.dispatchEvent(new Event("abrir-lancamento-rapido")))}
              />
              <OpcaoInicio
                icone={<FileUp className="size-5" />}
                titulo="Importar uma fatura"
                texto="Envie o PDF do cartão e veja tudo lançado."
                onClick={() => concluir(() => void navigate({ to: "/importar" }))}
              />
              <OpcaoInicio
                icone={<Compass className="size-5" />}
                titulo="Explorar sozinho"
                texto="Conheça o site no seu ritmo."
                onClick={() => concluir()}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function OpcaoInicio({
  icone,
  titulo,
  texto,
  destaque = false,
  onClick,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-start gap-3 rounded-3xl border p-5 text-left transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(14,26,43,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        destaque ? "border-primary bg-primary text-primary-foreground" : "bg-card"
      }`}
    >
      <span
        className={`grid size-10 place-items-center rounded-2xl ${
          destaque ? "bg-white/20" : "bg-muted text-foreground"
        }`}
      >
        {icone}
      </span>
      <span className="text-base font-semibold leading-tight">{titulo}</span>
      <span className={`text-sm ${destaque ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{texto}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- Passo 1 */

async function garantirBanco(nome: string, titular: string, existentes: any[]): Promise<string> {
  const k = chaveBanco(nome);
  const achado = existentes.find((b) => chaveBanco(b.nome) === k);
  if (achado) return achado.id as string;
  const { data, error } = await supabase
    .from("bancos")
    .insert({ nome, tipo_conta: "corrente", titular } as any)
    .select("id")
    .single();
  if (error) throw error;
  existentes.push({ id: data.id, nome });
  return data.id as string;
}

function GradeBancos({
  nomes,
  marcados,
  alternar,
}: {
  nomes: string[];
  marcados: string[];
  alternar: (nome: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {nomes.map((nome) => {
        const ativo = marcados.includes(nome);
        return (
          <button
            key={nome}
            type="button"
            aria-pressed={ativo}
            onClick={() => alternar(nome)}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${
              ativo ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/50"
            }`}
          >
            {ativo && (
              <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            )}
            <IconeBanco nome={nome} className="size-11" />
            <span className="line-clamp-2 text-xs font-medium leading-tight">{nome}</span>
          </button>
        );
      })}
    </div>
  );
}

function useBuscaBancos(busca: string): string[] {
  const { data: catalogo = [] } = useCatalogoLogos();
  return useMemo(() => {
    const termo = chaveBanco(busca);
    if (!termo) return BANCOS_POPULARES;
    const nomes = new Map<string, string>();
    for (const n of BANCOS_POPULARES) if (chaveBanco(n).includes(termo)) nomes.set(chaveBanco(n), n);
    for (const c of catalogo) if (c.chave.includes(termo) && !nomes.has(c.chave)) nomes.set(c.chave, c.nome);
    const lista = [...nomes.values()].slice(0, 18);
    // Banco fora do catálogo: deixa usar o nome digitado.
    if (!lista.length && busca.trim().length >= 2) lista.push(busca.trim());
    return lista;
  }, [busca, catalogo]);
}

function PassoBancos({
  animacao,
  carregando,
  escolhidos,
  setEscolhidos,
  onPronto,
}: {
  animacao: string;
  carregando: boolean;
  escolhidos: string[];
  setEscolhidos: (v: string[]) => void;
  onPronto: () => void;
}) {
  const qc = useQueryClient();
  const { data: perfil } = useProfile();
  const { data: bancos = [] } = useBancos();
  const { contas } = useContas();
  const criarConta = useCriarConta();
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const nomes = useBuscaBancos(busca);
  const visiveis = useMemo(
    () => [...escolhidos.filter((e) => !nomes.includes(e)), ...nomes],
    [escolhidos, nomes],
  );

  function alternar(nome: string) {
    setEscolhidos(escolhidos.includes(nome) ? escolhidos.filter((n) => n !== nome) : [...escolhidos, nome]);
  }

  async function continuar() {
    if (!escolhidos.length) {
      onPronto();
      return;
    }
    setSalvando(true);
    try {
      const existentes = [...(bancos as any[])];
      const titular = perfil?.nome ?? "Titular";
      for (const nome of escolhidos) {
        const bancoId = await garantirBanco(nome, titular, existentes);
        if (contas.some((c) => c.banco_id === bancoId)) continue;
        await criarConta.mutateAsync({
          nome,
          tipo: "corrente",
          banco_id: bancoId,
          saldo_inicial: 0,
          data_saldo_inicial: toISODate(new Date()),
        });
      }
      void qc.invalidateQueries({ queryKey: ["bancos"] });
      onPronto();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar as contas.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={`${animacao} mx-auto flex w-full max-w-5xl flex-1 flex-col py-6`}>
      <p className="text-base font-semibold text-primary">Configuração inicial</p>
      <h1
        id="boas-vindas-titulo"
        className="mt-3 text-balance text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl"
      >
        Quais bancos você usa?
      </h1>
      <p className="mt-4 max-w-lg text-lg text-muted-foreground">
        Escolha quantos quiser. Criamos uma conta para cada um, com saldo zero, e você ajusta depois.
      </p>
      <div className="relative mt-8 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar outro banco"
          className="h-11 rounded-full pl-9"
          aria-label="Buscar banco"
        />
      </div>
      <div className="mt-6">
        <GradeBancos nomes={visiveis} marcados={escolhidos} alternar={alternar} />
      </div>
      <div className="sticky bottom-0 mt-auto flex flex-col-reverse items-center gap-3 bg-background/80 pt-8 backdrop-blur-xl sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onPronto} disabled={salvando}>
          Pular
        </Button>
        <Button
          size="lg"
          className="h-12 w-full rounded-full px-8 text-base sm:w-auto"
          onClick={continuar}
          disabled={salvando || carregando}
        >
          {salvando
            ? "Criando contas..."
            : escolhidos.length
              ? `Continuar com ${escolhidos.length} ${escolhidos.length === 1 ? "banco" : "bancos"}`
              : "Continuar"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Passo 2 */

const cartaoInicialSchema = cartaoSchema.extend({
  final: z.string().regex(/^(\d{4})?$/, "Informe os 4 últimos dígitos ou deixe em branco"),
});

function PassoCartao({
  animacao,
  sugeridos,
  onPronto,
}: {
  animacao: string;
  sugeridos: string[];
  onPronto: () => void;
}) {
  const qc = useQueryClient();
  const { data: perfil } = useProfile();
  const { data: bancos = [] } = useBancos();
  const opcoes = useMemo(
    () => [...sugeridos, ...BANCOS_POPULARES.filter((b) => !sugeridos.includes(b))].slice(0, 12),
    [sugeridos],
  );
  const [banco, setBanco] = useState(sugeridos[0] ?? "");
  const [apelido, setApelido] = useState("");
  const [bandeira, setBandeira] = useState("Mastercard");
  const [final, setFinal] = useState("");
  const [limite, setLimite] = useState("");
  const [semLimite, setSemLimite] = useState(false);
  const [fechamento, setFechamento] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const melhorDia = melhorDiaCompra(fechamento);

  async function salvar() {
    setSalvando(true);
    try {
      const titular = perfil?.nome ?? "Titular";
      const bancoId = banco ? await garantirBanco(banco, titular, [...(bancos as any[])]) : null;
      const dados = cartaoInicialSchema.parse({
        apelido: apelido.trim() || (banco ? `Cartão ${banco}` : ""),
        bandeira,
        final,
        limite: semLimite ? null : Number(limite.replace(/\./g, "").replace(",", ".")) || 0,
        dia_fechamento: Number(fechamento),
        dia_vencimento: Number(vencimento),
        banco_id: bancoId,
        cor: "#2563eb",
        titular,
        tipo: "credito",
      });
      await salvarCartao(dados);
      toast.success("Cartão cadastrado.");
      void qc.invalidateQueries({ queryKey: ["cartoes"] });
      void qc.invalidateQueries({ queryKey: ["bancos"] });
      onPronto();
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message ?? e?.issues?.[0]?.message ?? e?.message;
      toast.error(
        /dia_fechamento|dia_vencimento|Expected number|>=|<=/i.test(String(msg))
          ? "Informe os dias de fechamento e vencimento (1 a 31)."
          : (msg ?? "Não foi possível salvar o cartão."),
      );
    } finally {
      setSalvando(false);
    }
  }

  const rotulo = "text-xs font-medium text-muted-foreground";

  return (
    <div className={`${animacao} mx-auto grid w-full max-w-5xl flex-1 gap-10 py-6 lg:grid-cols-[1fr_20rem] lg:gap-16`}>
      <div>
        <p className="text-base font-semibold text-primary">Configuração inicial</p>
        <h1
          id="boas-vindas-titulo"
          className="mt-3 text-balance text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl"
        >
          Seu cartão de crédito
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          Com o dia de fechamento, mostramos em qual fatura cada compra cai.
        </p>

        <div className="mt-8 space-y-6">
          <div className="space-y-2">
            <p className={rotulo}>Banco</p>
            <div className="flex flex-wrap gap-2">
              {opcoes.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={banco === b}
                  onClick={() => setBanco(banco === b ? "" : b)}
                  className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition-colors motion-reduce:transition-none ${
                    banco === b ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/50"
                  }`}
                >
                  <IconeBanco nome={b} className="size-6 rounded-full p-0.5" />
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className={rotulo}>Nome do cartão</span>
              <Input
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder={banco ? `Cartão ${banco}` : "Ex.: Cartão principal"}
                className="h-11"
              />
            </label>
            <label className="space-y-1.5">
              <span className={rotulo}>4 últimos dígitos (opcional)</span>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={final}
                onChange={(e) => setFinal(e.target.value.replace(/\D/g, ""))}
                placeholder="1234"
                className="h-11"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className={rotulo}>Bandeira</p>
            <div className="flex flex-wrap gap-2">
              {BANDEIRAS.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={bandeira === b}
                  onClick={() => setBandeira(b)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors motion-reduce:transition-none ${
                    bandeira === b ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/50"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className={rotulo}>Limite</span>
            <div className="flex flex-wrap items-center gap-4">
              <Input
                inputMode="decimal"
                value={semLimite ? "" : limite}
                disabled={semLimite}
                onChange={(e) => setLimite(e.target.value)}
                placeholder={semLimite ? "Sem limite" : "R$ 0,00"}
                className="h-11 max-w-[12rem]"
                aria-label="Limite"
              />
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={semLimite} onCheckedChange={setSemLimite} aria-label="Cartão sem limite" />
                Sem limite
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
            <label className="space-y-1.5">
              <span className={rotulo}>Dia de fechamento</span>
              <Input
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={fechamento}
                onChange={(e) => setFechamento(e.target.value)}
                placeholder="Ex.: 3"
                className="h-11"
              />
            </label>
            <label className="space-y-1.5">
              <span className={rotulo}>Dia de vencimento</span>
              <Input
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                placeholder="Ex.: 10"
                className="h-11"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border bg-card p-6 shadow-[0_20px_40px_-28px_rgba(14,26,43,0.45)]">
          <p className="text-sm text-muted-foreground">Melhor dia de compra</p>
          <p className="mt-1 text-5xl font-extrabold tracking-[-0.03em] tabular-nums">
            {melhorDia ? `Dia ${melhorDia}` : "--"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {melhorDia
              ? `Compras a partir do dia ${melhorDia} entram só na fatura seguinte. Mais tempo para pagar.`
              : "Informe o dia de fechamento para ver o melhor dia de compra."}
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <Button size="lg" className="h-12 rounded-full text-base" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar cartão"}
          </Button>
          <Button variant="ghost" onClick={onPronto} disabled={salvando}>
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Ilustrações */

const vidro =
  "rounded-2xl border border-white/60 bg-white/70 p-3.5 shadow-[0_20px_40px_-20px_rgba(14,26,43,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10";

function Ilustracao({ indice }: { indice: number }) {
  if (indice === 0)
    return (
      <div className="relative h-[340px] w-[300px] sm:h-[420px] sm:w-[360px]">
        <CelularPrevisao className="absolute left-[16%] top-0 w-[170px] -rotate-[4deg] sm:w-[200px]" />
        <div className={`entrar-flutua absolute right-0 top-[56%] w-44 ${vidro}`}>
          <p className="text-xs text-muted-foreground">Fim do ciclo</p>
          <p className="text-sm font-semibold text-success">Sobram R$ 3.100</p>
        </div>
      </div>
    );
  if (indice === 1)
    return (
      <div className="relative h-[300px] w-[300px] sm:h-[360px] sm:w-[360px]">
        {[
          { cor: "linear-gradient(135deg,#8A05BE,#4B0082)", rot: "-rotate-[10deg]", top: "6%", nome: "Roxinho", fim: "4821" },
          { cor: "linear-gradient(135deg,#FF7A00,#EC7000)", rot: "-rotate-[2deg]", top: "26%", nome: "Laranja", fim: "1290" },
          { cor: "linear-gradient(135deg,#1D1D1F,#3A3A3C)", rot: "rotate-[6deg]", top: "46%", nome: "Black", fim: "7733" },
        ].map((c, i) => (
          <div
            key={c.nome}
            className={`vitrine-peca absolute left-[8%] aspect-[1.586] w-[78%] rounded-2xl p-4 text-white shadow-[0_30px_50px_-25px_rgba(0,0,0,0.55)] ${c.rot}`}
            style={{ background: c.cor, top: c.top, animationDelay: `${i * 120}ms` }}
          >
            <div className="flex h-full flex-col justify-between">
              <span className="h-6 w-9 rounded-md bg-white/30" />
              <div className="flex items-end justify-between text-xs font-medium">
                <span>{c.nome}</span>
                <span className="tabular-nums">•••• {c.fim}</span>
              </div>
            </div>
          </div>
        ))}
        <div className={`entrar-flutua absolute bottom-0 right-0 w-48 ${vidro} [animation-delay:1.2s]`}>
          <p className="text-xs text-muted-foreground">Melhor dia de compra</p>
          <p className="text-sm font-semibold">Dia 4 · fatura fecha dia 3</p>
        </div>
      </div>
    );
  if (indice === 2)
    return (
      <div className="flex w-[300px] flex-col gap-3 sm:w-[360px]">
        <div className="vitrine-peca ml-auto max-w-[80%] rounded-3xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
          gastei 45 no mercado hoje no débito
        </div>
        <div
          className={`vitrine-peca max-w-[88%] ${vidro} rounded-3xl rounded-bl-md`}
          style={{ animationDelay: "160ms" }}
        >
          <p className="text-sm font-semibold">Lancei R$ 45,00 em Alimentação</p>
          <p className="mt-1 text-xs text-muted-foreground">Mercado · Hoje · Débito</p>
        </div>
        <div
          className="vitrine-peca ml-auto max-w-[80%] rounded-3xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground"
          style={{ animationDelay: "320ms" }}
        >
          por que gastei mais esse mês?
        </div>
        <div
          className={`vitrine-peca max-w-[88%] ${vidro} rounded-3xl rounded-bl-md`}
          style={{ animationDelay: "480ms" }}
        >
          <p className="text-sm">Delivery subiu R$ 210 em relação ao mês passado.</p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
            <span className="w-[62%] bg-primary" />
            <span className="w-[18%] bg-warning" />
          </div>
        </div>
      </div>
    );
  return (
    <div className="flex w-[300px] flex-col gap-3 sm:w-[360px]">
      {[
        { nome: "Viagem de férias", valor: "R$ 2.480 de R$ 4.000", pct: 62, cor: "bg-primary", tipo: "Caixinha" },
        { nome: "Reserva de emergência", valor: "R$ 5.200 de R$ 6.000", pct: 87, cor: "bg-success", tipo: "Caixinha" },
        { nome: "Alimentação", valor: "R$ 960 de R$ 1.200", pct: 80, cor: "bg-warning", tipo: "Limite" },
      ].map((c, i) => (
        <div key={c.nome} className={`vitrine-peca ${vidro}`} style={{ animationDelay: `${i * 140}ms` }}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">{c.nome}</p>
            <span className="text-[11px] font-medium text-muted-foreground">{c.tipo}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{c.valor}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <span className={`block h-full rounded-full ${c.cor}`} style={{ width: `${c.pct}%` }} />
          </div>
        </div>
      ))}
      <div className={`entrar-flutua ml-auto w-56 ${vidro} [animation-delay:.8s]`}>
        <p className="text-xs text-muted-foreground">Aviso</p>
        <p className="text-sm font-semibold">Você usou 80% do limite de Alimentação</p>
      </div>
    </div>
  );
}
