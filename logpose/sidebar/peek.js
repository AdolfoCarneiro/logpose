import { glyph } from "./kurobe/icons.mjs";
import "./kurobe/loading-indicator.mjs";
import { animate, painted, reducedMotion, spring } from "./motion.js";
import { call } from "./logpose-private.js";
import { faviconImg } from "./favicon.js";
import { windowFromHash, toolbarRect, pageLabel } from "./peek-model.js";

const scrim = document.getElementById("scrim");
const ghost = document.getElementById("ghost");
const toolbar = document.getElementById("toolbar");
const leading = document.getElementById("leading");
const title = document.getElementById("title");
const host = document.getElementById("host");
const themeStyle = document.getElementById("logpose-theme");
let windowId = null;
let generation = 0;
let showing = false;
let promoting = false;
let card = null;
const SCRIM = "rgb(0 0 0 / 0.36)";

for (const el of document.querySelectorAll("[data-icon]")) {
  const icon = el.classList.contains("k-icon") ? el : el.appendChild(Object.assign(document.createElement("span"), { className: "k-icon" }));
  icon.textContent = glyph(el.dataset.icon);
}

function place(rect, el) {
  el.style.left = `${rect.left ?? rect.x}px`;
  el.style.top = `${rect.top ?? rect.y}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}

function paintLeading(peek) {
  const key = peek.loading ? "loading" : peek.favIconUrl || peek.url;
  if (leading.dataset.key === key) return;
  leading.dataset.key = key;
  if (peek.loading) {
    const loader = document.createElement("k-loading-indicator");
    loader.setAttribute("size", "18");
    leading.replaceChildren(loader);
    return;
  }
  leading.replaceChildren(faviconImg(peek.favIconUrl, peek.url));
}

function render(peek) {
  card = peek.card;
  place(card, ghost);
  place(toolbarRect(card), toolbar);
  const label = pageLabel(peek);
  title.textContent = label.title;
  host.textContent = label.host === label.title ? "" : label.host;
  toolbar.title = peek.url;
  paintLeading(peek);
}

function finished(animation) {
  return animation ? animation.finished.catch(() => {}) : Promise.resolve();
}

async function open() {
  const id = windowFromHash(location.hash);
  if (id == null) return;
  const mine = ++generation;
  windowId = id;
  promoting = false;
  const peek = await call("getPeek", windowId).catch(() => null);
  if (mine !== generation) return;
  if (!peek) {
    showing = false;
    await hide(mine);
    return;
  }
  showing = true;
  render(peek);
  document.title = "Log Pose";
  document.body.classList.remove("closed");
  for (const el of [scrim, ghost, toolbar]) el.getAnimations().forEach((a) => a.cancel());
  animate(scrim, [{ opacity: 0 }, { opacity: 1 }], "effects-default");
  animate(toolbar, [{ opacity: 0, transform: "translateY(10px) scale(0.98)" }, { opacity: 1, transform: "none" }], "spatial-default");
  const entering = animate(ghost, [
    { opacity: 0, transform: "translateY(24px) scale(0.94)", borderRadius: "24px" },
    { opacity: 1, transform: "none", borderRadius: "10px" },
  ], "spatial-fast");
  if (entering) await Promise.race([finished(entering), new Promise((resolve) => setTimeout(resolve, 260))]);
  if (mine === generation && showing) document.title = `logpose-peek:shown:${Date.now()}`;
}

async function hide(mine) {
  document.body.classList.add("closed");
  await painted();
  if (mine !== generation) return;
  document.title = `logpose-spotlight:close:${Date.now()}`;
  for (const el of [scrim, ghost, toolbar]) el.getAnimations().forEach((a) => a.cancel());
}

function settle(el, keyframes, name) {
  if (reducedMotion()) return null;
  const { easing, duration } = spring(name);
  return el.animate(keyframes, { duration, easing, fill: "forwards" });
}

async function leave(promoted) {
  const mine = generation;
  showing = false;
  const area = { x: 0, y: 0, width: innerWidth, height: innerHeight };
  const animations = [
    promoted ? settle(scrim, [{ opacity: 0 }, { opacity: 0 }], "effects-fast") : settle(scrim, [{ opacity: 1 }, { opacity: 0 }], "effects-default"),
    settle(toolbar, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: promoted ? "translateY(-12px)" : "translateY(6px) scale(0.98)" }], "effects-fast"),
    promoted && card
      ? settle(ghost, [
        { left: `${card.x}px`, top: `${card.y}px`, width: `${card.width}px`, height: `${card.height}px`, borderRadius: "10px", background: "transparent", boxShadow: `0 0 0 100vmax ${SCRIM}` },
        { left: `${area.x}px`, top: `${area.y}px`, width: `${area.width}px`, height: `${area.height}px`, borderRadius: "12px", background: "transparent", boxShadow: "0 0 0 100vmax transparent" },
      ], "spatial-fast")
      : settle(ghost, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(16px) scale(0.95)" }], "effects-default"),
  ];
  await Promise.all(animations.map(finished));
  if (mine !== generation || showing) return;
  await hide(mine);
}

function closePeek() {
  if (windowId != null && showing) call("closePeek", windowId).catch(() => {});
}

function promote() {
  if (windowId == null || !showing) return;
  promoting = true;
  call("promotePeek", windowId).catch(() => { promoting = false; });
}

chrome.logposePrivate?.onPeekChanged.addListener((id, peek, promoted) => {
  if (id !== windowId) return;
  if (peek) {
    if (showing) render(peek);
    return;
  }
  if (showing) leave(Boolean(promoted) || promoting);
});

document.getElementById("close").onclick = closePeek;
document.getElementById("promote").onclick = promote;
scrim.onclick = closePeek;
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (e.key === "Escape" || (key === "w" && e.ctrlKey && !e.shiftKey && !e.altKey)) { e.preventDefault(); closePeek(); }
  else if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); promote(); }
});
window.addEventListener("hashchange", open);

const themePort = chrome.runtime.connectNative("logpose.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

open();
