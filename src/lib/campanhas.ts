/** Links de campanha (2026-10-17): utm_source/medium/campaign padronizados para medir cada post. */
export function slugCampanha(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function gerarLinkCampanha(p: { campanha: string; destino: string; origem: string; base?: string }): string {
  const base = (p.base ?? "https://www.controlall.com.br").replace(/\/+$/, "");
  const url = new URL(base + (p.destino.startsWith("/") ? p.destino : `/${p.destino}`));
  url.searchParams.set("utm_source", p.origem === "instagram" ? "ig" : p.origem);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", slugCampanha(p.campanha));
  return url.toString();
}
