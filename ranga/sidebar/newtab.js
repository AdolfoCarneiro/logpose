import { glyph } from "./kurobe/icons.mjs";
import { current, label } from "./shortcuts-model.js";
import { available as rangaPrivate, call } from "./ranga-private.js";

const themeStyle = document.getElementById("ranga-theme");

for (const el of document.querySelectorAll("[data-icon]")) el.textContent = glyph(el.dataset.icon);

async function search() {
  const tab = await chrome.tabs.getCurrent();
  if (rangaPrivate && tab) await call("executeCommand", tab.windowId, "openLocation").catch(() => {});
}

const { shortcuts } = await chrome.storage.local.get("shortcuts");
const keys = current(shortcuts).find((s) => s.command === "openLocation")?.keys;
document.getElementById("keys").replaceChildren(...label(keys).map((k) => Object.assign(document.createElement("kbd"), { textContent: k })));
document.getElementById("search").onclick = search;

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

const tab = await chrome.tabs.getCurrent();
if (tab?.active && document.visibilityState === "visible") search();
