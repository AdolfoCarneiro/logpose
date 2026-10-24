import { toNavigation } from "./tabs-model.js";

export const COMMANDS = [
  { command: "installPwa", title: "Instalar como app", icon: "app-window", words: "pwa aplicativo install" },
  { command: "openInApp", title: "Abrir no app", icon: "app-window", words: "pwa aplicativo" },
  { command: "createShortcut", title: "Criar atalho", icon: "external-link", words: "shortcut desktop app" },
  { command: "copyCleanLink", title: "Copiar link limpo", icon: "link", words: "url copiar rastreamento utm" },
  { command: "copyMarkdown", title: "Copiar como Markdown", icon: "file-text", words: "link markdown copiar" },
  { command: "print", title: "Imprimir", icon: "printer", words: "print pdf" },
  { command: "find", title: "Procurar na página", icon: "text-search", words: "localizar buscar find" },
  { command: "zoomIn", title: "Aumentar zoom", icon: "zoom-in", words: "zoom mais ampliar" },
  { command: "zoomOut", title: "Diminuir zoom", icon: "zoom-out", words: "zoom menos reduzir" },
  { command: "zoomReset", title: "Zoom padrão", icon: "search", words: "zoom normal 100" },
  { command: "savePage", title: "Salvar página", icon: "download", words: "save baixar" },
  { command: "viewSource", title: "Ver código-fonte", icon: "code", words: "source html" },
  { command: "devTools", title: "Ferramentas de desenvolvedor", icon: "code-xml", words: "devtools inspecionar console" },
  { command: "taskManager", title: "Gerenciador de tarefas", icon: "activity", words: "memoria processos task" },
  { command: "clearBrowsingData", title: "Limpar dados de navegação", icon: "trash-2", words: "cache cookies historico" },
];

function fold(text) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function matchCommands(query, enabled = []) {
  const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length || terms.join(" ").length < 2) return [];
  return COMMANDS
    .filter((c) => enabled.includes(c.command))
    .filter((c) => {
      const words = fold(`${c.title} ${c.words}`).split(/[\s-]+/);
      return terms.every((t) => words.some((w) => w.startsWith(t)));
    })
    .map(({ words: _, ...c }) => {
      const query = terms.join(" ");
      const title = fold(c.title);
      const strong = title.startsWith(query) || (query.length >= 4 && title.split(/[\s-]+/).some((w) => w.startsWith(terms[0])) && terms.every((t) => title.includes(t)));
      return { kind: "command", ...c, strong };
    });
}

function matches(entry, q) {
  return `${entry.title ?? ""} ${entry.url ?? ""}`.toLowerCase().includes(q);
}

function score(entry, q, base) {
  const title = (entry.title ?? "").toLowerCase();
  const starts = title.startsWith(q) || title.includes(` ${q}`) ? 2 : 0;
  return base + starts + Math.min(entry.visitCount ?? 0, 50) / 50;
}

export function suggestions(query, { tabs = [], bookmarks = [], history = [], commands = [] }, limit = 8) {
  const text = query.trim();
  const q = text.toLowerCase();
  if (!q) return tabs.slice(0, limit).map((t) => ({ kind: "tab", title: t.title || t.url, url: t.url, tabId: t.id, windowId: t.windowId }));
  const nav = toNavigation(text);
  const first = nav.kind === "url"
    ? { kind: "url", title: nav.url, url: nav.url }
    : { kind: "search", title: `Buscar “${text}”`, text };
  const pool = [
    ...tabs.filter((t) => matches(t, q)).map((t) => ({ kind: "tab", title: t.title || t.url, url: t.url, tabId: t.id, windowId: t.windowId, score: score(t, q, 6) })),
    ...bookmarks.filter((b) => b.url && matches(b, q)).map((b) => ({ kind: "bookmark", title: b.title || b.url, url: b.url, score: score(b, q, 4) })),
    ...history.filter((h) => matches(h, q)).map((h) => ({ kind: "history", title: h.title || h.url, url: h.url, score: score(h, q, 2) })),
  ].sort((a, b) => b.score - a.score);
  const seen = new Set();
  const rest = [];
  for (const entry of pool) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    const { score: _, ...clean } = entry;
    rest.push(clean);
  }
  const found = nav.kind === "url" ? [] : matchCommands(text, commands).slice(0, 3);
  const head = found[0]?.strong ? [found[0], first, ...found.slice(1)] : [first, ...found];
  return [...head.map(({ strong: _, ...c }) => c), ...rest].slice(0, limit);
}
