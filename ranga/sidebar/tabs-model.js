import { rangaUrl } from "./settings-model.js";

const RANGA_ORIGIN = "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/";

export function faviconOf(tab) {
  const url = tab.url || tab.pendingUrl || "";
  if (!url.startsWith("chrome-extension://") || url.startsWith(RANGA_ORIGIN)) return tab.favIconUrl || "";
  return `${RANGA_ORIGIN}_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
}

export function toItems(tabs, activeTabId, nameOf = () => "") {
  return [...tabs]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.index - b.index)
    .map((t) => ({
      id: t.id,
      title: nameOf(t) || rangaUrl(t.title || t.url || t.pendingUrl || ""),
      url: t.url || t.pendingUrl || "",
      favIconUrl: faviconOf(t),
      active: t.id === activeTabId,
      pinned: Boolean(t.pinned),
      loading: t.status === "loading",
      asleep: Boolean(t.discarded),
      audio: t.mutedInfo?.muted ? "muted" : t.audible ? "playing" : "",
      split: t.splitViewId > 0 ? t.splitViewId : null,
    }));
}

const SETTINGS_PAGE = "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html";
const RANGA_PAGES = { "configurações": SETTINGS_PAGE, "configuracoes": SETTINGS_PAGE, settings: SETTINGS_PAGE };

export function toNavigation(input) {
  const text = input.trim();
  const ranga = /^ranga:\/\/([^/?#]*)(.*)$/i.exec(text);
  if (ranga) return { kind: "url", url: (!/^\/./.test(ranga[2]) && RANGA_PAGES[ranga[1].toLowerCase()]) || `chrome://${ranga[1]}${ranga[2]}` };
  if (/^chrome:\/\/settings\/?$/i.test(text)) return { kind: "url", url: SETTINGS_PAGE };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return { kind: "url", url: text };
  if (/^localhost(:\d+)?(\/|$)/i.test(text)) return { kind: "url", url: `http://${text}` };
  if (!/\s/.test(text) && /^[^/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(text)) return { kind: "url", url: `https://${text}` };
  return { kind: "search", text };
}

export function splitEdges(items) {
  return items.map((item, i) => {
    if (!item.split) return "";
    const first = items[i - 1]?.split !== item.split;
    const last = items[i + 1]?.split !== item.split;
    return first && last ? "" : first ? "first" : last ? "last" : "middle";
  });
}
