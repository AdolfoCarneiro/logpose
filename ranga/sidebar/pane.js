import { glyph } from "./kurobe/icons.mjs";
import { call } from "./ranga-private.js";
import { dropTab } from "./split-drop.js";

const card = document.getElementById("card");
const grip = document.getElementById("grip");
const themeStyle = document.getElementById("ranga-theme");
const ZONES = "left,right,top,bottom,window";
let tabId;
let windowId;
let drag = null;

for (const el of document.querySelectorAll("[data-icon]")) {
  el.append(Object.assign(document.createElement("span"), { className: "k-icon", textContent: glyph(el.dataset.icon) }));
}

function open() {
  const match = /^#tab:(\d+):(\d+)/.exec(location.hash);
  if (!match) return;
  tabId = Number(match[1]);
  windowId = Number(match[2]);
  document.body.classList.remove("closed");
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "";
}

async function splitOf(id) {
  const tab = await chrome.tabs.get(id).catch(() => null);
  return tab?.splitViewId > 0 ? tab.splitViewId : null;
}

document.getElementById("separate").onclick = async () => {
  const split = await splitOf(tabId);
  if (split) chrome.tabs.unsplit(split);
};
document.getElementById("close").onclick = () => chrome.tabs.remove(tabId);

grip.onpointerdown = (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, frame: 0 };
  document.body.classList.add("dragging");
  splitOf(tabId).then(async (split) => {
    const partner = split ? (await chrome.tabs.query({ windowId })).find((t) => t.splitViewId === split && t.id !== tabId) : null;
    chrome.storage.session.set({ tabDrag: { tab: tabId, partner: partner?.id ?? null } });
  });
};
grip.onpointermove = (e) => {
  if (!drag) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  drag.frame ||= requestAnimationFrame(() => {
    if (!drag) return;
    drag.frame = 0;
    call("dragTab", windowId, Math.round(drag.x), Math.round(drag.y), ZONES).catch(() => {});
  });
};
async function finish(e) {
  const done = drag;
  drag = null;
  if (!done) return;
  cancelAnimationFrame(done.frame);
  document.body.classList.remove("dragging");
  const zone = e.type === "pointerup" ? await call("dragTab", windowId, Math.round(e.clientX), Math.round(e.clientY), ZONES).catch(() => "") : "";
  await call("endTabDrag", windowId).catch(() => {});
  chrome.storage.session.remove("tabDrag");
  if (zone) await dropTab(windowId, tabId, zone, await splitOf(tabId));
}
grip.onpointerup = finish;
grip.onpointercancel = finish;

window.addEventListener("hashchange", open);
const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });
open();
