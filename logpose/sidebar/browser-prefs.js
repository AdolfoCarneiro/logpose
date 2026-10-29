export function typed(type, raw) {
  if (type === "boolean") return raw === "true";
  if (type === "number") return Number(raw);
  return raw;
}

export function shown(value) {
  return String(value);
}
