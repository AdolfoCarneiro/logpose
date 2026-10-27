import { glyph } from "./kurobe/icons.mjs";
import { painted } from "./motion.js";
import { call } from "./ranga-private.js";

const card = document.getElementById("card");
const text = document.getElementById("text");
const count = document.getElementById("count");
const matchCase = document.getElementById("case");
const themeStyle = document.getElementById("ranga-theme");
let windowId;
let timer;

for (const el of document.querySelectorAll("[data-icon]")) {
  const icon = el.classList.contains("k-icon") ? el : el.appendChild(Object.assign(document.createElement("span"), { className: "k-icon" }));
  icon.textContent = glyph(el.dataset.icon);
}

function show(result) {
  card.classList.remove("card--empty");
  if (!text.value) {
    count.textContent = "";
    return;
  }
  if (!result.matches) {
    count.textContent = "Nenhum";
    void card.offsetWidth;
    card.classList.add("card--empty");
    return;
  }
  count.textContent = `${result.active} de ${result.matches}`;
}

async function search(forward = true) {
  clearTimeout(timer);
  try {
    localStorage.setItem("ranga-find", text.value);
  } catch {}
  show(await call("find", windowId, text.value, forward, matchCase.getAttribute("aria-pressed") === "true").catch(() => ({ matches: 0, active: 0 })));
}

async function close() {
  count.textContent = "";
  card.classList.remove("card--empty");
  await call("stopFinding", windowId).catch(() => {});
  document.body.classList.add("closed");
  await painted();
  document.title = `ranga-spotlight:close:${Date.now()}`;
}

async function open() {
  if (location.hash.startsWith("#idle")) return;
  windowId = (await chrome.windows.getLastFocused()).id;
  const mode = location.hash.slice(1).split("-")[0];
  if (!text.value) {
    try {
      text.value = localStorage.getItem("ranga-find") ?? "";
    } catch {}
  }
  document.title = "Ranga";
  document.body.classList.remove("closed");
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "";
  text.focus();
  text.select();
  if (text.value) search(mode !== "previous");
}

text.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => search(true), 90);
});
text.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); search(!e.shiftKey); }
  else if (e.key === "Escape") { e.preventDefault(); close(); }
  else if (e.key.toLowerCase() === "g" && e.ctrlKey) { e.preventDefault(); search(!e.shiftKey); }
});
document.getElementById("next").onclick = () => search(true);
document.getElementById("previous").onclick = () => search(false);
document.getElementById("close").onclick = close;
matchCase.onclick = () => {
  matchCase.setAttribute("aria-pressed", String(matchCase.getAttribute("aria-pressed") !== "true"));
  search(true);
};
window.addEventListener("hashchange", open);
chrome.tabs.onActivated.addListener(({ windowId: w }) => { if (w === windowId && document.title === "Ranga") close(); });
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url && tab.active && tab.windowId === windowId && document.title === "Ranga") close(); });

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

open();
