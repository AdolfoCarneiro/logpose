import { suggestions } from "./spotlight-model.js";
import { displayUrl } from "./settings-model.js";
import { glyph } from "./kurobe/icons.mjs";
import { animate } from "./motion.js";
import { available as rangaPrivate, call } from "./ranga-private.js";

const LOCAL_COMMANDS = ["copyCleanLink", "copyMarkdown"];
const KIND = { tab: "Aba", bookmark: "Favorito", history: "Histórico", command: "Comando" };
const query = document.getElementById("query");
const results = document.getElementById("results");
const selection = document.getElementById("selection");
const themeStyle = document.getElementById("ranga-theme");
const page = document.body.classList.contains("page");
let mode = page ? "current" : "new";
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

function close() {
  if (page) return;
  document.title = `ranga-spotlight:close:${Date.now()}`;
  window.close();
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
  const [tabs, history, bookmarks] = await Promise.all([
    chrome.tabs.query({}),
    text.trim() ? chrome.history.search({ text, maxResults: 25, startTime: 0 }) : [],
    text.trim() ? chrome.bookmarks.search(text) : [],
  ]);
  const others = tabs.filter((t) => t.id !== target?.id && !/^chrome:\/\/newtab\/?$/.test(t.url || ""));
  items = suggestions(text, { tabs: others, history, bookmarks, commands });
  selected = 0;
  results.replaceChildren(...items.map(row));
  for (const li of results.children) animate(li, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], "effects-default");
  moveSelection();
}

async function run(item) {
  if (!item) return;
  const newTab = mode === "new";
  if (item.kind === "command") {
    close();
    if (LOCAL_COMMANDS.includes(item.command)) chrome.runtime.sendMessage({ type: "copy-link", format: item.command, tabId: target?.id }).catch(() => {});
    else await call("executeCommand", target?.windowId, item.command).catch(() => {});
    return;
  }
  if (item.kind === "tab") {
    await chrome.tabs.update(item.tabId, { active: true });
    await chrome.windows.update(item.windowId, { focused: true });
  } else if (item.kind === "search") {
    if (newTab) await chrome.search.query({ text: item.text, disposition: "NEW_TAB" });
    else await chrome.search.query({ text: item.text, tabId: target?.id });
  } else if (newTab || !target) {
    await chrome.tabs.create({ url: item.url, windowId: target?.windowId });
  } else {
    await chrome.tabs.update(target.id, { url: item.url });
  }
  close();
}

async function open() {
  if (page) {
    target = await chrome.tabs.getCurrent();
  } else {
    document.title = "Ranga";
    mode = location.hash.startsWith("#current") ? "current" : "new";
    const win = await chrome.windows.getLastFocused();
    [target] = await chrome.tabs.query({ active: true, windowId: win.id });
  }
  commands = rangaPrivate && target ? await call("getEnabledCommands", target.windowId).catch(() => []) : [];
  if (/^https?:/.test(target?.url ?? "")) commands = [...commands, ...LOCAL_COMMANDS];
  document.getElementById("field-icon").textContent = glyph(mode === "new" && !page ? "plus" : "search");
  query.placeholder = mode === "new" ? "Nova aba: buscar ou digitar endereço" : "Buscar ou digitar endereço";
  query.value = mode === "current" && !page ? displayUrl(target?.url ?? "", true) : "";
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

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

open();
