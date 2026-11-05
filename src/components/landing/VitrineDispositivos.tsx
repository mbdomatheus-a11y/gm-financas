/**
 * Vitrine da página pública (04/11/2026): notebook, iPhone e Android mostrando telas do
 * Control ALL com dados de EXEMPLO (nunca dados reais de usuário). Tudo desenhado em código:
 * escala pelo tamanho do container (unidades cqw), nítido em qualquer tela e sem imagens.
 * Formatos genéricos de aparelho, sem logos de fabricantes.
 */
const TINTA = "#1D1D1F";
const CINZA = "#6E6E73";
const AZUL = "#1670B8";
const VERDE = "#1A8A4F";

function Notebook() {
  return (
    <div className="vitrine-peca relative mx-auto w-[78%]" style={{ animationDelay: "0ms" }}>
      <div className="overflow-hidden rounded-t-[1.6cqw] border-[0.9cqw] border-b-0 border-[#1C1C1E] bg-[#1C1C1E] shadow-[0_3cqw_6cqw_-2cqw_rgba(0,0,0,0.35)]">
        <div className="flex aspect-[16/10] bg-white text-left" style={{ color: TINTA }}>
          <aside className="flex w-[22%] flex-col gap-[0.6cqw] border-r border-[#EDEDF0] bg-[#F7F7F9] p-[1.3cqw]">
            <span className="mb-[0.8cqw] text-[1.25cqw] font-bold">
              Control<span style={{ color: AZUL }}>ALL</span>
            </span>
            {["Início", "Despesas", "Receitas", "Cartões", "Caixinhas", "Notas fiscais"].map((m, i) => (
              <span
                key={m}
                className="rounded-[0.5cqw] px-[0.7cqw] py-[0.4cqw] text-[0.95cqw]"
                style={i === 0 ? { background: "#E8EEF6", fontWeight: 600 } : { color: CINZA }}
              >
                {m}
              </span>
            ))}
          </aside>
          <div className="flex flex-1 flex-col gap-[1.4cqw] p-[2cqw]">
            <div>
              <p className="text-[0.95cqw]" style={{ color: CINZA }}>Quarta-feira, 4 de novembro</p>
              <p className="text-[2.4cqw] font-extrabold tracking-[-0.03em]">Boa noite, Ana</p>
            </div>
            <div>
              <p className="text-[0.95cqw]" style={{ color: CINZA }}>Se continuar assim, sobram</p>
              <p className="text-[4.4cqw] font-extrabold leading-none tracking-[-0.04em] tabular-nums" style={{ color: VERDE }}>
                R$ 3.100
              </p>
            </div>
            <div className="grid grid-cols-3 gap-[0.8cqw]">
              {[
                ["Receitas", "R$ 8.240"],
                ["Despesas", "R$ 5.140"],
                ["Caixinhas", "R$ 600"],
              ].map(([r, v]) => (
                <div key={r} className="rounded-[0.9cqw] bg-[#F5F5F7] p-[1cqw]">
                  <p className="text-[0.85cqw]" style={{ color: CINZA }}>{r}</p>
                  <p className="text-[1.5cqw] font-bold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              <p className="mb-[0.4cqw] text-[1.15cqw] font-bold">Para revisar</p>
              {[
                ["Plano de celular", "R$ 1.380/ano"],
                ["Assinatura de streaming", "R$ 540/ano"],
              ].map(([n, v]) => (
                <div key={n} className="flex justify-between border-t border-[#EDEDF0] py-[0.6cqw] text-[1cqw]">
                  <span>{n}</span>
                  <b className="tabular-nums">{v}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* base do notebook */}
      <div className="relative -mx-[6%] h-[1.3cqw] rounded-b-[1.2cqw] bg-[#D2D2D7]">
        <div className="absolute left-1/2 top-0 h-[0.5cqw] w-[14%] -translate-x-1/2 rounded-b-[0.6cqw] bg-[#B9B9BF]" />
      </div>
    </div>
  );
}

function Iphone() {
  return (
    <div
      className="vitrine-peca absolute bottom-[-6%] right-[1%] w-[21%] rounded-[3.2cqw] border-[0.75cqw] border-[#1C1C1E] bg-[#1C1C1E] shadow-[0_3cqw_5cqw_-1.5cqw_rgba(0,0,0,0.45)]"
      style={{ animationDelay: "140ms" }}
    >
      <div className="relative flex aspect-[9/19.5] flex-col gap-[1.2cqw] overflow-hidden rounded-[2.5cqw] bg-white p-[1.5cqw] pt-[1.2cqw] text-left" style={{ color: TINTA }}>
        <div className="flex items-center justify-between text-[0.85cqw] font-semibold">
          <span>9:41</span>
          <span className="h-[1.5cqw] w-[6cqw] rounded-full bg-[#1C1C1E]" aria-hidden="true" />
          <span className="w-[2cqw]" />
        </div>
        <p className="mt-[0.6cqw] text-[1.6cqw] font-extrabold tracking-[-0.02em]">Previsão</p>
        <div>
          <p className="text-[0.95cqw]" style={{ color: CINZA }}>Você pode gastar</p>
          <p className="text-[3.3cqw] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
            R$ 114<span className="text-[2cqw]">,81</span>
          </p>
          <p className="text-[0.95cqw]" style={{ color: CINZA }}>por dia</p>
        </div>
        <div className="h-[0.6cqw] rounded-full bg-[#EDEDF0]">
          <div className="h-[0.6cqw] w-[62%] rounded-full" style={{ background: AZUL }} />
        </div>
        <div className="flex flex-col">
          {[
            ["Mercado", "R$ 85,00"],
            ["Farmácia", "R$ 32,40"],
            ["Combustível", "R$ 150,00"],
          ].map(([n, v]) => (
            <div key={n} className="flex justify-between border-t border-[#EDEDF0] py-[0.7cqw] text-[1cqw]">
              <span>{n}</span>
              <b className="tabular-nums">{v}</b>
            </div>
          ))}
        </div>
        <span className="mt-auto rounded-full py-[0.9cqw] text-center text-[1.05cqw] font-semibold text-white" style={{ background: AZUL }}>
          Lançar gasto
        </span>
      </div>
    </div>
  );
}

function Android() {
  return (
    <div
      className="vitrine-peca absolute bottom-[-9%] left-[1%] w-[19%] rounded-[2.2cqw] border-[0.65cqw] border-[#2A2A2D] bg-[#2A2A2D] shadow-[0_3cqw_5cqw_-1.5cqw_rgba(0,0,0,0.45)]"
      style={{ animationDelay: "260ms" }}
    >
      <div className="relative flex aspect-[9/20] flex-col gap-[1cqw] overflow-hidden rounded-[1.7cqw] bg-[#F5F5F7] p-[1.3cqw] text-left" style={{ color: TINTA }}>
        <div className="flex justify-center">
          <span className="size-[1.1cqw] rounded-full bg-[#1C1C1E]" aria-hidden="true" />
        </div>
        <p className="text-[1.45cqw] font-extrabold tracking-[-0.02em]">Lançar com IA</p>
        <p className="ml-auto max-w-[85%] rounded-[1.2cqw] rounded-br-[0.3cqw] px-[1cqw] py-[0.7cqw] text-[1cqw] text-white" style={{ background: AZUL }}>
          mercado, 85 reais no cartão
        </p>
        <div className="rounded-[1.2cqw] bg-white p-[1.1cqw] text-[0.95cqw]">
          <p style={{ color: CINZA }}>Confira antes de salvar</p>
          <p className="mt-[0.4cqw] text-[1.3cqw] font-bold">Mercado</p>
          <p style={{ color: CINZA }}>Cartão · hoje</p>
          <p className="mt-[0.4cqw] text-[1.6cqw] font-extrabold tabular-nums">R$ 85,00</p>
          <span className="mt-[0.8cqw] block rounded-full py-[0.6cqw] text-center font-semibold text-white" style={{ background: TINTA }}>
            Salvar
          </span>
        </div>
        <p className="mt-auto text-center text-[0.85cqw]" style={{ color: CINZA }}>Escreva ou fale um gasto</p>
      </div>
    </div>
  );
}

export function VitrineDispositivos({ className = "" }: { className?: string }) {
  return (
    <figure
      className={`relative mx-auto w-full max-w-6xl pb-[9%] [container-type:inline-size] ${className}`}
      aria-label="O Control ALL no notebook, no iPhone e no Android, com dados de exemplo"
    >
      <Notebook />
      <Iphone />
      <Android />
      <figcaption className="sr-only">Telas ilustrativas com dados de exemplo.</figcaption>
    </figure>
  );
}
