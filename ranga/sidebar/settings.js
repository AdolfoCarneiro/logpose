import { loadSettings } from "./settings-model.js";

const themeStyle = document.getElementById("ranga-theme");
let settings = loadSettings((await chrome.storage.local.get("settings")).settings);
let themeCss = "";

function paint() {
  for (const input of document.querySelectorAll("input[data-key]")) input.checked = settings[input.dataset.key];
  for (const group of document.querySelectorAll(".k-segmented[data-key]")) {
    for (const option of group.querySelectorAll("[data-value]")) {
      option.setAttribute("aria-pressed", String(option.dataset.value === settings[group.dataset.key]));
    }
  }
  themeStyle.textContent = settings.followCielTheme ? themeCss : "";
}

async function save(key, value) {
  settings = loadSettings({ ...settings, [key]: value });
  await chrome.storage.local.set({ settings });
  paint();
}

for (const input of document.querySelectorAll("input[data-key]")) {
  input.addEventListener("change", () => save(input.dataset.key, input.checked));
}
for (const group of document.querySelectorAll(".k-segmented[data-key]")) {
  for (const option of group.querySelectorAll("[data-value]")) {
    option.addEventListener("click", () => save(group.dataset.key, option.dataset.value));
  }
}
document.getElementById("browser-appearance").onclick = () => chrome.tabs.create({ url: "chrome://settings/appearance" });

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => {
  if (msg.type !== "theme") return;
  themeCss = msg.css;
  paint();
});

paint();
