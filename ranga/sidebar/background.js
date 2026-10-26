import { plan, archiveEntry, pushArchive } from "./lifecycle-model.js";
import { loadSettings } from "./settings-model.js";
import { cleanUrl, markdownLink } from "./link-model.js";
import { toMap } from "./shortcuts-model.js";
import { peekTabs } from "./peek-model.js";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.downloads.setUiOptions({ enabled: false }).catch(() => {});
chrome.alarms.create("ranga-lifecycle", { periodInMinutes: 1 });

async function runLifecycle() {
  const stored = await chrome.storage.local.get(["settings", "spaces", "archive"]);
  const settings = loadSettings(stored.settings);
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const { pinLive = {} } = await chrome.storage.session.get("pinLive");
  const { sleep, archive } = plan(tabs, now, settings, new Set(Object.keys(pinLive).map(Number)));
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
  const text = format === "copyMarkdown" ? markdownLink(tab.title, tab.url) : format === "copyCleanLink" ? cleanUrl(tab.url) : tab.url;
  await copyToClipboard(text);
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon-128.png",
    title: format === "copyMarkdown" ? "Markdown copiado" : "Link copiado",
    message: text,
    silent: true,
  });
}

async function applyShortcuts() {
  if (!chrome.rangaPrivate?.setShortcuts) return;
  const { shortcuts } = await chrome.storage.local.get("shortcuts");
  chrome.rangaPrivate.setShortcuts(toMap(shortcuts), () => void chrome.runtime.lastError);
}

async function applyLinks() {
  if (!chrome.rangaPrivate?.setPeekTabs) return;
  const settings = loadSettings((await chrome.storage.local.get("settings")).settings);
  const { pinLive } = await chrome.storage.session.get("pinLive");
  chrome.rangaPrivate.setPeekTabs(peekTabs(pinLive, settings.peekPinnedLinks), () => void chrome.runtime.lastError);
  chrome.rangaPrivate.setOpenLinksInLittle(settings.littleWindowLinks, () => void chrome.runtime.lastError);
}

async function acceptServicesSchema() {
  if (!chrome.settingsPrivate) return;
  const consent = await chrome.settingsPrivate.getPref("helium.services.user_consented").catch(() => null);
  const schema = await chrome.settingsPrivate.getPref("helium.services.schema_version").catch(() => null);
  if (consent?.value && schema && schema.value < 1) await chrome.settingsPrivate.setPref("helium.services.schema_version", 1).catch(() => {});
}

applyShortcuts();
applyLinks();
acceptServicesSchema();
chrome.runtime.onStartup.addListener(() => {
  applyShortcuts();
  applyLinks();
  acceptServicesSchema();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.shortcuts) applyShortcuts();
  if ((area === "local" && changes.settings) || (area === "session" && changes.pinLive)) applyLinks();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "copy-link" && msg.tabId) copyLink(msg.tabId, msg.format);
  if (msg?.type === "links") applyLinks();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ranga-lifecycle") runLifecycle();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "copy-url") copyCurrentUrl();
});
