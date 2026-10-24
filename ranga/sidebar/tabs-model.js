export function toItems(tabs, activeTabId) {
  return [...tabs]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.index - b.index)
    .map((t) => ({
      id: t.id,
      title: t.title || t.url,
      url: t.url,
      favIconUrl: t.favIconUrl || "",
      active: t.id === activeTabId,
      pinned: Boolean(t.pinned),
    }));
}

export function toNavigation(input) {
  const text = input.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return { kind: "url", url: text };
  if (/^localhost(:\d+)?(\/|$)/i.test(text)) return { kind: "url", url: `http://${text}` };
  if (!/\s/.test(text) && /^[^/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(text)) return { kind: "url", url: `https://${text}` };
  return { kind: "search", text };
}
