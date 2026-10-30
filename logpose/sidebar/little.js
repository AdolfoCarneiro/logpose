import { glyph } from "./kurobe/icons.mjs";
import "./kurobe/loading-indicator.mjs";
import { pop } from "./motion.js";
import { call } from "./logpose-private.js";
import { faviconImg } from "./favicon.js";
import { windowFromHash, pageLabel } from "./peek-model.js";

const leading = document.getElementById("leading");
const title = document.getElementById("title");
const host = document.getElementById("host");
const main = document.getElementById("main");
const themeStyle = document.getElementById("logpose-theme");
let windowId = null;

for (const el of document.querySelectorAll("[data-icon]")) {
  const icon = el.classList.contains("k-icon") ? el : el.appendChild(Object.assign(document.createElement("span"), { className: "k-icon" }));
  icon.textContent = glyph(el.dataset.icon);
}

function paintLeading(tab) {
  const url = tab.url || tab.pendingUrl || "";
  const loading = tab.status === "loading";
  const key = loading ? "loading" : tab.favIconUrl || url;
  if (leading.dataset.key === key) return;
  const wasLoading = leading.dataset.key === "loading";
  leading.dataset.key = key;
  if (loading) {
    const loader = document.createElement("k-loading-indicator");
    loader.setAttribute("size", "18");
    leading.replaceChildren(loader);
    return;
  }
  leading.replaceChildren(faviconImg(tab.favIconUrl, url));
  if (wasLoading) pop(leading);
}

function paint(tab) {
  const url = tab.url || tab.pendingUrl || "";
  const label = pageLabel({ url, title: tab.title });
  title.textContent = label.title;
  host.textContent = label.host === label.title ? "" : label.host;
  document.getElementById("bar").title = url;
  paintLeading(tab);
}

async function refresh() {
  windowId = windowFromHash(location.hash);
  if (windowId == null) return;
  const [tab] = await chrome.tabs.query({ windowId, active: true });
  if (tab) paint(tab);
}

main.onclick = async () => {
  if (windowId == null) return;
  main.disabled = true;
  await call("openInMainWindow", windowId).catch(() => { main.disabled = false; });
};
document.getElementById("close").onclick = () => {
  if (windowId != null) chrome.windows.remove(windowId).catch(() => {});
};
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (tab.windowId === windowId && tab.active) paint(tab); });
chrome.tabs.onActivated.addListener(({ windowId: w }) => { if (w === windowId) refresh(); });
window.addEventListener("hashchange", refresh);

const themePort = chrome.runtime.connectNative("logpose.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

refresh();
