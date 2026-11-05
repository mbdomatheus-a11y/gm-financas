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

function BarraStatus({ claro = false }: { claro?: boolean }) {
  const cor = claro ? "#FFFFFF" : TINTA;
  return (
    <div className="flex items-center justify-between px-[3cqw] text-[3.7cqw] font-semibold" style={{ color: cor }} aria-hidden="true">
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-[1.4cqw]">
        <svg viewBox="0 0 18 12" className="h-[3cqw] w-auto" fill={cor}><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
        <svg viewBox="0 0 16 12" className="h-[3cqw] w-auto" fill={cor}><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.3-1.4A10.9 10.9 0 0 0 8 .3 10.9 10.9 0 0 0 .4 3.3l1.3 1.4A9 9 0 0 1 8 2.2Zm0 3.6c1.4 0 2.7.5 3.8 1.4l1.3-1.4A7.6 7.6 0 0 0 8 3.9c-1.9 0-3.7.7-5.1 1.9l1.3 1.4c1-.9 2.4-1.4 3.8-1.4Zm0 3.6c-.6 0-1.2.2-1.6.6L8 11.7l1.6-1.7c-.4-.4-1-.6-1.6-.6Z"/></svg>
        <span className="relative flex h-[3.4cqw] w-[6.4cqw] items-center rounded-[1cqw] border-[0.35cqw] p-[0.4cqw]" style={{ borderColor: cor, opacity: 0.95 }}>
          <span className="h-full w-[78%] rounded-[0.5cqw]" style={{ background: cor }} />
          <span className="absolute -right-[1cqw] h-[1.4cqw] w-[0.5cqw] rounded-r-full" style={{ background: cor }} />
        </span>
      </span>
    </div>
  );
}

function TelaPrevisao() {
  return (
    <div className="flex h-full flex-col gap-[3.4cqw] bg-[#F5F5F7] px-[5cqw] pb-[7cqw] pt-[3.6cqw] text-left" style={{ color: TINTA }}>
      <BarraStatus />
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

/** Celular com a Previsão do mês (também usado na tela de login). Formato realista, sem logo. */
export function CelularPrevisao({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`vitrine-peca [container-type:inline-size] ${className}`} style={style}>
      <div className="relative rounded-[17cqw] bg-[linear-gradient(150deg,#5A5A5F_0%,#2C2C2E_18%,#1C1C1E_55%,#3A3A3C_100%)] p-[1.3cqw] shadow-[0_40px_70px_-25px_rgba(0,0,0,0.55),inset_0_0_0_0.4cqw_rgba(255,255,255,0.12)]">
        {/* botões laterais */}
        <span aria-hidden="true" className="absolute -left-[0.9cqw] top-[17%] h-[6%] w-[1cqw] rounded-l-[0.6cqw] bg-[#3A3A3C]" />
        <span aria-hidden="true" className="absolute -left-[0.9cqw] top-[26%] h-[10%] w-[1cqw] rounded-l-[0.6cqw] bg-[#3A3A3C]" />
        <span aria-hidden="true" className="absolute -left-[0.9cqw] top-[38%] h-[10%] w-[1cqw] rounded-l-[0.6cqw] bg-[#3A3A3C]" />
        <span aria-hidden="true" className="absolute -right-[0.9cqw] top-[30%] h-[15%] w-[1cqw] rounded-r-[0.6cqw] bg-[#3A3A3C]" />
        <div className="rounded-[15.8cqw] bg-black p-[2.4cqw]">
          <div className="relative aspect-[9/19.5] overflow-hidden rounded-[13.6cqw]">
            <TelaPrevisao />
            {/* ilha da câmera */}
            <span aria-hidden="true" className="absolute left-1/2 top-[2.4cqw] h-[8.6cqw] w-[29cqw] -translate-x-1/2 rounded-full bg-black" />
            {/* indicador de início */}
            <span aria-hidden="true" className="absolute bottom-[2.2cqw] left-1/2 h-[1.3cqw] w-[36cqw] -translate-x-1/2 rounded-full bg-[#1D1D1F]/80" />
            {/* reflexo do vidro */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_32%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Android({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`vitrine-peca [container-type:inline-size] ${className}`} style={style}>
      <div className="relative rounded-[11cqw] bg-[linear-gradient(160deg,#4A4A4E_0%,#26262A_30%,#1E1E21_70%,#333337_100%)] p-[1.1cqw] shadow-[0_40px_70px_-25px_rgba(0,0,0,0.55),inset_0_0_0_0.35cqw_rgba(255,255,255,0.1)]">
        <span aria-hidden="true" className="absolute -right-[0.9cqw] top-[20%] h-[14%] w-[1cqw] rounded-r-[0.6cqw] bg-[#3A3A3C]" />
        <span aria-hidden="true" className="absolute -right-[0.9cqw] top-[38%] h-[8%] w-[1cqw] rounded-r-[0.6cqw] bg-[#3A3A3C]" />
        <div className="rounded-[10cqw] bg-black p-[1.8cqw]">
          <div className="relative flex aspect-[9/20] flex-col gap-[3.2cqw] overflow-hidden rounded-[8.4cqw] bg-[#F5F5F7] px-[5cqw] pb-[7cqw] pt-[3.4cqw] text-left" style={{ color: TINTA }}>
            <BarraStatus />
            <span aria-hidden="true" className="absolute left-1/2 top-[2.8cqw] size-[4.6cqw] -translate-x-1/2 rounded-full bg-black ring-[0.6cqw] ring-[#111]" />
            <p className="mt-[2cqw] text-[6.4cqw] font-extrabold tracking-[-0.02em]">Pergunte ao assistente</p>
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
            <span aria-hidden="true" className="absolute bottom-[2.2cqw] left-1/2 h-[1.1cqw] w-[30cqw] -translate-x-1/2 rounded-full bg-[#1D1D1F]/70" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0)_30%)]" />
          </div>
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
