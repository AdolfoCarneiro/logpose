import { call } from "./logpose-private.js";

export async function dropTab(windowId, tabId, zone, split, partner = null) {
  if (zone === "window") {
    if (split) await chrome.tabs.unsplit(split);
    await chrome.windows.create({ tabId, focused: true });
    return;
  }
  if (!split) {
    const other = partner && await chrome.tabs.get(partner).catch(() => null);
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!other || !tab || other.splitViewId > 0) return;
    await chrome.tabs.move(tabId, { index: tab.index < other.index ? other.index : other.index + 1 });
    await chrome.tabs.createSplit([other.id, tabId]);
  }
  await call("arrangeSplit", windowId, tabId, zone);
}

export async function joinWindow(windowId, tabId, zone, partner) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  if (tab.splitViewId > 0) await chrome.tabs.unsplit(tab.splitViewId);
  const other = partner && await chrome.tabs.get(partner).catch(() => null);
  const pair = zone !== "join" && other?.windowId === windowId && !(other.splitViewId > 0);
  await chrome.tabs.move(tabId, { windowId, index: pair ? other.index + 1 : -1 });
  if (pair) {
    await chrome.tabs.createSplit([other.id, tabId]);
    await call("arrangeSplit", windowId, tabId, zone);
  } else {
    await chrome.tabs.update(tabId, { active: true });
  }
  await chrome.windows.update(windowId, { focused: true });
}
