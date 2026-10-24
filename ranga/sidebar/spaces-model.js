export function initialState() {
  return {
    spaces: [{ id: "pessoal", name: "Pessoal", icon: "house", color: null }],
    tabSpace: {},
    active: {},
    lastTab: {},
  };
}

function slug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "espaco";
}

export function createSpace(state, { name, icon, color }) {
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("nome vazio");
  const base = slug(clean);
  let id = base;
  for (let n = 2; state.spaces.some((s) => s.id === id); n++) id = `${base}-${n}`;
  return { ...state, spaces: [...state.spaces, { id, name: clean, icon: icon || "circle", color: color ?? null }] };
}

export function renameSpace(state, id, name) {
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("nome vazio");
  return { ...state, spaces: state.spaces.map((s) => (s.id === id ? { ...s, name: clean } : s)) };
}

export function updateSpace(state, id, patch) {
  return { ...state, spaces: state.spaces.map((s) => (s.id === id ? { ...s, ...patch, id } : s)) };
}

export function deleteSpace(state, id) {
  if (state.spaces.length <= 1) throw new Error("último espaço");
  const spaces = state.spaces.filter((s) => s.id !== id);
  const fallback = spaces[0].id;
  const tabSpace = Object.fromEntries(Object.entries(state.tabSpace).map(([t, s]) => [t, s === id ? fallback : s]));
  const active = Object.fromEntries(Object.entries(state.active).map(([w, s]) => [w, s === id ? fallback : s]));
  const lastTab = { ...state.lastTab };
  delete lastTab[id];
  return { ...state, spaces, tabSpace, active, lastTab };
}

export function assignTab(state, tabId, spaceId) {
  return { ...state, tabSpace: { ...state.tabSpace, [tabId]: spaceId } };
}

export function forgetTab(state, tabId) {
  const tabSpace = { ...state.tabSpace };
  delete tabSpace[tabId];
  return { ...state, tabSpace };
}

export function activeSpace(state, windowId) {
  return state.spaces.find((s) => s.id === state.active[windowId]) ?? state.spaces[0];
}

export function setActive(state, windowId, spaceId) {
  return { ...state, active: { ...state.active, [windowId]: spaceId } };
}

export function spaceOfTab(state, tabId, windowId) {
  const id = state.tabSpace[tabId];
  return state.spaces.some((s) => s.id === id) ? id : activeSpace(state, windowId).id;
}

export function visibleTabs(state, tabs, windowId) {
  const current = activeSpace(state, windowId).id;
  return tabs.filter((t) => spaceOfTab(state, t.id, windowId) === current);
}

export function neighborSpace(state, id, direction) {
  const index = state.spaces.findIndex((s) => s.id === id);
  const n = state.spaces.length;
  return state.spaces[(((index + direction) % n) + n) % n].id;
}

export function rememberTab(state, spaceId, tabId) {
  return { ...state, lastTab: { ...state.lastTab, [spaceId]: tabId } };
}

export function snapshot(state, tabs, windowId) {
  return tabs.map((t) => ({ url: t.url || t.pendingUrl || "", space: spaceOfTab(state, t.id, windowId) }));
}

export function restore(state, tabs, shot) {
  const pending = [...(shot ?? [])];
  let next = state;
  for (const tab of tabs) {
    const url = tab.url || tab.pendingUrl || "";
    const i = pending.findIndex((entry) => entry.url === url);
    if (i < 0) continue;
    next = assignTab(next, tab.id, pending[i].space);
    pending.splice(i, 1);
  }
  return next;
}
