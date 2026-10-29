export function favoritesRoot(tree) {
  return tree?.[0]?.children?.[0] ?? null;
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function entries(folder) {
  const children = folder?.children ?? [];
  const folders = children.filter((c) => !c.url).map((c) => ({ id: c.id, kind: "folder", title: c.title || "Pasta", count: c.children?.length ?? 0 }));
  const links = children.filter((c) => c.url).map((c) => ({ id: c.id, kind: "link", title: c.title || host(c.url), url: c.url }));
  return [...folders, ...links];
}
