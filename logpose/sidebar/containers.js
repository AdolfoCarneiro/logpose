import { loadContainers, membership } from "./containers-model.js";
import { available, call } from "./logpose-private.js";

export function setupContainers({ windowId }) {
  let list = loadContainers(undefined);
  let members = new Map();

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

  // a aba velha só fecha depois do rekey: o onRemoved poda as fixadas e o
  // espaço dela, e o rekey não acharia mais nada pra passar pro id novo
  function reopen(tab, container) {
    return open({ url: tab.url || tab.pendingUrl, container, index: tab.index, active: tab.active, pinned: tab.pinned });
  }

  return { available, load, of, sessionOfTab, list: () => list, open, reopen };
}
