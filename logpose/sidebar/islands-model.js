export const ISLAND_COLORS = {
  blue: "#71b1ec", green: "#7cc2a8", yellow: "#d9c08a", orange: "#d49a78", red: "#d8737a",
  purple: "#b59ad4", cyan: "#7cc4cf", pink: "#d98cb3", grey: "#a4a8b0",
};
export const ISLAND_ORDER = ["blue", "green", "yellow", "orange", "red", "purple", "cyan", "pink", "grey"];
export const COLOR_NAMES = {
  blue: "azul", green: "verde", yellow: "amarela", orange: "laranja", red: "vermelha",
  purple: "roxa", cyan: "ciano", pink: "rosa", grey: "cinza",
};

export function nextColor(groups) {
  const used = new Set(groups.map((g) => g.color));
  return ISLAND_ORDER.find((c) => !used.has(c)) ?? ISLAND_ORDER[groups.length % ISLAND_ORDER.length];
}

export function islandLabel(group) {
  return group.title?.trim() || `Ilha ${COLOR_NAMES[group.color] ?? ""}`.trim();
}

export function islandEdges(items) {
  return items.map((item, i) => {
    if (item.group == null) return "";
    const first = items[i - 1]?.group !== item.group;
    const last = items[i + 1]?.group !== item.group;
    return first && last ? "only" : first ? "first" : last ? "last" : "middle";
  });
}

export function visibleItems(items, collapsed) {
  return items.filter((i) => i.group == null || !collapsed.has(i.group));
}

export function neighborOutside(items, groupId, activeId) {
  const at = items.findIndex((i) => i.id === activeId);
  const outside = (i) => i.group !== groupId;
  return items.slice(at + 1).find(outside)?.id ?? items.slice(0, Math.max(at, 0)).findLast(outside)?.id ?? null;
}

export function dropTarget(items, from, to) {
  const order = [...items];
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item);
  const above = order[to - 1];
  const below = order[to + 1];
  if (above?.group != null && above.group === below?.group) return { join: above.group };
  if (item.group != null && (above?.group === item.group || below?.group === item.group)) return { join: item.group };
  return { join: null };
}

export function strayTabs(tabs, spaceOf) {
  const byGroup = new Map();
  for (const tab of tabs) {
    if (!(tab.groupId > 0)) continue;
    byGroup.set(tab.groupId, [...(byGroup.get(tab.groupId) ?? []), tab]);
  }
  const strays = [];
  for (const members of byGroup.values()) {
    const counts = new Map();
    for (const tab of members) counts.set(spaceOf(tab.id), (counts.get(spaceOf(tab.id)) ?? 0) + 1);
    let home = spaceOf(members[0].id);
    for (const [space, n] of counts) if (n > counts.get(home)) home = space;
    strays.push(...members.filter((t) => spaceOf(t.id) !== home).map((t) => t.id));
  }
  return strays;
}
