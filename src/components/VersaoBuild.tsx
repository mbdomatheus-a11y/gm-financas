// Substituídos em tempo de build pelo `define` em vite.config.ts.
declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;

/**
 * Selo fixo no topo da tela com o commit/hash com que este build foi
 * compilado. Existe só pra dar pra conferir visualmente, sem adivinhar, se
 * o site que você está testando já reflete o último `git push` — antes
 * disso, um "não funcionou ainda" podia tanto ser um bug de verdade quanto
 * o navegador ainda rodando um build antigo.
 *
 * "-dev" no final do hash quer dizer que havia mudanças não commitadas no
 * repositório no momento do build (ex. rodou `bun run dev` sem commitar
 * antes). "sem-git" aparece só se o build rodou num lugar sem `.git`
 * disponível (não deveria acontecer no seu ambiente normal).
 */
export function VersaoBuild() {
  const dataFormatada = new Date(__APP_BUILD_TIME__).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-center">
      <span className="pointer-events-auto select-text rounded-b-md bg-foreground/80 px-2 py-0.5 font-mono text-[10px] leading-none text-background shadow-sm">
        build {__APP_VERSION__} · {dataFormatada}
      </span>
    </div>
  );
}
