/**
 * Copia um texto inteiro para a área de transferência, de qualquer tamanho.
 * Usa a API moderna e, se ela falhar (comum no iPhone com textos grandes), cai para
 * o método clássico com um campo de texto escondido.
 */
export async function copiarTextoCompleto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // tenta o método clássico abaixo
  }
  try {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.top = "0";
    campo.style.left = "0";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.focus();
    campo.select();
    campo.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}
