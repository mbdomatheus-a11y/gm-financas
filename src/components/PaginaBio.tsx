import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";

import { escolhaPrivacidade, metricasPermitidas } from "@/components/AvisoPrivacidade";
import { registrarVisitaBio } from "@/lib/bio.functions";
import { origemAcesso, sessaoAcesso } from "@/lib/funil-cliente";

/** Página de links da bio (19/11/2026). Visual único para /bio e /bio/<nome>. */
export function PaginaBio({ p }: { p: { slug: string; titulo: string; bio: string; foto: string | null; links: { id: string; titulo: string; icone?: string | null }[] } }) {
  const registrar = useServerFn(registrarVisitaBio);
  const [m, setM] = useState(false);
  const [extra, setExtra] = useState("");

  useEffect(() => {
    // Espera a resposta ao aviso de privacidade (até 20 s). Sem resposta, conta só a visita, sem dados.
    let feito = false;
    const inicio = Date.now();
    const enviar = () => {
      if (feito) return;
      feito = true;
      const metricas = metricasPermitidas();
      setM(metricas);
      const { sessao } = sessaoAcesso();
      const origem = origemAcesso();
      let referrer: string | null = null;
      try {
        if (document.referrer) {
          const r = new URL(document.referrer);
          referrer = r.host === window.location.host ? null : r.host + r.pathname.slice(0, 80);
        }
      } catch {
        referrer = null;
      }
      const q = new URLSearchParams();
      if (metricas) {
        if (sessao) q.set("s", sessao);
        if (referrer) q.set("r", referrer);
        if (origem.utmSource) q.set("us", origem.utmSource);
        if (origem.utmMedium) q.set("um", origem.utmMedium);
        if (origem.utmCampaign) q.set("uc", origem.utmCampaign);
      }
      setExtra(q.toString() ? `&${q.toString()}` : "");
      void registrar({
        data: { slug: p.slug, metricas, referrer, sessao, utmSource: origem.utmSource, utmMedium: origem.utmMedium, utmCampaign: origem.utmCampaign },
      }).catch(() => {});
    };
    if (escolhaPrivacidade() !== null) {
      enviar();
      return;
    }
    const t = setInterval(() => {
      if (escolhaPrivacidade() !== null || Date.now() - inicio > 20_000) {
        clearInterval(t);
        enviar();
      }
    }, 800);
    return () => clearInterval(t);
  }, [p.slug, registrar]);

  return (
    <main className="min-h-dvh bg-[radial-gradient(120%_80%_at_50%_0%,#1e293b_0%,#0b1120_60%,#05070d_100%)] px-5 pb-28 pt-14 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        {p.foto ? (
          <img src={p.foto} alt="" className="size-24 rounded-full object-cover ring-4 ring-white/15" />
        ) : (
          <div className="grid size-24 place-items-center rounded-full bg-white/10 text-3xl font-bold">
            {(p.titulo || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        {p.titulo && <h1 className="mt-4 text-xl font-bold tracking-tight">{p.titulo}</h1>}
        {p.bio && <p className="mt-1.5 max-w-sm whitespace-pre-line text-sm text-white/70">{p.bio}</p>}
        <ul className="mt-8 w-full space-y-3">
          {p.links.map((l) => (
            <li key={l.id}>
              <a
                href={`/api/bio-ir?l=${l.id}&m=${m ? 1 : 0}${extra}`}
                rel="noopener"
                className="group relative flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-14 py-3.5 text-[15px] font-semibold backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {l.icone && (
                  <img src={l.icone} alt="" className="absolute left-2.5 size-10 rounded-xl bg-white object-cover" loading="lazy" />
                )}
                <span className="truncate">{l.titulo}</span>
                <ArrowUpRight className="absolute right-4 size-4 shrink-0 opacity-60 transition group-hover:opacity-100" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <a href="/privacidade" className="mt-10 text-xs text-white/40 hover:text-white/70">
          Privacidade
        </a>
      </div>
    </main>
  );
}
