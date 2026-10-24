import { toItems, toNavigation } from "./tabs-model.js";
import { loadSettings, displayUrl } from "./settings-model.js";
import {
  initialState, createSpace, renameSpace, deleteSpace, assignTab, forgetTab,
  visibleTabs, setActive, activeSpace, neighborSpace, rememberTab, updateSpace, snapshot, restore, spaceOfTab,
} from "./spaces-model.js";
import { glyph } from "./kurobe/icons.mjs";
import { createTabList } from "./tab-list.js";
import { showMenu } from "./context-menu.js";
import { setupFavorites } from "./favorites.js";
import { animate, pop } from "./motion.js";
import { toast } from "./toast.js";
import { setupArchive } from "./archive.js";
import { archiveEntry, pushArchive } from "./lifecycle-model.js";
import { setupExtensions } from "./extensions.js";
import { setupContainers } from "./containers.js";
import { setupDownloads } from "./downloads.js";
import { available as rangaPrivate, call } from "./ranga-private.js";

const SPACE_ICONS = ["house", "briefcase", "code", "book-open", "music", "gamepad-2", "heart", "star", "palette"];
const SPACE_COLORS = [null, "#71b1ec", "#7cc2a8", "#d9c08a", "#d49a78", "#d8737a", "#b59ad4"];

const pinned = document.getElementById("pinned");
const address = document.getElementById("address");
const menu = document.getElementById("menu");
const spaceBar = document.getElementById("spaces");
const spaceTitle = document.getElementById("space-title");
const spaceMenu = document.getElementById("space-menu");
const spaceForm = document.getElementById("space-form");
const themeStyle = document.getElementById("ranga-theme");
const content = document.getElementById("space-content");
let windowId;
let settings = loadSettings();
let spaces = initialState();
let themeCss = "";
let activeUrl = "";
let menuSpaceId = null;
let lastWheel = 0;
const containers = setupContainers({ windowId: () => windowId });

function paintIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) {
    if (!el.classList.contains("k-icon") && !el.querySelector(".k-icon")) {
      const icon = document.createElement("span");
      icon.className = "k-icon";
      el.append(icon);
    }
    (el.classList.contains("k-icon") ? el : el.querySelector(".k-icon")).textContent = glyph(el.dataset.icon);
  }
}

async function saveSpaces() {
  const { spaces: list, active, lastTab, tabSpace } = spaces;
  const tabs = await chrome.tabs.query({ windowId });
  await chrome.storage.local.set({
    spaces: { spaces: list, active, lastTab, tabSpace },
    spaceSnapshot: snapshot(spaces, tabs, windowId),
  });
  await containers.save(tabs);
}

async function moveTabToSpace(tabId, spaceId) {
  spaces = assignTab(spaces, tabId, spaceId);
  await saveSpaces();
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  return tab;
}

async function reopenInContainer(item, container) {
  const space = spaceOfTab(spaces, item.id, windowId);
  const id = await containers.reopen(await chrome.tabs.get(item.id), container);
  await moveTabToSpace(id, space);
  render();
}

function containerEntries(item) {
  if (!containers.available) return [];
  const current = item.container?.id ?? "";
  return [
    "divider",
    ...containers.list().filter((c) => c.id !== current).map((c) => ({
      icon: c.icon,
      label: `Abrir no container ${c.name}`,
      action: () => reopenInContainer(item, c.id),
    })),
    ...(current ? [{ icon: "log-out", label: "Tirar do container", action: () => reopenInContainer(item, "") }] : []),
  ];
}

function splitEntries(item) {
  if (item.split) return [{ icon: "panels-left-right", label: "Desfazer divisão", action: () => chrome.tabs.unsplit(item.split) }];
  if (item.active || !chrome.tabs.createSplit) return [];
  return [{
    icon: "columns-2",
    label: "Dividir tela com a aba atual",
    action: async () => {
      const current = await activeTab();
      if (!current || current.splitViewId > 0 || current.pinned !== item.pinned) return;
      const tab = await chrome.tabs.get(item.id);
      const index = tab.index < current.index ? current.index : current.index + 1;
      await chrome.tabs.move(item.id, { index });
      await chrome.tabs.createSplit([current.id, item.id]).catch(() => toast("Não deu pra dividir essas abas"));
    },
  }];
}

function tabMenu(item, x, y) {
  const current = activeSpace(spaces, windowId).id;
  const others = spaces.spaces.filter((s) => s.id !== current);
  showMenu([
    item.pinned
      ? { icon: "pin-off", label: "Desafixar", action: () => chrome.tabs.update(item.id, { pinned: false }) }
      : { icon: "pin", label: "Fixar", action: () => chrome.tabs.update(item.id, { pinned: true }) },
    { icon: "external-link", label: "Destacar em janela", action: () => chrome.windows.create({ tabId: item.id }) },
    ...splitEntries(item),
    { icon: "copy", label: "Duplicar", action: () => chrome.tabs.duplicate(item.id) },
    { icon: "link", label: "Copiar link", action: () => navigator.clipboard.writeText(item.url) },
    { icon: "rotate-cw", label: "Recarregar", action: () => chrome.tabs.reload(item.id) },
    ...(item.audio === "muted" ? [{ icon: "volume-2", label: "Ativar som", action: () => chrome.tabs.update(item.id, { muted: false }) }] : []),
    ...(item.audio === "playing" ? [{ icon: "volume-x", label: "Silenciar", action: () => chrome.tabs.update(item.id, { muted: true }) }] : []),
    ...containerEntries(item),
    ...(others.length ? ["divider", ...others.map((space) => ({
      icon: space.icon,
      label: `Mover para o espaço ${space.name}`,
      action: async () => {
        await moveTabToSpace(item.id, space.id);
        if (item.active) {
          const rest = visibleTabs(spaces, await chrome.tabs.query({ windowId }), windowId);
          if (rest.length) await chrome.tabs.update(rest[0].id, { active: true });
          else await chrome.tabs.create({ windowId });
        }
        render();
      },
    }))] : []),
    "divider",
    { icon: "x", label: "Fechar", danger: true, action: () => chrome.tabs.remove(item.id) },
  ], x, y);
}

const tabList = createTabList({
  list: document.getElementById("tabs"),
  indicator: document.getElementById("active-indicator"),
  onActivate: (id) => chrome.tabs.update(id, { active: true }),
  onClose: (id) => chrome.tabs.remove(id),
  onContextMenu: tabMenu,
  onMove: async (id, target) => {
    const { index } = await chrome.tabs.get(target.id);
    await chrome.tabs.move(id, { index });
  },
});

function favicon(url) {
  const img = document.createElement("img");
  img.src = url || "";
  img.alt = "";
  img.onerror = () => img.replaceWith(Object.assign(document.createElement("span"), { className: "k-icon", textContent: glyph("globe") }));
  return img;
}

function pin(item) {
  const tile = document.createElement("div");
  tile.className = "pin k-state" + (item.active ? " pin--active" : "") + (item.asleep ? " pin--asleep" : "");
  tile.title = item.container ? `${item.container.name} · ${item.title}` : item.title;
  if (item.container) {
    tile.classList.add("pin--contained");
    tile.style.setProperty("--container-color", item.container.color);
  }
  if (item.loading) {
    const loader = document.createElement("k-loading-indicator");
    loader.setAttribute("size", "22");
    tile.append(loader);
  } else {
    tile.append(favicon(item.favIconUrl));
  }
  tile.onclick = () => { pop(tile); chrome.tabs.update(item.id, { active: true }); };
  tile.oncontextmenu = (e) => { e.preventDefault(); tabMenu(item, e.clientX, e.clientY); };
  return tile;
}

function showAddress() {
  if (document.activeElement === address) return;
  address.value = displayUrl(activeUrl, settings.showFullUrl);
  document.getElementById("address-icon").textContent = glyph(activeUrl.startsWith("https://") ? "lock" : "globe");
}

function applySpaceColor() {
  const space = activeSpace(spaces, windowId);
  for (const role of ["primary", "secondary"]) {
    if (space.color) document.body.style.setProperty(`--k-color-${role}`, space.color);
    else document.body.style.removeProperty(`--k-color-${role}`);
  }
}

function renderSpaces() {
  const current = activeSpace(spaces, windowId);
  spaceTitle.querySelector(".k-icon").textContent = glyph(current.icon);
  spaceTitle.querySelector(".name").textContent = current.name;
  const buttons = spaces.spaces.map((space) => {
    const button = document.createElement("button");
    button.className = "space k-state" + (space.id === current.id ? " space--active" : "");
    button.title = space.name;
    button.dataset.icon = space.icon;
    if (space.color) button.style.setProperty("--space-color", space.color);
    button.onclick = () => switchSpace(space.id, Math.sign(spaces.spaces.indexOf(space) - spaces.spaces.indexOf(current)));
    button.oncontextmenu = (e) => { e.preventDefault(); openSpaceMenu(space.id, button); };
    return button;
  });
  const add = document.createElement("button");
  add.className = "space space--add k-state";
  add.title = "Novo espaço";
  add.dataset.icon = "plus";
  add.onclick = (e) => { e.stopPropagation(); openSpaceForm(); };
  spaceBar.replaceChildren(...buttons, add);
  paintIcons(spaceBar);
  applySpaceColor();
}

async function render() {
  const tabs = await chrome.tabs.query({ windowId });
  await containers.load();
  const visible = visibleTabs(spaces, tabs, windowId);
  const active = tabs.find((t) => t.active);
  const items = toItems(visible, active?.id).map((i) => ({ ...i, container: containers.of(i.id) }));
  const pins = items.filter((i) => i.pinned);
  pinned.hidden = pins.length === 0;
  pinned.replaceChildren(...pins.map(pin));
  paintIcons(pinned);
  tabList.render(items.filter((i) => !i.pinned));
  activeUrl = active?.url || active?.pendingUrl || "";
  showAddress();
  renderSpaces();
  extensions.refresh();
}

async function switchSpace(spaceId, direction = 0) {
  const current = activeSpace(spaces, windowId).id;
  if (spaceId === current) return;
  const active = await activeTab();
  if (active) spaces = rememberTab(spaces, current, active.id);
  spaces = setActive(spaces, windowId, spaceId);
  await saveSpaces();
  const tabs = await chrome.tabs.query({ windowId });
  const visible = visibleTabs(spaces, tabs, windowId);
  const target = visible.find((t) => t.id === spaces.lastTab[spaceId]) ?? visible[0];
  if (target) await chrome.tabs.update(target.id, { active: true });
  else await chrome.tabs.create({ windowId });
  if (direction) animate(content, [{ opacity: 0, transform: `translateX(${direction * 36}px)` }, { opacity: 1, transform: "none" }], "spatial-default");
  render();
}

function openSpaceMenu(spaceId, anchor) {
  menuSpaceId = spaceId;
  const rect = anchor.getBoundingClientRect();
  spaceMenu.style.left = `${Math.max(8, rect.left)}px`;
  spaceMenu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  spaceMenu.hidden = false;
}

function openSpaceForm(space = null) {
  spaceForm.dataset.editing = space?.id ?? "";
  spaceForm.querySelector("input[name=name]").value = space?.name ?? "";
  const icons = spaceForm.querySelector(".icons");
  icons.replaceChildren(...SPACE_ICONS.map((name) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice k-state";
    b.dataset.icon = name;
    b.dataset.value = name;
    b.setAttribute("aria-pressed", String(name === (space?.icon ?? SPACE_ICONS[0])));
    b.onclick = () => { for (const x of icons.children) x.setAttribute("aria-pressed", String(x === b)); pop(b); };
    return b;
  }));
  const colors = spaceForm.querySelector(".colors");
  colors.replaceChildren(...SPACE_COLORS.map((color) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch k-state" + (color ? "" : " swatch--theme");
    b.title = color ? color : "Cor do tema do Ciel";
    if (color) b.style.background = color;
    b.dataset.value = color ?? "";
    b.setAttribute("aria-pressed", String(color === (space?.color ?? null)));
    b.onclick = () => { for (const x of colors.children) x.setAttribute("aria-pressed", String(x === b)); pop(b); };
    return b;
  }));
  paintIcons(spaceForm);
  spaceForm.hidden = false;
  spaceForm.querySelector("input[name=name]").focus();
}

spaceForm.addEventListener("click", (e) => e.stopPropagation());
spaceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = spaceForm.querySelector("input[name=name]").value;
  const icon = spaceForm.querySelector(".icons [aria-pressed=true]")?.dataset.value;
  const color = spaceForm.querySelector(".colors [aria-pressed=true]")?.dataset.value || null;
  try {
    const editing = spaceForm.dataset.editing;
    if (editing) {
      spaces = renameSpace(spaces, editing, name);
      spaces = updateSpace(spaces, editing, { icon, color });
      await saveSpaces();
      render();
    } else {
      spaces = createSpace(spaces, { name, icon, color });
      await saveSpaces();
      await switchSpace(spaces.spaces.at(-1).id, 1);
    }
    spaceForm.hidden = true;
  } catch {
    spaceForm.querySelector("input[name=name]").focus();
  }
});
document.getElementById("space-cancel").onclick = () => { spaceForm.hidden = true; };

for (const item of spaceMenu.querySelectorAll("[data-space-action]")) {
  item.onclick = async () => {
    spaceMenu.hidden = true;
    const space = spaces.spaces.find((s) => s.id === menuSpaceId);
    if (!space) return;
    if (item.dataset.spaceAction === "edit") openSpaceForm(space);
    if (item.dataset.spaceAction === "delete" && spaces.spaces.length > 1) {
      spaces = deleteSpace(spaces, space.id);
      await saveSpaces();
      render();
    }
  };
}

address.addEventListener("focus", () => { address.value = displayUrl(activeUrl, true); address.select(); });
address.addEventListener("blur", showAddress);
address.addEventListener("keydown", async (e) => {
  if (e.key === "Escape") { address.blur(); return; }
  if (e.key !== "Enter") return;
  const nav = toNavigation(address.value);
  const tab = await activeTab();
  if (nav.kind === "url") chrome.tabs.update(tab.id, { url: nav.url });
  else chrome.search.query({ text: nav.text, tabId: tab.id });
  address.blur();
});

document.getElementById("back").onclick = async () => chrome.tabs.goBack((await activeTab()).id);
document.getElementById("forward").onclick = async () => chrome.tabs.goForward((await activeTab()).id);
document.getElementById("reload").onclick = async () => chrome.tabs.reload((await activeTab()).id);
document.getElementById("new-tab").onclick = () => chrome.tabs.create({ windowId });
document.getElementById("new-tab").oncontextmenu = (e) => {
  e.preventDefault();
  if (!containers.available) return;
  showMenu(containers.list().map((c) => ({
    icon: c.icon,
    label: `Nova aba no container ${c.name}`,
    action: () => containers.open({ container: c.id }),
  })), e.clientX, e.clientY);
};
async function reopen(entries) {
  for (const entry of entries) {
    const tab = await chrome.tabs.create({ url: entry.url, windowId, active: false });
    await moveTabToSpace(tab.id, spaces.spaces.some((s) => s.id === entry.space) ? entry.space : activeSpace(spaces, windowId).id);
  }
  render();
}

async function archiveTabs(tabs, reason) {
  const now = Date.now();
  const entries = tabs.filter((t) => /^https?:\/\//.test(t.url || "")).map((t) => archiveEntry(t, spaceOfTab(spaces, t.id, windowId), now));
  const { archive } = await chrome.storage.local.get("archive");
  await chrome.storage.local.set({ archive: pushArchive(archive, entries), lastArchived: { at: now, reason, windowId, entries } });
  await chrome.tabs.remove(tabs.map((t) => t.id));
}

document.getElementById("clear-today").onclick = async () => {
  const tabs = visibleTabs(spaces, await chrome.tabs.query({ windowId, pinned: false, active: false }), windowId);
  if (tabs.length) archiveTabs(tabs, "clear");
};

const archivePanel = setupArchive({ popover: document.getElementById("archive-popover"), reopen });

function announceArchived(info) {
  const count = info.entries.length;
  if (!count || (info.windowId && info.windowId !== windowId)) return;
  toast(count === 1 ? "1 aba arquivada" : `${count} abas arquivadas`, {
    label: "Desfazer",
    run: async () => {
      await reopen(info.entries);
      const { archive = [] } = await chrome.storage.local.get("archive");
      const urls = new Set(info.entries.map((e) => `${e.url}|${e.archivedAt}`));
      await chrome.storage.local.set({ archive: archive.filter((e) => !urls.has(`${e.url}|${e.archivedAt}`)) });
    },
  });
}

document.getElementById("menu-button").onclick = async (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  if (menu.hidden || !rangaPrivate) return;
  const enabled = await call("getEnabledCommands", windowId).catch(() => []);
  menu.querySelector("[data-action=ranga-install-pwa]").hidden = !enabled.includes("installPwa");
};
document.addEventListener("click", () => { menu.hidden = true; spaceMenu.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu.hidden = true; spaceMenu.hidden = true; spaceForm.hidden = true; } });
for (const item of menu.querySelectorAll("[data-action]")) {
  item.onclick = () => {
    menu.hidden = true;
    const action = item.dataset.action;
    if (action === "ranga-settings") chrome.runtime.openOptionsPage();
    else if (action === "ranga-archive") archivePanel.open();
    else if (action === "ranga-install-pwa") call("executeCommand", windowId, "installPwa").catch(() => {});
    else chrome.tabs.create({ url: action, windowId });
  };
}

const extensions = setupExtensions({
  bar: document.getElementById("extensions"),
  button: document.getElementById("extensions-button"),
  popover: document.getElementById("extensions-popover"),
  windowId: () => windowId,
});

setupDownloads({
  button: document.getElementById("downloads-button"),
  popover: document.getElementById("downloads-popover"),
  windowId: () => windowId,
});

setupFavorites({
  button: document.getElementById("favorites-button"),
  popover: document.getElementById("favorites-popover"),
  activeTab,
  windowId: () => windowId,
});

document.addEventListener("wheel", (e) => {
  const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
  if (!sideways || Date.now() - lastWheel < 350) return;
  lastWheel = Date.now();
  const direction = sideways > 0 ? 1 : -1;
  switchSpace(neighborSpace(spaces, activeSpace(spaces, windowId).id, direction), direction);
}, { passive: true });

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.windowId === windowId && !spaces.tabSpace[tab.id]) await moveTabToSpace(tab.id, activeSpace(spaces, windowId).id);
  render();
});
chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  spaces = forgetTab(spaces, tabId);
  if (info.windowId === windowId && !info.isWindowClosing) await saveSpaces();
  render();
});
chrome.tabs.onActivated.addListener(async ({ tabId, windowId: w }) => {
  if (w === windowId) {
    const space = spaceOfTab(spaces, tabId, windowId);
    if (space !== activeSpace(spaces, windowId).id) {
      spaces = setActive(spaces, windowId, space);
      await saveSpaces();
    }
  }
  render();
});
for (const ev of ["onUpdated", "onMoved", "onAttached", "onDetached"]) chrome.tabs[ev].addListener(render);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "space-step" && msg.windowId === windowId) {
    const direction = msg.direction;
    switchSpace(neighborSpace(spaces, activeSpace(spaces, windowId).id, direction), direction);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.settings) {
    settings = loadSettings(changes.settings.newValue);
    applySettings();
  }
  if (changes.lastArchived?.newValue) announceArchived(changes.lastArchived.newValue);
  if (changes.containers) render();
  if (changes.spaces?.newValue) {
    const saved = changes.spaces.newValue;
    spaces = {
      ...spaces,
      spaces: saved.spaces,
      active: { ...saved.active, [windowId]: spaces.active[windowId] ?? saved.active[windowId] },
      lastTab: saved.lastTab,
      tabSpace: { ...saved.tabSpace, ...spaces.tabSpace },
    };
    render();
  }
});

function applySettings() {
  document.body.classList.toggle("compact", settings.density === "compact");
  themeStyle.textContent = settings.followCielTheme ? themeCss : "";
  render();
}

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => {
  if (msg.type !== "theme") return;
  themeCss = msg.css;
  if (settings.followCielTheme) themeStyle.textContent = themeCss;
});

if (!(await chrome.alarms.get("ranga-lifecycle"))) chrome.alarms.create("ranga-lifecycle", { periodInMinutes: 1 });
paintIcons();
windowId = (await chrome.windows.getCurrent()).id;
settings = loadSettings((await chrome.storage.local.get("settings")).settings);
const stored = await chrome.storage.local.get(["spaces", "spaceSnapshot"]);
if (stored.spaces?.spaces?.length) spaces = { ...initialState(), ...stored.spaces, tabSpace: stored.spaces.tabSpace ?? {} };
const windowTabs = await chrome.tabs.query({ windowId });
if (!windowTabs.some((t) => spaces.tabSpace[t.id])) spaces = restore({ ...spaces, tabSpace: {} }, windowTabs, stored.spaceSnapshot);
for (const tab of windowTabs) {
  if (!spaces.tabSpace[tab.id]) spaces = assignTab(spaces, tab.id, activeSpace(spaces, windowId).id);
}
for (const { from, to } of await containers.heal(windowTabs)) {
  spaces = assignTab(spaces, to, spaceOfTab(spaces, from, windowId));
}
await saveSpaces();
for (const tab of windowTabs) {
  if (/^chrome:\/\/newtab\/?$/.test(tab.url || "") && tab.title !== "Nova aba") chrome.tabs.update(tab.id, { url: "chrome://newtab/" });
}
applySettings();
