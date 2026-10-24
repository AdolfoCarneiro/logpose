import { rangaUrl } from "./settings-model.js";

export function toItems(tabs, activeTabId) {
  return [...tabs]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.index - b.index)
    .map((t) => ({
      id: t.id,
      title: rangaUrl(t.title || t.url || t.pendingUrl || ""),
      url: t.url || t.pendingUrl || "",
      favIconUrl: t.favIconUrl || "",
      active: t.id === activeTabId,
      pinned: Boolean(t.pinned),
      loading: t.status === "loading",
      asleep: Boolean(t.discarded),
      audio: t.mutedInfo?.muted ? "muted" : t.audible ? "playing" : "",
      split: t.splitViewId > 0 ? t.splitViewId : null,
    }));
}

const RANGA_PAGES = { "configurações": "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html", "configuracoes": "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html" };

export function toNavigation(input) {
  const text = input.trim();
  const ranga = /^ranga:\/\/([^/?#]*)(.*)$/i.exec(text);
  if (ranga) return { kind: "url", url: RANGA_PAGES[ranga[1].toLowerCase()] ?? `chrome://${ranga[1]}${ranga[2]}` };
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
