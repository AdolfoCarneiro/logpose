const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${UNITS[unit]}`;
}

export function fileName(item) {
  const path = item.filename || item.finalUrl || item.url || "";
  return path.split(/[\\/]/).filter(Boolean).pop() || "download";
}

export function progress(item) {
  if (item.state === "complete") return 1;
  if (!(item.totalBytes > 0)) return null;
  return Math.min(1, item.bytesReceived / item.totalBytes);
}

export function status(item) {
  if (item.state === "complete") return formatBytes(item.totalBytes || item.fileSize || item.bytesReceived);
  if (item.state === "interrupted") return item.error === "USER_CANCELED" ? "Cancelado" : "Falhou";
  const got = formatBytes(item.bytesReceived);
  if (item.paused) return `Pausado · ${got}`;
  return item.totalBytes > 0 ? `${got} de ${formatBytes(item.totalBytes)}` : got;
}

export function active(items) {
  return items.filter((i) => i.state === "in_progress");
}

export function overall(items) {
  const running = active(items).filter((i) => i.totalBytes > 0);
  if (!running.length) return null;
  const total = running.reduce((n, i) => n + i.totalBytes, 0);
  const got = running.reduce((n, i) => n + i.bytesReceived, 0);
  return Math.min(1, got / total);
}
