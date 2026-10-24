export const CONTAINER_COLORS = ["#71b1ec", "#7cc2a8", "#d9c08a", "#d49a78", "#d8737a", "#b59ad4"];
export const CONTAINER_ICONS = ["briefcase", "user", "shopping-cart", "landmark", "gamepad-2", "heart", "fingerprint", "graduation-cap"];
export const DEFAULT_CONTAINERS = Object.freeze([
  { id: "trabalho", name: "Trabalho", color: "#71b1ec", icon: "briefcase" },
  { id: "pessoal", name: "Pessoal", color: "#7cc2a8", icon: "user" },
]);

const ID = /^[a-z0-9-]{1,40}$/;

function valid(c) {
  return c && ID.test(c.id) && typeof c.name === "string" && c.name.trim() && typeof c.color === "string" && typeof c.icon === "string";
}

export function loadContainers(stored) {
  if (!Array.isArray(stored)) return DEFAULT_CONTAINERS.map((c) => ({ ...c }));
  return stored.filter(valid);
}

export function slug(name) {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "container";
}

export function createContainer(list, { name, color, icon }) {
  const clean = (name ?? "").trim().slice(0, 32);
  if (!clean) throw new Error("nome vazio");
  const base = slug(clean);
  let id = base;
  for (let n = 2; list.some((c) => c.id === id); n++) id = `${base}-${n}`;
  return [...list, { id, name: clean, color: color ?? CONTAINER_COLORS[list.length % CONTAINER_COLORS.length], icon: icon ?? CONTAINER_ICONS[0] }];
}

export function updateContainer(list, id, patch) {
  return list.map((c) => {
    if (c.id !== id) return c;
    const name = patch.name === undefined ? c.name : patch.name.trim().slice(0, 32);
    return { ...c, ...patch, name: name || c.name, id: c.id };
  });
}

export function deleteContainer(list, id) {
  return list.filter((c) => c.id !== id);
}

export function membership(entries) {
  return new Map((entries ?? []).filter((e) => e.container).map((e) => [e.tabId, e.container]));
}

export function containerSnapshot(tabs, members) {
  return [...tabs].sort((a, b) => a.index - b.index).map((t) => ({ url: t.url || t.pendingUrl || "", container: members.get(t.id) ?? "" }));
}

export function lostTabs(shot, tabs, members, known) {
  const pending = [...(shot ?? [])];
  const lost = [];
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    const url = tab.url || tab.pendingUrl || "";
    const i = pending.findIndex((entry) => entry.url === url);
    if (i < 0) continue;
    const { container } = pending[i];
    pending.splice(i, 1);
    if (!container || members.has(tab.id) || !known.some((c) => c.id === container)) continue;
    lost.push({ tabId: tab.id, url, index: tab.index, active: tab.active, pinned: tab.pinned, container });
  }
  return lost;
}
