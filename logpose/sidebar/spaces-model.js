export function initialState() {
  return {
    spaces: [{ id: "pessoal", name: "Pessoal", icon: "house", color: null, session: "" }],
    tabSpace: {},
    tabTitle: {},
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
  return { ...state, spaces: [...state.spaces, { id, name: clean, icon: icon || "circle", color: color ?? null, session: id }] };
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
  const tabTitle = { ...state.tabTitle };
  delete tabSpace[tabId];
  delete tabTitle[tabId];
  return { ...state, tabSpace, tabTitle };
}

export function setTitle(state, tabId, title) {
  const tabTitle = { ...state.tabTitle };
  const clean = (title ?? "").trim();
  if (clean) tabTitle[tabId] = clean;
  else delete tabTitle[tabId];
  return { ...state, tabTitle };
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

function urlOf(tab) {
  return tab.url || tab.pendingUrl || "";
}

function entriesOf(shot) {
  return Array.isArray(shot) ? shot : shot?.tabs ?? [];
}

export function snapshot(state, tabs, windowId) {
  return {
    active: activeSpace(state, windowId).id,
    tabs: tabs.map((t) => ({ url: urlOf(t), space: spaceOfTab(state, t.id, windowId), ...(state.tabTitle?.[t.id] ? { title: state.tabTitle[t.id] } : {}) })),
  };
}

export function storeSnapshot(stored, windowId, shot, now = Date.now()) {
  const all = stored && !Array.isArray(stored) ? { ...stored } : {};
  all[windowId] = { ...shot, at: now };
  return Object.fromEntries(Object.entries(all).sort(([, a], [, b]) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 6));
}

export function pickSnapshot(stored, tabs) {
  const candidates = Array.isArray(stored) ? [["", { tabs: stored }]] : Object.entries(stored ?? {});
  let best = null;
  let score = 0;
  for (const [key, shot] of candidates) {
    const urls = entriesOf(shot).map((e) => e.url);
    const hits = tabs.filter((t) => urls.includes(urlOf(t))).length;
    if (hits > score) {
      best = { key, shot };
      score = hits;
    }
  }
  return best;
}

export function forgetSnapshot(stored, key) {
  if (!stored || Array.isArray(stored)) return {};
  const all = { ...stored };
  delete all[key];
  return all;
}

function place(state, tabId, entry) {
  const next = assignTab(state, tabId, entry.space);
  return entry.title ? setTitle(next, tabId, entry.title) : next;
}

export function restore(state, tabs, shot) {
  const pending = [...entriesOf(shot)];
  const unmatched = [];
  let next = state;
  for (const tab of tabs) {
    const i = pending.findIndex((entry) => entry.url === urlOf(tab));
    if (i < 0) {
      unmatched.push(tab);
      continue;
    }
    next = place(next, tab.id, pending[i]);
    pending.splice(i, 1);
  }
  if (unmatched.length === pending.length) unmatched.forEach((tab, i) => { next = place(next, tab.id, pending[i]); });
  return next;
}

export function reopenedSpace(state, tabs, shot) {
  const active = tabs.find((t) => t.active);
  const id = (active && state.tabSpace[active.id]) || shot?.active;
  return state.spaces.some((s) => s.id === id) ? id : state.spaces[0].id;
}

export function withSessions(state) {
  return {
    ...state,
    spaces: state.spaces.map(({ container, ...space }, i) => (typeof space.session === "string" ? space : { ...space, session: i === 0 ? "" : container || space.id })),
  };
}

export function sessionOfSpace(state, spaceId) {
  return state.spaces.find((s) => s.id === spaceId)?.session ?? "";
}

export function sessionOf(state, windowId) {
  return activeSpace(state, windowId).session ?? "";
}
