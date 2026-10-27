import { mayHaveKeyword, suggestions } from "./spotlight-model.js";
import { displayUrl } from "./settings-model.js";
import { glyph } from "./kurobe/icons.mjs";
import { animate, painted } from "./motion.js";
import { available as rangaPrivate, call } from "./ranga-private.js";
import { containerOf } from "./spaces-model.js";

const LOCAL_COMMANDS = ["copyCleanLink", "copyMarkdown"];
const KIND = { tab: "Aba", bookmark: "Favorito", history: "Histórico", command: "Comando" };
const query = document.getElementById("query");
const results = document.getElementById("results");
const selection = document.getElementById("selection");
const themeStyle = document.getElementById("ranga-theme");
let mode = "new";
let items = [];
let selected = 0;
let target;
let timer;
let commands = [];

function faviconFor(url) {
  const src = new URL(chrome.runtime.getURL("/_favicon/"));
  src.searchParams.set("pageUrl", url);
  src.searchParams.set("size", "32");
  return src.toString();
}

async function close() {
  document.body.classList.add("closed");
  await painted();
  document.title = `ranga-spotlight:close:${Date.now()}`;
}

function moveSelection() {
  const row = results.children[selected];
  if (!row) {
    selection.style.opacity = "0";
    return;
  }
  selection.style.opacity = "1";
  selection.style.transform = `translateY(${row.offsetTop - results.scrollTop}px)`;
  selection.style.height = `${row.offsetHeight}px`;
  for (const [i, li] of [...results.children].entries()) li.classList.toggle("result--selected", i === selected);
  row.scrollIntoView({ block: "nearest" });
}

function row(item, index) {
  const li = document.createElement("li");
  li.className = "k-list-item k-state k-type-label result";
  const leading = document.createElement("span");
  leading.className = "k-list-item__leading";
  if (item.url && item.kind !== "url") {
    const img = document.createElement("img");
    img.alt = "";
    img.src = faviconFor(item.url);
    leading.append(img);
  } else {
    leading.innerHTML = `<span class="k-icon">${glyph(item.icon ?? (item.kind === "search" ? "search" : "globe"))}</span>`;
  }
  const label = document.createElement("span");
  label.className = "k-list-item__label";
  label.textContent = item.title;
  li.append(leading, label);
  if (item.url && item.kind !== "url") {
    const url = document.createElement("span");
    url.className = "url k-type-caption";
    url.textContent = displayUrl(item.url, true).replace(/^https?:\/\/(www\.)?/, "");
    li.append(url);
  }
  if (KIND[item.kind]) {
    const kind = document.createElement("span");
    kind.className = "kind k-type-caption";
    kind.textContent = KIND[item.kind];
    li.append(kind);
  }
  li.onmousemove = () => { if (selected !== index) { selected = index; moveSelection(); } };
  li.onclick = () => run(item);
  return li;
}

async function refresh() {
  const text = query.value;
  const incognito = Boolean(target?.incognito);
  const [tabs, history, bookmarks, resolved] = await Promise.all([
    chrome.tabs.query(incognito ? { windowId: target.windowId } : {}),
    text.trim() && !incognito ? chrome.history.search({ text, maxResults: 25, startTime: 0 }) : [],
    text.trim() && !incognito ? chrome.bookmarks.search(text) : [],
    mayHaveKeyword(text) ? resolve(text) : null,
  ]);
  const others = tabs.filter((t) => t.id !== target?.id && !/^chrome:\/\/newtab\/?$/.test(t.url || ""));
  items = suggestions(text, { tabs: others, history, bookmarks, commands, resolved });
  selected = 0;
  results.replaceChildren(...items.map(row));
  for (const li of results.children) animate(li, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], "effects-default");
  moveSelection();
}

function resolve(text) {
  if (!rangaPrivate || !target) return Promise.resolve(null);
  return call("resolveInput", target.windowId, text).catch(() => null);
}

async function createTab(url) {
  const windowId = target?.windowId;
  const { spaces } = await chrome.storage.local.get("spaces");
  const container = rangaPrivate && spaces?.spaces && !target?.incognito ? containerOf({ active: {}, ...spaces }, windowId) : "";
  if (container) return call("createTab", { windowId, container, url, active: true });
  return (await chrome.tabs.create({ url, windowId })).id;
}

async function run(item) {
  if (!item) return;
  const newTab = mode === "new";
  if (item.kind === "command") {
    await close();
    if (LOCAL_COMMANDS.includes(item.command)) chrome.runtime.sendMessage({ type: "copy-link", format: item.command, tabId: target?.id }).catch(() => {});
    else await call("executeCommand", target?.windowId, item.command).catch(() => {});
    return;
  }
  if (item.kind === "tab") {
    await chrome.tabs.update(item.tabId, { active: true });
    await chrome.windows.update(item.windowId, { focused: true });
  } else if (item.kind === "search") {
    const url = (await resolve(item.text))?.url;
    if (url && (newTab || !target)) await createTab(url);
    else if (url) await chrome.tabs.update(target.id, { url });
    else if (newTab) await chrome.search.query({ text: item.text, tabId: await createTab("about:blank") });
    else await chrome.search.query({ text: item.text, tabId: target?.id });
  } else if (newTab || !target) {
    await createTab(item.url);
  } else {
    await chrome.tabs.update(target.id, { url: item.url });
  }
  close();
}

function blank(url) {
  return !url || /^chrome:\/\/newtab\/?$/.test(url) || url.startsWith(chrome.runtime.getURL("newtab.html"));
}

function showMode() {
  document.getElementById("field-icon").textContent = glyph(mode === "new" ? "plus" : "search");
  const prefix = target?.incognito ? "Anônima: " : mode === "new" ? "Nova aba: " : "";
  query.placeholder = prefix ? `${prefix}buscar ou digitar endereço` : "Buscar ou digitar endereço";
}

async function open() {
  if (location.hash.startsWith("#idle")) return;
  document.title = "Ranga";
  document.body.classList.remove("closed");
  mode = location.hash.startsWith("#current") ? "current" : "new";
  const windowId = Number(location.hash.match(/^#\w+:(\d+)/)?.[1]) || (await chrome.windows.getLastFocused()).id;
  [target] = await chrome.tabs.query({ active: true, windowId });
  const empty = blank(target?.url);
  if (empty) mode = "current";
  commands = rangaPrivate && target ? await call("getEnabledCommands", target.windowId).catch(() => []) : [];
  if (/^https?:/.test(target?.url ?? "")) commands = [...commands, ...LOCAL_COMMANDS];
  showMode();
  query.value = mode === "current" && !empty ? displayUrl(target?.url ?? "", true) : "";
  query.focus();
  query.select();
  for (const el of [document.getElementById("card"), document.getElementById("scrim")]) {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }
  refresh();
}

query.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(refresh, 50);
});
query.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); selected = Math.min(items.length - 1, selected + 1); moveSelection(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); selected = Math.max(0, selected - 1); moveSelection(); }
  else if (e.key === "Enter") { e.preventDefault(); run(items[selected]); }
  else if (e.key === "Escape") { e.preventDefault(); close(); }
});
document.getElementById("scrim").onclick = close;
window.addEventListener("hashchange", open);
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (document.body.classList.contains("closed") || windowId !== target?.windowId || tabId === target?.id) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !blank(tab.pendingUrl || tab.url)) return close();
  target = tab;
  mode = "current";
  showMode();
});

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

open();
