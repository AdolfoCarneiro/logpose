import { glyph } from "./kurobe/icons.mjs";
import "./kurobe/loading-indicator.mjs";
import { animate } from "./motion.js";

const steps = [...document.querySelectorAll(".step")];
const dots = [...document.querySelectorAll(".dots span")];
const themeStyle = document.getElementById("ranga-theme");
let current = 0;

for (const el of document.querySelectorAll("[data-icon]")) el.textContent = glyph(el.dataset.icon);

function go(index) {
  const direction = Math.sign(index - current);
  steps[current].hidden = true;
  current = index;
  steps[current].hidden = false;
  animate(steps[current], [{ opacity: 0, transform: `translateX(${direction * 48}px) scale(0.96)`, borderRadius: "24px" }, { opacity: 1, transform: "none", borderRadius: "48px" }], "spatial-default");
  dots.forEach((dot, i) => dot.classList.toggle("on", i === current));
}

async function finish() {
  const consent = document.getElementById("services").checked;
  if (chrome.settingsPrivate) {
    await chrome.settingsPrivate.setPref("helium.services.user_consented", consent).catch(() => {});
    await chrome.settingsPrivate.setPref("helium.services.schema_version", 1).catch(() => {});
    await chrome.settingsPrivate.setPref("helium.completed_onboarding", true).catch(() => {});
  }
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.update(tab.id, { url: "chrome://newtab/" });
}

for (const button of document.querySelectorAll(".next")) button.onclick = () => go(current + 1);
for (const button of document.querySelectorAll(".back")) button.onclick = () => go(current - 1);
document.getElementById("finish").onclick = finish;
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.matches("input")) return;
  if (current < steps.length - 1) go(current + 1);
  else finish();
});

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => { if (msg.type === "theme") themeStyle.textContent = msg.css; });

dots[0].classList.add("on");
