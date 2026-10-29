export const MAX_TILES = 9;

export function recentTabs(tabs, limit = MAX_TILES) {
  return [...tabs]
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    .slice(0, limit);
}

export function step(index, length, direction) {
  if (!length) return 0;
  return (index + direction + length) % length;
}
