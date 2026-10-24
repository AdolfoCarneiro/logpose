import { plan, archiveEntry, pushArchive } from "./lifecycle-model.js";
import { loadSettings } from "./settings-model.js";
import { cleanUrl, markdownLink } from "./link-model.js";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.downloads.setUiOptions({ enabled: false }).catch(() => {});
chrome.alarms.create("ranga-lifecycle", { periodInMinutes: 1 });

async function runLifecycle() {
  const stored = await chrome.storage.local.get(["settings", "spaces", "archive"]);
  const settings = loadSettings(stored.settings);
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const { sleep, archive } = plan(tabs, now, settings);
  for (const id of sleep) chrome.tabs.discard(id).catch(() => {});
  if (!archive.length) return;
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const entries = archive.map((id) => archiveEntry(byId.get(id), stored.spaces?.tabSpace?.[id] ?? null, now));
  await chrome.storage.local.set({ archive: pushArchive(stored.archive, entries), lastArchived: { at: now, reason: "idle", entries } });
  await chrome.tabs.remove(archive);
}

async function copyToClipboard(text) {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["CLIPBOARD"], justification: "Copiar a URL da aba atual" });
  }
  await chrome.runtime.sendMessage({ type: "offscreen-copy", text });
}

async function copyCurrentUrl() {
  const window = await chrome.windows.getLastFocused();
  const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
  if (!tab?.url) return;
  await copyToClipboard(tab.url);
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon-128.png",
    title: "Link copiado",
    message: tab.url,
    silent: true,
  });
}

async function copyLink(tabId, format) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url) return;
  const text = format === "copyMarkdown" ? markdownLink(tab.title, tab.url) : cleanUrl(tab.url);
  await copyToClipboard(text);
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon-128.png",
    title: format === "copyMarkdown" ? "Markdown copiado" : "Link copiado",
    message: text,
    silent: true,
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "copy-link" && msg.tabId) copyLink(msg.tabId, msg.format);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ranga-lifecycle") runLifecycle();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "copy-url") {
    copyCurrentUrl();
    return;
  }
  const direction = command === "space-next" ? 1 : command === "space-previous" ? -1 : 0;
  if (!direction) return;
  const window = await chrome.windows.getLastFocused();
  chrome.runtime.sendMessage({ type: "space-step", windowId: window.id, direction }).catch(() => {});
});
