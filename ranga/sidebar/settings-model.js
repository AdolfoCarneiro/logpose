export const DEFAULTS = Object.freeze({
  followCielTheme: true,
  density: "comfortable",
  showFullUrl: false,
  showDetachButton: true,
});

const CHOICES = { density: ["comfortable", "compact"] };

export function loadSettings(stored) {
  const settings = { ...DEFAULTS };
  for (const [key, value] of Object.entries(stored ?? {})) {
    if (!(key in DEFAULTS) || typeof value !== typeof DEFAULTS[key]) continue;
    if (CHOICES[key] && !CHOICES[key].includes(value)) continue;
    settings[key] = value;
  }
  return settings;
}

export function displayUrl(url, full) {
  if (!url || full) return url ?? "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.hostname.replace(/^www\./, "");
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return url;
  }
}
