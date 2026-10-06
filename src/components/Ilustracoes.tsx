/**
 * Ilustrações próprias do Control ALL (SVG inline, sem dependência externa).
 * Usam as cores da marca (`--brand`) para acompanhar a paleta escolhida.
 */

type Props = { className?: string; titulo?: string };

function Pessoa({
  x,
  y,
  escala = 1,
  pele,
  cabelo,
  roupa,
  cabeloGrisalho = false,
}: {
  x: number;
  y: number;
  escala?: number;
  pele: string;
  cabelo: string;
  roupa: string;
  cabeloGrisalho?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      {/* corpo */}
      <path d="M-34 110 C-34 70 -22 52 0 52 C22 52 34 70 34 110 Z" fill={roupa} />
      {/* pescoço */}
      <rect x="-7" y="40" width="14" height="16" rx="6" fill={pele} />
      {/* cabeça */}
      <circle cx="0" cy="24" r="23" fill={pele} />
      {/* cabelo */}
      <path
        d="M-24 20 C-24 -4 24 -4 24 20 C16 8 -16 8 -24 20 Z"
        fill={cabeloGrisalho ? "#d9dee6" : cabelo}
      />
      {/* olhos e sorriso */}
      <circle cx="-8" cy="26" r="2.2" fill="#2b2f3a" />
      <circle cx="8" cy="26" r="2.2" fill="#2b2f3a" />
      <path d="M-7 35 Q0 41 7 35" stroke="#2b2f3a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Família de várias idades usando o aplicativo junta. */
export function IlustracaoFamilia({ className, titulo = "Família de várias idades usando o Control ALL" }: Props) {
  return (
    <svg viewBox="0 0 520 340" role="img" aria-label={titulo} className={className}>
      <title>{titulo}</title>
      <defs>
        <linearGradient id="fam-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--chart-2)" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <rect width="520" height="340" rx="28" fill="url(#fam-bg)" />
      <circle cx="450" cy="60" r="44" fill="var(--brand)" opacity="0.12" />
      <circle cx="70" cy="280" r="60" fill="var(--chart-2)" opacity="0.14" />

      {/* mesa */}
      <rect x="40" y="248" width="440" height="16" rx="8" fill="#c9a77c" />
      <rect x="70" y="262" width="12" height="52" rx="4" fill="#b08d63" />
      <rect x="438" y="262" width="12" height="52" rx="4" fill="#b08d63" />

      {/* pessoas */}
      <Pessoa x={96} y={104} pele="#e8b999" cabelo="#6b4a3a" roupa="#7aa7d9" cabeloGrisalho />
      <Pessoa x={185} y={92} pele="#c98b63" cabelo="#2b2f3a" roupa="var(--brand)" />
      <Pessoa x={335} y={92} pele="#f1c9a5" cabelo="#8a5a2b" roupa="#e58e6e" />
      <Pessoa x={425} y={128} escala={0.78} pele="#d9a07a" cabelo="#2b2f3a" roupa="#f2c14e" />

      {/* tablet no centro */}
      <g transform="translate(222 176)">
        <rect width="76" height="62" rx="9" fill="#2b2f3a" />
        <rect x="5" y="5" width="66" height="52" rx="5" fill="#ffffff" />
        <rect x="12" y="38" width="9" height="13" rx="2" fill="var(--brand)" />
        <rect x="26" y="28" width="9" height="23" rx="2" fill="var(--chart-2)" />
        <rect x="40" y="20" width="9" height="31" rx="2" fill="var(--brand)" />
        <rect x="54" y="32" width="9" height="19" rx="2" fill="var(--chart-2)" />
        <circle cx="58" cy="16" r="6" fill="#f2c14e" />
      </g>

      {/* moedas */}
      <g>
        <circle cx="140" cy="240" r="9" fill="#f2c14e" />
        <circle cx="158" cy="244" r="9" fill="#e3ad2c" />
        <circle cx="380" cy="240" r="9" fill="#f2c14e" />
      </g>
    </svg>
  );
}

/** Nota fiscal com selo de garantia. */
export function IlustracaoNotas({ className, titulo = "Nota fiscal e garantia" }: Props) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label={titulo} className={className}>
      <title>{titulo}</title>
      <rect width="320" height="240" rx="24" fill="var(--brand)" opacity="0.1" />
      <g transform="translate(86 26) rotate(-4 70 90)">
        <path
          d="M0 0 H140 V178 L128 168 L116 178 L104 168 L92 178 L80 168 L68 178 L56 168 L44 178 L32 168 L20 178 L10 168 L0 178 Z"
          fill="#ffffff"
          stroke="var(--border)"
        />
        <rect x="16" y="18" width="70" height="8" rx="4" fill="var(--brand)" />
        <rect x="16" y="40" width="108" height="6" rx="3" fill="#d9dee6" />
        <rect x="16" y="56" width="92" height="6" rx="3" fill="#d9dee6" />
        <rect x="16" y="72" width="100" height="6" rx="3" fill="#d9dee6" />
        <rect x="16" y="98" width="108" height="1.5" fill="#d9dee6" />
        <rect x="16" y="112" width="50" height="9" rx="4" fill="var(--chart-2)" />
        <rect x="16" y="132" width="34" height="34" rx="4" fill="#2b2f3a" />
        <rect x="21" y="137" width="10" height="10" fill="#fff" />
        <rect x="35" y="137" width="10" height="10" fill="#fff" />
        <rect x="21" y="151" width="10" height="10" fill="#fff" />
        <rect x="35" y="153" width="6" height="6" fill="#fff" />
      </g>
      <g transform="translate(206 120)">
        <path d="M32 0 L62 12 V40 C62 60 48 72 32 80 C16 72 2 60 2 40 V12 Z" fill="var(--chart-2)" />
        <path d="M18 40 L28 50 L48 28" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Calendário com marcadores. */
export function IlustracaoCalendario({ className, titulo = "Calendário com compromissos financeiros" }: Props) {
  const cores = ["var(--brand)", "var(--chart-2)", "#f2c14e", "#e58e6e"];
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label={titulo} className={className}>
      <title>{titulo}</title>
      <rect width="320" height="240" rx="24" fill="var(--chart-2)" opacity="0.12" />
      <rect x="40" y="34" width="240" height="176" rx="16" fill="#fff" stroke="var(--border)" />
      <rect x="40" y="34" width="240" height="40" rx="16" fill="var(--brand)" />
      <rect x="40" y="58" width="240" height="16" fill="var(--brand)" />
      {Array.from({ length: 21 }).map((_, i) => {
        const col = i % 7;
        const lin = Math.floor(i / 7);
        const cx = 66 + col * 31;
        const cy = 98 + lin * 36;
        const marca = [2, 5, 9, 12, 16, 19].includes(i);
        return (
          <g key={i}>
            <rect x={cx - 11} y={cy - 11} width="22" height="22" rx="6" fill={marca ? "#f3f6fb" : "none"} />
            <rect x={cx - 6} y={cy - 3} width="12" height="5" rx="2.5" fill="#d9dee6" />
            {marca && <circle cx={cx} cy={cy + 10} r="3" fill={cores[i % cores.length]} />}
          </g>
        );
      })}
    </svg>
  );
}
