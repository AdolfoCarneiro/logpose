export const DEFAULTS = Object.freeze({
  followSystemTheme: true,
  density: "comfortable",
  showFullUrl: false,
  materialOpacity: 82,
  sleepAfterMinutes: 30,
  archiveAfterHours: 12,
  peekPinnedLinks: true,
  littleWindowLinks: true,
  miniPlayer: true,
  autoPip: true,
  newtabNews: true,
  newtabCards: true,
  newtabMarket: true,
  marketTickers: "",
  privateSearchEngine: "",
});

const CHOICES = {
  density: ["comfortable", "compact"],
  sleepAfterMinutes: [0, 15, 30, 60, 120],
  archiveAfterHours: [0, 12, 24, 168],
};
const RANGES = { materialOpacity: [0, 100] };

export function loadSettings(stored) {
  const settings = { ...DEFAULTS };
  const { followCielTheme, ...rest } = stored ?? {};
  const renamed = typeof followCielTheme === "boolean" ? { followSystemTheme: followCielTheme, ...rest } : rest;
  for (const [key, value] of Object.entries(renamed)) {
    if (!(key in DEFAULTS) || typeof value !== typeof DEFAULTS[key]) continue;
    if (CHOICES[key] && !CHOICES[key].includes(value)) continue;
    if (RANGES[key] && (!Number.isInteger(value) || value < RANGES[key][0] || value > RANGES[key][1])) continue;
    settings[key] = value;
  }
  return settings;
}

const OWN = "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/";
const PAGES = { "settings.html": "configurações", "onboarding.html": "bem-vindo" };

export function logposeUrl(url) {
  if (url.startsWith(OWN)) {
    const page = url.slice(OWN.length).split(/[?#]/)[0];
    return `logpose://${PAGES[page] ?? page.replace(/\.html$/, "")}`;
  }
  return url.replace(/^chrome:\/\//, "logpose://");
}

export function displayUrl(url, full) {
  if (!url || /^chrome:\/\/newtab\/?$/.test(url) || url.startsWith(`${OWN}newtab.html`)) return "";
  if (url.startsWith(OWN) || url.startsWith("chrome://")) {
    const logpose = logposeUrl(url);
    return full ? logpose : logpose.replace(/^(logpose:\/\/[^/?#]+).*$/, "$1");
  }
  if (full) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.hostname.replace(/^www\./, "");
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return url;
  }
}

const MAIN_LANGUAGES = { "pt-BR": ["pt-BR", "pt"], "en-US": ["en-US", "en"] };

export function mainLanguage(accept) {
  const top = String(accept ?? "").split(",")[0]?.trim() ?? "";
  return Object.keys(MAIN_LANGUAGES).find((code) => MAIN_LANGUAGES[code].includes(top)) ?? top;
}

export function withMainLanguage(accept, code) {
  const first = MAIN_LANGUAGES[code] ?? [code];
  const rest = String(accept ?? "").split(",").map((l) => l.trim()).filter((l) => l && !first.includes(l));
  return [...first, ...rest].join(",");
}
