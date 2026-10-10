/**
 * Idiomas do site (2026-10-10).
 *
 * O idioma vem, nesta ordem: o que o usuário escolheu e está salvo na conta,
 * o que ficou guardado no navegador, o idioma do próprio navegador (que o
 * aparelho define pelo país) e, por último, português do Brasil.
 */
export const IDIOMAS = [
  { codigo: "pt-BR", nome: "Português (Brasil)", nomeEmIngles: "Portuguese", bandeira: "🇧🇷", dir: "ltr" },
  { codigo: "en", nome: "English", nomeEmIngles: "English", bandeira: "🇺🇸", dir: "ltr" },
  { codigo: "es", nome: "Español", nomeEmIngles: "Spanish", bandeira: "🇪🇸", dir: "ltr" },
  { codigo: "hi", nome: "हिन्दी", nomeEmIngles: "Hindi", bandeira: "🇮🇳", dir: "ltr" },
  { codigo: "fr", nome: "Français", nomeEmIngles: "French", bandeira: "🇫🇷", dir: "ltr" },
  { codigo: "de", nome: "Deutsch", nomeEmIngles: "German", bandeira: "🇩🇪", dir: "ltr" },
  { codigo: "it", nome: "Italiano", nomeEmIngles: "Italian", bandeira: "🇮🇹", dir: "ltr" },
  { codigo: "zh", nome: "中文", nomeEmIngles: "Chinese", bandeira: "🇨🇳", dir: "ltr" },
  { codigo: "ar", nome: "العربية", nomeEmIngles: "Arabic", bandeira: "🇸🇦", dir: "rtl" },
] as const;

export type Idioma = (typeof IDIOMAS)[number]["codigo"];

export const IDIOMA_PADRAO: Idioma = "pt-BR";

export function idiomaValido(valor: unknown): Idioma | null {
  return IDIOMAS.some((i) => i.codigo === valor) ? (valor as Idioma) : null;
}

export function infoIdioma(codigo: Idioma) {
  return IDIOMAS.find((i) => i.codigo === codigo) ?? IDIOMAS[0];
}

/** Moeda e formato de data continuam em português do Brasil: os dados são em reais. */
export function direcaoDoIdioma(codigo: Idioma): "ltr" | "rtl" {
  return infoIdioma(codigo).dir;
}

/**
 * Melhor palpite a partir do navegador (que segue a configuração de país do
 * aparelho). "pt" de Portugal também cai em português.
 */
export function idiomaDoNavegador(): Idioma {
  if (typeof navigator === "undefined") return IDIOMA_PADRAO;
  const candidatos = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const bruto of candidatos) {
    const baixo = String(bruto).toLowerCase();
    if (baixo.startsWith("pt")) return "pt-BR";
    const exato = IDIOMAS.find((i) => i.codigo !== "pt-BR" && baixo.startsWith(i.codigo));
    if (exato) return exato.codigo;
  }
  return IDIOMA_PADRAO;
}
