import { toItems, toNavigation } from "./tabs-model.js";
import { loadSettings, displayUrl } from "./settings-model.js";
import { glyph } from "./kurobe/icons.mjs";

const list = document.getElementById("tabs");
const pinned = document.getElementById("pinned");
const address = document.getElementById("address");
const menu = document.getElementById("menu");
const themeStyle = document.getElementById("ranga-theme");
let windowId;
let settings = loadSettings();
let themeCss = "";
let activeUrl = "";

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

function iconButton(name, title, onClick) {
  const button = document.createElement("button");
  button.className = "k-icon-button k-icon-button--small k-state";
  button.title = title;
  button.dataset.icon = name;
  button.onclick = (e) => { e.stopPropagation(); onClick(); };
  return button;
}

function favicon(url) {
  const img = document.createElement("img");
  img.src = url || "";
  img.alt = "";
  img.onerror = () => img.replaceWith(Object.assign(document.createElement("span"), { className: "k-icon", textContent: glyph("globe") }));
  return img;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  return tab;
}

function row(item) {
  const li = document.createElement("li");
  li.className = "k-list-item k-state k-type-label" + (item.active ? " k-list-item--active" : "");
  const leading = document.createElement("span");
  leading.className = "k-list-item__leading";
  leading.append(favicon(item.favIconUrl));
  const label = document.createElement("span");
  label.className = "k-list-item__label";
  label.textContent = item.title;
  const trailing = document.createElement("span");
  trailing.className = "k-list-item__trailing";
  trailing.append(iconButton("pin", "Fixar nos favoritos", () => chrome.tabs.update(item.id, { pinned: true })));
  if (settings.showDetachButton) trailing.append(iconButton("external-link", "Destacar", () => chrome.windows.create({ tabId: item.id })));
  trailing.append(iconButton("x", "Fechar", () => chrome.tabs.remove(item.id)));
  li.append(leading, label, trailing);
  li.title = item.url;
  li.onclick = () => chrome.tabs.update(item.id, { active: true });
  li.onauxclick = (e) => { if (e.button === 1) chrome.tabs.remove(item.id); };
  return li;
}

function pin(item) {
  const tile = document.createElement("div");
  tile.className = "pin k-state" + (item.active ? " pin--active" : "");
  tile.title = item.title;
  tile.append(favicon(item.favIconUrl));
  tile.onclick = () => chrome.tabs.update(item.id, { active: true });
  tile.oncontextmenu = (e) => { e.preventDefault(); chrome.tabs.update(item.id, { pinned: false }); };
  return tile;
}

function showAddress() {
  if (document.activeElement === address) return;
  address.value = displayUrl(activeUrl, settings.showFullUrl);
  const secure = activeUrl.startsWith("https://");
  document.getElementById("address-icon").textContent = glyph(secure ? "lock" : "globe");
}

async function render() {
  const tabs = await chrome.tabs.query({ windowId });
  const active = tabs.find((t) => t.active);
  const items = toItems(tabs, active?.id);
  const pins = items.filter((i) => i.pinned);
  pinned.hidden = pins.length === 0;
  pinned.replaceChildren(...pins.map(pin));
  paintIcons(pinned);
  list.replaceChildren(...items.filter((i) => !i.pinned).map(row));
  paintIcons(list);
  activeUrl = active?.url ?? "";
  showAddress();
}

function applySettings() {
  document.body.classList.toggle("compact", settings.density === "compact");
  themeStyle.textContent = settings.followCielTheme ? themeCss : "";
  render();
}

address.addEventListener("focus", () => { address.value = activeUrl; address.select(); });
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
document.getElementById("clear-today").onclick = async () => {
  const tabs = await chrome.tabs.query({ windowId, pinned: false, active: false });
  if (tabs.length) chrome.tabs.remove(tabs.map((t) => t.id));
};

document.getElementById("menu-button").onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
document.addEventListener("click", () => { menu.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") menu.hidden = true; });
for (const item of menu.querySelectorAll("[data-action]")) {
  item.onclick = () => {
    menu.hidden = true;
    const action = item.dataset.action;
    if (action === "ranga-settings") chrome.runtime.openOptionsPage();
    else chrome.tabs.create({ url: action, windowId });
  };
}

for (const ev of ["onCreated", "onRemoved", "onUpdated", "onActivated", "onMoved", "onAttached", "onDetached"]) {
  chrome.tabs[ev].addListener(render);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) {
    settings = loadSettings(changes.settings.newValue);
    applySettings();
  }
});

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => {
  if (msg.type !== "theme") return;
  themeCss = msg.css;
  if (settings.followCielTheme) themeStyle.textContent = themeCss;
});

paintIcons();
windowId = (await chrome.windows.getCurrent()).id;
settings = loadSettings((await chrome.storage.local.get("settings")).settings);
applySettings();
