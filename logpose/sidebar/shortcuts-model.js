export const SHORTCUTS = [
  { command: "newTab", title: "Nova aba", hint: "Abre a busca; a aba nasce ao escolher um resultado", keys: "Ctrl+T" },
  { command: "openLocation", title: "Buscar ou trocar o endereço da aba", keys: "Ctrl+L" },
  { command: "copyUrl", title: "Copiar o link da aba", keys: "Ctrl+Shift+C" },
  { command: "copyMarkdown", title: "Copiar o link como Markdown", keys: "Ctrl+Alt+Shift+C" },
  { command: "pinTab", title: "Fixar ou desafixar a aba", hint: "Na seção Fixadas", keys: "Ctrl+D" },
  { command: "splitView", title: "Dividir tela com a aba anterior", hint: "De novo desfaz a divisão", keys: "Ctrl+Shift+D" },
  { command: "toggleSidebar", title: "Recolher ou fixar a barra lateral", hint: "Recolhida, ela volta flutuando ao encostar o mouse na borda da janela", keys: "Ctrl+Shift+S" },
  { command: "spaceNext", title: "Próximo espaço", keys: "Ctrl+Shift+Right" },
  { command: "spacePrevious", title: "Espaço anterior", keys: "Ctrl+Shift+Left" },
  { command: "clearToday", title: "Limpar as abas de Hoje", hint: "Arquiva as abas de Hoje do espaço, menos a atual", keys: "" },
  { command: "archive", title: "Abrir as arquivadas", keys: "" },
  { command: "settings", title: "Configurações", keys: "Ctrl+," },
];

const NAMED = {
  ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down",
  Space: "Space", Tab: "Tab", Enter: "Enter", Escape: "Escape", Backspace: "Backspace", Delete: "Delete",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'",
  Backquote: "`", Backslash: "\\", Comma: ",", Period: ".", Slash: "/",
};

function keyOf(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return NAMED[code] ?? null;
}

export function fromEvent(e) {
  const key = keyOf(e.code);
  if (!key) return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Super"].filter(Boolean);
  if (!/^F\d/.test(key) && !mods.some((m) => m !== "Shift")) return null;
  return [...mods, key].join("+");
}

export function current(stored = {}) {
  return SHORTCUTS.map((s) => ({ ...s, keys: Object.hasOwn(stored, s.command) ? stored[s.command] : s.keys }));
}

export function assign(stored = {}, command, keys) {
  const next = { ...stored, [command]: keys };
  if (!keys) return next;
  for (const s of current(stored)) {
    if (s.command !== command && s.keys === keys) next[s.command] = "";
  }
  return next;
}

export function reset(stored = {}, command) {
  const next = { ...stored };
  delete next[command];
  const keys = SHORTCUTS.find((s) => s.command === command)?.keys;
  return keys ? assign(next, command, keys) : next;
}

export function toMap(stored = {}) {
  return Object.fromEntries(current(stored).filter((s) => s.keys).map((s) => [s.keys, s.command]));
}

const SYMBOLS = { Left: "←", Right: "→", Up: "↑", Down: "↓" };

export function label(keys) {
  if (!keys) return [];
  const parts = keys.split("+");
  return parts.map((p, i) => (i === parts.length - 1 ? SYMBOLS[p] ?? p : p));
}
