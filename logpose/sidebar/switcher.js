import { glyph } from "./kurobe/icons.mjs";
import { recentTabs, step } from "./switcher-model.js";
import { painted } from "./motion.js";

const tiles = document.getElementById("tiles");
const caption = document.getElementById("caption");
const themeStyle = document.getElementById("logpose-theme");
const loadedAt = performance.now();
let tabs = [];
let selected = 0;
let open = false;
let pressed = false;
let spaces = { spaces: [], tabSpace: {} };
let currentSpace = null;

function faviconFor(url) {
  const src = new URL(chrome.runtime.getURL("/_favicon/"));
  src.searchParams.set("pageUrl", url);
  src.searchParams.set("size", "64");
  return src.toString();
}

async function close() {
  open = false;
  document.body.classList.add("closed");
  await painted();
  document.title = `logpose-spotlight:close:${Date.now()}`;
}

async function commit() {
  const tab = tabs[selected];
  close();
  if (tab && !tab.active) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }
}

function paint() {
  for (const [i, li] of [...tiles.children].entries()) li.classList.toggle("tile--selected", i === selected);
  const tab = tabs[selected];
  caption.textContent = tab ? tab.title || tab.url : "";
}

function tile(tab, index) {
  const li = document.createElement("li");
  li.className = "tile";
  li.title = tab.url;
  const img = document.createElement("img");
  img.alt = "";
  img.src = faviconFor(tab.url || "");
  img.onerror = () => img.replaceWith(Object.assign(document.createElement("span"), { className: "k-icon glyph", textContent: glyph("globe") }));
  const title = Object.assign(document.createElement("span"), { className: "title k-type-caption", textContent: tab.title || tab.url });
  li.append(img, title);
  const space = spaces.spaces.find((s) => s.id === spaces.tabSpace?.[tab.id]);
  if (space && space.id !== currentSpace) li.append(Object.assign(document.createElement("span"), { className: "k-icon space", textContent: glyph(space.icon), title: space.name }));
  li.onmouseenter = () => { selected = index; paint(); };
  li.onclick = () => { selected = index; commit(); };
  return li;
}

async function start(direction) {
  const win = await chrome.windows.getLastFocused();
  tabs = recentTabs(await chrome.tabs.query({ windowId: win.id }));
  if (tabs.length < 2) return close();
  const stored = await chrome.storage.local.get("spaces");
  spaces = { spaces: stored.spaces?.spaces ?? [], tabSpace: stored.spaces?.tabSpace ?? {} };
  currentSpace = stored.spaces?.active?.[win.id] ?? spaces.spaces[0]?.id ?? null;
  selected = direction > 0 ? 1 : tabs.length - 1;
  tiles.replaceChildren(...tabs.map(tile));
  document.title = "Log Pose";
  document.body.classList.remove("closed");
  open = true;
  pressed = false;
  for (const el of [document.getElementById("card"), document.getElementById("scrim")]) {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }
  paint();
  if (performance.now() - loadedAt < 1500) setTimeout(() => { if (open && !pressed) commit(); }, 700);
}

function route() {
  if (location.hash.startsWith("#idle")) return;
  const direction = location.hash.startsWith("#previous") ? -1 : 1;
  if (open) {
    pressed = true;
    selected = step(selected, tabs.length, direction);
    paint();
  } else {
    start(direction);
  }
}

document.addEventListener("keydown", (e) => {
  pressed = true;
  if (e.key === "Tab" || e.key === "ArrowRight") { e.preventDefault(); selected = step(selected, tabs.length, e.shiftKey && e.key === "Tab" ? -1 : 1); paint(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); selected = step(selected, tabs.length, -1); paint(); }
  else if (e.key === "Enter") { e.preventDefault(); commit(); }
  else if (e.key === "Escape") { e.preventDefault(); close(); }
});
document.addEventListener("keyup", (e) => {
  pressed = true;
  if (e.key === "Control" && open) commit();
});
document.getElementById("scrim").onclick = close;
window.addEventListener("hashchange", route);

const themePort = chrome.runtime.connectNative("logpose.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

route();
