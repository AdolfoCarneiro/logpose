import { loadSettings } from "./settings-model.js";
import { others, pinnedIds, togglePin } from "./extensions-model.js";
import { available as rangaPrivate, call } from "./ranga-private.js";
import { loadContainers, createContainer, updateContainer, deleteContainer, CONTAINER_COLORS, CONTAINER_ICONS } from "./containers-model.js";
import { glyph } from "./kurobe/icons.mjs";
import { typed, shown } from "./browser-prefs.js";

const themeStyle = document.getElementById("ranga-theme");
let settings = loadSettings((await chrome.storage.local.get("settings")).settings);
let themeCss = "";

function paint() {
  for (const input of document.querySelectorAll("input[type=checkbox][data-key]")) input.checked = settings[input.dataset.key];
  for (const input of document.querySelectorAll("input[type=range][data-key]")) {
    input.value = settings[input.dataset.key];
    input.style.setProperty("--k-slider-fill", `${input.value}%`);
    document.getElementById(`${input.dataset.key}-value`).textContent = `${input.value}%`;
  }
  for (const group of document.querySelectorAll(".k-segmented[data-key]")) {
    for (const option of group.querySelectorAll("[data-value]")) {
      option.setAttribute("aria-pressed", String(option.dataset.value === String(settings[group.dataset.key])));
    }
  }
  themeStyle.textContent = settings.followCielTheme ? themeCss : "";
}

async function save(key, value) {
  settings = loadSettings({ ...settings, [key]: value });
  await chrome.storage.local.set({ settings });
  paint();
}

for (const input of document.querySelectorAll("input[type=checkbox][data-key]")) {
  input.addEventListener("change", () => save(input.dataset.key, input.checked));
}
for (const input of document.querySelectorAll("input[type=range][data-key]")) {
  input.addEventListener("input", () => {
    input.style.setProperty("--k-slider-fill", `${input.value}%`);
    document.getElementById(`${input.dataset.key}-value`).textContent = `${input.value}%`;
  });
  input.addEventListener("change", async () => {
    await save(input.dataset.key, Number(input.value));
    if (input.dataset.key === "materialOpacity") themePort.postMessage({ type: "set-opacity", value: Number(input.value) });
  });
}
for (const group of document.querySelectorAll(".k-segmented[data-key]")) {
  for (const option of group.querySelectorAll("[data-value]")) {
    option.addEventListener("click", () => save(group.dataset.key, group.dataset.type === "number" ? Number(option.dataset.value) : option.dataset.value));
  }
}

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => {
  if (msg.type !== "theme") return;
  themeCss = msg.css;
  paint();
});

async function paintExtensions() {
  if (!rangaPrivate) return;
  const { id } = await chrome.windows.getCurrent();
  const actions = others(await call("getExtensionActions", id).catch(() => []), chrome.runtime.id);
  const stored = await chrome.storage.local.get("pinnedExtensions");
  let pins = pinnedIds(stored.pinnedExtensions, actions);
  document.getElementById("extensions-card").hidden = actions.length === 0;
  document.getElementById("extension-settings").replaceChildren(...actions.map((action) => {
    const label = document.createElement("label");
    label.className = "setting";
    const text = document.createElement("span");
    text.className = "text extension-name";
    const icon = Object.assign(document.createElement("img"), { src: action.icon, alt: "" });
    const name = Object.assign(document.createElement("span"), { className: "k-type-panel", textContent: action.name });
    text.append(icon, name);
    const input = Object.assign(document.createElement("input"), { className: "k-switch", type: "checkbox", checked: pins.includes(action.id) });
    input.addEventListener("change", async () => {
      pins = togglePin(pins, action.id);
      await chrome.storage.local.set({ pinnedExtensions: pins });
    });
    label.append(text, input);
    return label;
  }));
}

function next(list, value) {
  return list[(list.indexOf(value) + 1) % list.length];
}

async function saveContainers(list) {
  await chrome.storage.local.set({ containers: list });
  paintContainers();
}

async function paintContainers() {
  if (!rangaPrivate) return;
  const list = loadContainers((await chrome.storage.local.get("containers")).containers);
  document.getElementById("containers-card").hidden = false;
  document.getElementById("container-settings").replaceChildren(...list.map((c) => {
    const row = document.createElement("div");
    row.className = "setting container-row";
    const text = document.createElement("span");
    text.className = "text container-name";
    const icon = Object.assign(document.createElement("button"), { className: "container-icon k-state", title: "Trocar ícone", textContent: glyph(c.icon) });
    icon.style.setProperty("--container-color", c.color);
    icon.onclick = () => saveContainers(updateContainer(list, c.id, { icon: next(CONTAINER_ICONS, c.icon) }));
    const dot = Object.assign(document.createElement("button"), { className: "container-dot", title: "Trocar cor" });
    dot.style.background = c.color;
    dot.onclick = () => saveContainers(updateContainer(list, c.id, { color: next(CONTAINER_COLORS, c.color) }));
    const name = Object.assign(document.createElement("input"), { className: "k-text-field k-type-label", value: c.name, maxLength: 32 });
    name.addEventListener("change", () => saveContainers(updateContainer(list, c.id, { name: name.value })));
    text.append(icon, dot, name);
    const actions = document.createElement("span");
    actions.className = "container-actions";
    const clear = Object.assign(document.createElement("button"), { className: "k-button k-button--text k-type-button", textContent: "Limpar dados" });
    clear.onclick = async () => {
      clear.disabled = true;
      await call("clearContainer", c.id).catch(() => {});
      clear.textContent = "Dados limpos";
    };
    const remove = Object.assign(document.createElement("button"), { className: "k-icon-button k-state", title: "Apagar container" });
    remove.innerHTML = `<span class="k-icon">${glyph("trash-2")}</span>`;
    remove.onclick = () => saveContainers(deleteContainer(list, c.id));
    actions.append(clear, remove);
    row.append(text, actions);
    return row;
  }));
}

document.getElementById("container-new").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.elements.name;
  const list = loadContainers((await chrome.storage.local.get("containers")).containers);
  try {
    await saveContainers(createContainer(list, { name: input.value }));
    input.value = "";
  } catch {
    input.focus();
  }
});

async function paintBrowserPrefs() {
  if (!chrome.settingsPrivate) return;
  const prefs = new Map((await chrome.settingsPrivate.getAllPrefs()).map((p) => [p.key, p]));
  for (const input of document.querySelectorAll("input[type=checkbox][data-pref]")) {
    const pref = prefs.get(input.dataset.pref);
    input.closest(".setting").hidden = !pref;
    if (!pref) continue;
    input.checked = Boolean(pref.value);
    input.disabled = pref.enforcement === "ENFORCED";
  }
  for (const group of document.querySelectorAll(".k-segmented[data-pref]")) {
    const pref = prefs.get(group.dataset.pref);
    group.closest(".setting").hidden = !pref;
    if (!pref) continue;
    for (const option of group.querySelectorAll("[data-value]")) option.setAttribute("aria-pressed", String(option.dataset.value === shown(pref.value)));
  }
  const dir = prefs.get("download.default_directory")?.value;
  document.getElementById("download-dir").textContent = dir ? `Desligado, salva direto em ${dir}.` : "";
  document.getElementById("browser-card").hidden = false;
}

for (const input of document.querySelectorAll("input[type=checkbox][data-pref]")) {
  input.addEventListener("change", () => chrome.settingsPrivate.setPref(input.dataset.pref, input.checked).then(paintBrowserPrefs));
}
for (const group of document.querySelectorAll(".k-segmented[data-pref]")) {
  for (const option of group.querySelectorAll("[data-value]")) {
    option.addEventListener("click", () => chrome.settingsPrivate.setPref(group.dataset.pref, typed(group.dataset.type, option.dataset.value)).then(paintBrowserPrefs));
  }
}
chrome.settingsPrivate?.onPrefsChanged.addListener(paintBrowserPrefs);

paint();
paintExtensions();
paintContainers();
paintBrowserPrefs();
