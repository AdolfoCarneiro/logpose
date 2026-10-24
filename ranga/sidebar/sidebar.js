import { toItems, toNavigation } from "./tabs-model.js";

const list = document.getElementById("tabs");
const address = document.getElementById("address");
let windowId;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  return tab;
}

function row(item) {
  const li = document.createElement("li");
  li.className = [item.active ? "active" : "", item.pinned ? "pinned" : ""].join(" ").trim();
  const icon = document.createElement("img");
  icon.src = item.favIconUrl;
  const title = document.createElement("span");
  title.textContent = item.title;
  const detach = document.createElement("button");
  detach.className = "detach";
  detach.textContent = "⇱";
  detach.title = "Destacar";
  detach.onclick = (e) => { e.stopPropagation(); chrome.windows.create({ tabId: item.id }); };
  const close = document.createElement("button");
  close.className = "close";
  close.textContent = "×";
  close.title = "Fechar";
  close.onclick = (e) => { e.stopPropagation(); chrome.tabs.remove(item.id); };
  li.append(icon, title, detach, close);
  li.onclick = () => chrome.tabs.update(item.id, { active: true });
  li.onauxclick = (e) => { if (e.button === 1) chrome.tabs.remove(item.id); };
  return li;
}

async function render() {
  const tabs = await chrome.tabs.query({ windowId });
  const active = tabs.find((t) => t.active);
  list.replaceChildren(...toItems(tabs, active?.id).map(row));
  if (document.activeElement !== address) address.value = active?.url ?? "";
}

address.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const nav = toNavigation(address.value);
  const tab = await activeTab();
  if (nav.kind === "url") chrome.tabs.update(tab.id, { url: nav.url });
  else chrome.search.query({ text: nav.text, tabId: tab.id });
  address.blur();
});

document.getElementById("back").onclick = async () => chrome.tabs.goBack((await activeTab()).id);
document.getElementById("forward").onclick = async () => chrome.tabs.goForward((await activeTab()).id);
document.getElementById("reload").onclick = async () => chrome.tabs.reload((await activeTab()).id);
document.getElementById("new-tab").onclick = () => chrome.tabs.create({ windowId });

for (const ev of ["onCreated", "onRemoved", "onUpdated", "onActivated", "onMoved", "onAttached", "onDetached"]) {
  chrome.tabs[ev].addListener(render);
}

const themePort = chrome.runtime.connectNative("ranga.theme");
themePort.onMessage.addListener((msg) => {
  if (msg.type === "theme") document.getElementById("ranga-theme").textContent = msg.css;
});

windowId = (await chrome.windows.getCurrent()).id;
render();
