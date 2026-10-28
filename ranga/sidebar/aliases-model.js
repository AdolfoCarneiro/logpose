export const SCOPES = { tabs: "Abas", bookmarks: "Favoritos", history: "Histórico" };

export const DEFAULT_ALIASES = Object.freeze([
  { alias: "a", scope: "tabs" },
  { alias: "f", scope: "bookmarks" },
  { alias: "h", scope: "history" },
  { alias: "yt", name: "YouTube", url: "https://www.youtube.com/results?search_query=%s" },
  { alias: "gg", name: "Google", url: "https://www.google.com/search?q=%s" },
  { alias: "dg", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s" },
]);

const ALIAS = /^[\p{L}\d]{1,8}$/u;

function siteUrl(url) {
  try {
    return typeof url === "string" && url.includes("%s") && /^https?:$/.test(new URL(url.replace("%s", "x")).protocol);
  } catch {
    return false;
  }
}

export function validAlias(entry) {
  if (!entry || typeof entry.alias !== "string" || !ALIAS.test(entry.alias)) return false;
  if (entry.scope) return entry.scope in SCOPES;
  return typeof entry.name === "string" && Boolean(entry.name.trim()) && siteUrl(entry.url);
}

export function loadAliases(stored) {
  if (!Array.isArray(stored)) return DEFAULT_ALIASES.map((a) => ({ ...a }));
  const seen = new Set();
  return stored.filter((a) => {
    if (!validAlias(a) || seen.has(a.alias.toLowerCase())) return false;
    seen.add(a.alias.toLowerCase());
    return true;
  });
}

export function findAlias(aliases, word) {
  const key = (word ?? "").toLowerCase();
  return aliases.find((a) => a.alias.toLowerCase() === key) ?? null;
}

export function parseAlias(value, aliases) {
  const match = /^(\S+)\s+(.*)$/s.exec(value ?? "");
  const alias = match && findAlias(aliases, match[1]);
  return alias ? { alias, rest: match[2] } : null;
}

export function aliasName(alias) {
  return alias.scope ? SCOPES[alias.scope] : alias.name;
}

export function aliasUrl(alias, text) {
  return alias.url.replace("%s", encodeURIComponent(text.trim()));
}
