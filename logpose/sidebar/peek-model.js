import { displayUrl } from "./settings-model.js";

export const TOOLBAR_HEIGHT = 44;
export const TOOLBAR_GAP = 6;

export function windowFromHash(hash) {
  const id = Number((hash ?? "").replace(/^#/, "").split("-")[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function toolbarRect(card) {
  return {
    left: card.x,
    top: Math.max(0, card.y - TOOLBAR_HEIGHT - TOOLBAR_GAP),
    width: card.width,
    height: TOOLBAR_HEIGHT,
  };
}

export function pageLabel(peek) {
  const host = displayUrl(peek?.url ?? "", false);
  const title = (peek?.title ?? "").trim();
  return { title: title && title !== peek?.url ? title : host || "Nova página", host };
}

export function peekTabs(pinLive, enabled) {
  if (!enabled) return [];
  return Object.keys(pinLive ?? {}).map(Number).filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
}
