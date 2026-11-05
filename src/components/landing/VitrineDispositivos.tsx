/**
 * Vitrine da página pública (04-05/11/2026): notebook, iPhone e Android mostrando partes REAIS
 * do app (menu lateral, Previsão do mês com ciclo, Cobranças para revisar, Pergunte ao assistente),
 * sempre com dados de EXEMPLO. Desenhado em código, sem imagens e sem logos de fabricantes.
 * Cada aparelho é um container (cqw = 1% da largura do próprio aparelho), então escala sozinho.
 */
const TINTA = "#1D1D1F";
const CINZA = "#6E6E73";
const AZUL = "#1670B8";
const VERDE = "#1A8A4F";
const LINHA = "#EDEDF0";

function TelaPrevisao() {
  return (
    <div className="flex h-full flex-col gap-[3.4cqw] bg-[#F5F5F7] p-[5cqw] pt-[4cqw] text-left" style={{ color: TINTA }}>
      <div className="flex items-center justify-between text-[3.6cqw] font-semibold">
        <span>9:41</span>
        <span className="h-[6cqw] w-[26cqw] rounded-full bg-[#1C1C1E]" aria-hidden="true" />
        <span className="w-[8cqw]" />
      </div>
      <p className="mt-[1cqw] text-[7cqw] font-extrabold tracking-[-0.02em]">Boa noite, Guilherme</p>
      <div className="rounded-[5cqw] bg-white p-[4.5cqw]">
        <p className="text-[4.6cqw] font-bold">Previsão do mês</p>
        <p className="mt-[0.5cqw] flex flex-wrap items-center gap-[1.5cqw] text-[3.3cqw]" style={{ color: CINZA }}>
          Novembro de 2026
          <span className="rounded-full bg-[#F0F0F3] px-[2cqw] py-[0.4cqw]" style={{ color: TINTA }}>ciclo 08/11 a 07/12</span>
        </p>
        <p className="mt-[3cqw] text-[3.4cqw]" style={{ color: CINZA }}>Você pode gastar</p>
        <p className="text-[13cqw] font-extrabold leading-none tracking-[-0.04em] tabular-nums" style={{ color: VERDE }}>
          R$ 114<span className="text-[7cqw]">,81</span>
        </p>
        <p className="text-[3.4cqw]" style={{ color: CINZA }}>por dia, com 24 dias restantes</p>
        <p className="mt-[3cqw] rounded-[3cqw] bg-[#E9F5EE] px-[3cqw] py-[2cqw] text-[3.2cqw] font-semibold">
          Se continuar assim, sobram R$ 3.100 no fim do mês.
        </p>
        <div className="mt-[3cqw] text-[3.3cqw]">
          {[
            ["Receitas do mês", "+R$ 8.240", VERDE],
            ["Despesas comprometidas", "−R$ 5.140", TINTA],
            ["Saldo livre", "R$ 3.100", VERDE],
          ].map(([r, v, c]) => (
            <div key={r} className="flex justify-between border-t py-[1.6cqw]" style={{ borderColor: LINHA }}>
              <span style={{ color: CINZA }}>{r}</span>
              <b className="tabular-nums" style={{ color: c }}>{v}</b>
            </div>
          ))}
        </div>
      </div>
      <span className="mt-auto rounded-full py-[3.4cqw] text-center text-[4cqw] font-semibold text-white" style={{ background: AZUL }}>
        + Lançar
      </span>
    </div>
  );
}

/** Celular com a Previsão do mês (também usado na tela de login). */
export function CelularPrevisao({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`vitrine-peca rounded-[14cqw] border-[3cqw] border-[#1C1C1E] bg-[#1C1C1E] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] [container-type:inline-size] ${className}`}
      style={style}
    >
      <div className="aspect-[9/19.5] overflow-hidden rounded-[11cqw]">
        <TelaPrevisao />
      </div>
    </div>
  );
}

function Android({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`vitrine-peca rounded-[11cqw] border-[3cqw] border-[#2A2A2D] bg-[#2A2A2D] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] [container-type:inline-size] ${className}`}
      style={style}
    >
      <div className="flex aspect-[9/20] flex-col gap-[3.4cqw] overflow-hidden rounded-[8.5cqw] bg-[#F5F5F7] p-[5cqw] text-left" style={{ color: TINTA }}>
        <div className="flex justify-center">
          <span className="size-[4.5cqw] rounded-full bg-[#1C1C1E]" aria-hidden="true" />
        </div>
        <p className="text-[6.4cqw] font-extrabold tracking-[-0.02em]">Pergunte ao assistente</p>
        <div className="flex flex-wrap gap-[1.6cqw] text-[3.2cqw]">
          {["Quanto sobra este mês?", "Quais garantias vencem?"].map((c) => (
            <span key={c} className="rounded-full bg-white px-[2.6cqw] py-[1.2cqw]" style={{ color: CINZA }}>{c}</span>
          ))}
        </div>
        <p className="ml-auto max-w-[85%] rounded-[5cqw] rounded-br-[1.2cqw] px-[4cqw] py-[2.6cqw] text-[3.8cqw] text-white" style={{ background: AZUL }}>
          mercado, 85 reais no cartão
        </p>
        <div className="rounded-[5cqw] bg-white p-[4.4cqw] text-[3.4cqw]">
          <p style={{ color: CINZA }}>Rascunho, confira antes de salvar</p>
          <p className="mt-[1.4cqw] text-[5cqw] font-bold">Mercado</p>
          <p style={{ color: CINZA }}>Alimentação · Cartão Nubank · hoje</p>
          <p className="mt-[1.4cqw] text-[6.4cqw] font-extrabold tabular-nums">R$ 85,00</p>
          <span className="mt-[3cqw] block rounded-full py-[2.4cqw] text-center font-semibold text-white" style={{ background: TINTA }}>
            Salvar lançamento
          </span>
        </div>
        <div className="mt-auto rounded-full bg-white px-[4cqw] py-[3cqw] text-[3.4cqw]" style={{ color: CINZA }}>
          Ex.: quanto gastei com mercado?
        </div>
      </div>
    </div>
  );
}

function Notebook() {
  const menu = ["Início", "Calendário", "Finanças", "Casa e vida", "Documentos", "Calculadora", "Compartilhar"];
  return (
    <div className="vitrine-peca relative mx-auto w-[78%] [container-type:inline-size]">
      <div className="overflow-hidden rounded-t-[2cqw] border-[1.2cqw] border-b-0 border-[#1C1C1E] bg-[#1C1C1E] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)]">
        <div className="flex aspect-[16/10] bg-white text-left" style={{ color: TINTA }}>
          <aside className="flex w-[21%] flex-col gap-[0.5cqw] border-r bg-[#FAFAFB] p-[1.6cqw]" style={{ borderColor: LINHA }}>
            <span className="text-[1.5cqw] font-bold">Control ALL</span>
            <span className="mb-[1.4cqw] text-[1cqw]" style={{ color: AZUL }}>Você no controle de tudo</span>
            {menu.map((m, i) => (
              <span
                key={m}
                className="rounded-[0.8cqw] px-[0.9cqw] py-[0.55cqw] text-[1.15cqw]"
                style={i === 0 ? { background: "#E8EEF6", fontWeight: 600, color: AZUL } : { color: CINZA }}
              >
                {m}
              </span>
            ))}
          </aside>
          <div className="flex flex-1 flex-col gap-[1.6cqw] p-[2.4cqw]">
            <div>
              <p className="text-[2.9cqw] font-extrabold leading-tight tracking-[-0.03em]">Boa noite, Guilherme</p>
              <p className="text-[1.15cqw]" style={{ color: CINZA }}>Quarta-feira, 4 de novembro</p>
            </div>
            <div className="grid grid-cols-[1.3fr_1fr] gap-px overflow-hidden rounded-[2cqw] border" style={{ borderColor: LINHA, background: LINHA }}>
              <div className="bg-white p-[2cqw]">
                <p className="text-[1.15cqw]" style={{ color: CINZA }}>Saldo de nov. de 26</p>
                <p className="text-[4.6cqw] font-extrabold leading-none tracking-[-0.04em] tabular-nums">R$ 3.100,00</p>
              </div>
              <div className="grid grid-rows-2 gap-px">
                <div className="bg-white px-[1.8cqw] py-[1cqw]">
                  <p className="text-[1cqw]" style={{ color: CINZA }}>Receitas</p>
                  <p className="text-[1.8cqw] font-bold tabular-nums">R$ 8.240,00</p>
                </div>
                <div className="bg-white px-[1.8cqw] py-[1cqw]">
                  <p className="text-[1cqw]" style={{ color: CINZA }}>Despesas</p>
                  <p className="text-[1.8cqw] font-bold tabular-nums">R$ 5.140,00</p>
                </div>
              </div>
            </div>
            <div className="rounded-[2cqw] border p-[1.8cqw]" style={{ borderColor: LINHA }}>
              <p className="mb-[0.6cqw] text-[1.45cqw] font-bold">Cobranças para revisar</p>
              {[
                ["Telefonia e internet: plano do celular", "R$ 1.380"],
                ["Assinatura: streaming", "R$ 540"],
                ["Anuidade do cartão", "R$ 420"],
              ].map(([n, v]) => (
                <div key={n} className="flex justify-between border-t py-[0.7cqw] text-[1.15cqw]" style={{ borderColor: LINHA }}>
                  <span>{n}</span>
                  <b className="tabular-nums">{v}<span className="font-normal" style={{ color: CINZA }}> por ano</span></b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="relative -mx-[6%] h-[1.6cqw] rounded-b-[1.6cqw] bg-[#D2D2D7]">
        <div className="absolute left-1/2 top-0 h-[0.6cqw] w-[14%] -translate-x-1/2 rounded-b-[0.8cqw] bg-[#B9B9BF]" />
      </div>
    </div>
  );
}

export function VitrineDispositivos({ className = "" }: { className?: string }) {
  return (
    <figure
      className={`relative mx-auto w-full max-w-6xl pb-[9%] ${className}`}
      aria-label="O Control ALL no notebook, no iPhone e no Android, com dados de exemplo"
    >
      <Notebook />
      <CelularPrevisao className="absolute bottom-[-6%] right-[1%] w-[21%]" style={{ animationDelay: "140ms" }} />
      <Android className="absolute bottom-[-9%] left-[1%] w-[19%]" style={{ animationDelay: "260ms" }} />
      <figcaption className="sr-only">Telas ilustrativas com dados de exemplo.</figcaption>
    </figure>
  );
}
