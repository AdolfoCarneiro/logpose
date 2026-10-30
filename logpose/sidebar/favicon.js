import { glyph } from "./kurobe/icons.mjs";

export function faviconFor(url, size = 32) {
  const src = new URL(chrome.runtime.getURL("/_favicon/"));
  src.searchParams.set("pageUrl", url);
  src.searchParams.set("size", String(size));
  return src.toString();
}

// sites com Cross-Origin-Resource-Policy: same-origin (WhatsApp) barram o ícone
// quando a barra pede direto; o cache de ícones do navegador não tem essa trava
export function faviconImg(src, pageUrl, size = 32) {
  const tries = [...new Set([src, /^https?:/.test(pageUrl || "") && faviconFor(pageUrl, size)].filter(Boolean))];
  const globe = () => Object.assign(document.createElement("span"), { className: "k-icon", textContent: glyph("globe") });
  if (!tries.length) return globe();
  const img = Object.assign(document.createElement("img"), { alt: "", src: tries.shift() });
  img.onerror = () => (tries.length ? (img.src = tries.shift()) : img.replaceWith(globe()));
  return img;
}
