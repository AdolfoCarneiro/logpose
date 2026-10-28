import { loadContainers, membership, containerSnapshot, lostTabs } from "./containers-model.js";
import { available, call } from "./ranga-private.js";

export function setupContainers({ windowId }) {
  let list = loadContainers(undefined);
  let members = new Map();
  let healed = false;

  async function load() {
    if (!available) return;
    const [{ containers }, entries] = await Promise.all([
      chrome.storage.local.get("containers"),
      call("getTabContainers", windowId()).catch(() => []),
    ]);
    list = loadContainers(containers);
    members = membership(entries);
  }

  function of(tabId) {
    const id = members.get(tabId);
    if (!id) return null;
    return list.find((c) => c.id === id) ?? { id, name: id, color: "var(--k-color-outline)", icon: "box" };
  }

  function sessionOfTab(tabId) {
    return members.get(tabId) ?? "";
  }

  function open({ url, container, index, active = true, pinned = false }) {
    const options = { windowId: windowId(), container, active, pinned };
    if (url) options.url = url;
    if (index !== undefined) options.index = index;
    return call("createTab", options);
  }

  async function reopen(tab, container) {
    const id = await open({ url: tab.url || tab.pendingUrl, container, index: tab.index, active: tab.active, pinned: tab.pinned });
    await chrome.tabs.remove(tab.id);
    return id;
  }

  async function save(tabs) {
    if (!available || !healed) return;
    await load();
    await chrome.storage.local.set({ containerSnapshot: containerSnapshot(tabs, members) });
  }

  async function heal(tabs) {
    if (!available) return [];
    const created = [];
    try {
      const { containersHealed } = await chrome.storage.session.get("containersHealed");
      if (containersHealed) return created;
      await chrome.storage.session.set({ containersHealed: true });
      await load();
      const { containerSnapshot: shot } = await chrome.storage.local.get("containerSnapshot");
      for (const tab of lostTabs(shot, tabs, members, list)) {
        created.push({ from: tab.tabId, to: await reopen({ ...tab, id: tab.tabId }, tab.container) });
      }
    } finally {
      healed = true;
    }
    return created;
  }

  return { available, load, of, sessionOfTab, list: () => list, open, reopen, save, heal };
}
