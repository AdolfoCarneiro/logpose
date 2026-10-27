import { glyph } from "./kurobe/icons.mjs";
import "./kurobe/loading-indicator.mjs";
import { showMenu } from "./context-menu.js";
import { animate, pop } from "./motion.js";
import { call } from "./ranga-private.js";
import { faviconOf } from "./tabs-model.js";
import { pinId, drifted, prune, tabOf, pinSnapshot } from "./pins-model.js";
import { loadContainers, pagesOf, addPage, removePage, updatePage, findPage, toggleGroup, pageIds, restorePages } from "./containers-model.js";

function icon(name) {
  return Object.assign(document.createElement("span"), { className: "k-icon", textContent: glyph(name) });
}

function faviconFor(url) {
  const src = new URL(chrome.runtime.getURL("/_favicon/"));
  src.searchParams.set("pageUrl", url);
  src.searchParams.set("size", "32");
  return src.toString();
}

function iconButton(name, title, onclick) {
  const b = document.createElement("button");
  b.className = "k-icon-button k-icon-button--small k-state";
  b.type = "button";
  b.title = title;
  b.append(icon(name));
  b.onclick = (e) => { e.stopPropagation(); onclick(e); };
  return b;
}

export function setupContainerGroups({ section, list, windowId, assign, containerOf, changed }) {
  let containers = loadContainers(undefined);
  let live = {};

  async function save(next) {
    containers = next;
    await chrome.storage.local.set({ containers });
    changed();
  }

  async function saveLive(next) {
    live = next;
    await chrome.storage.session.set({ containerLive: live });
  }

  async function load(windowTabs) {
    const stored = await chrome.storage.local.get(["containers", "containerPageSnapshot"]);
    containers = loadContainers(stored.containers);
    const session = await chrome.storage.session.get(["containerLive", "containerPagesHealed"]);
    live = session.containerLive ?? {};
    const healed = session.containerPagesHealed ?? [];
    if (!healed.includes(windowId())) {
      live = { ...live, ...restorePages(windowTabs, stored.containerPageSnapshot, containers, containerOf) };
      await chrome.storage.session.set({ containerLive: live, containerPagesHealed: [...healed, windowId()] });
    }
  }

  async function persist() {
    const tabs = await chrome.tabs.query({});
    live = prune(live, new Set(tabs.map((t) => t.id)), pageIds(containers));
    await chrome.storage.session.set({ containerLive: live });
    await chrome.storage.local.set({ containerPageSnapshot: pinSnapshot(live, tabs) });
  }

  function liveIds() {
    return new Set(Object.keys(live).map(Number));
  }

  async function open(container, page) {
    const tabId = tabOf(live, page.id);
    const tab = tabId != null ? await chrome.tabs.get(tabId).catch(() => null) : null;
    if (tab) {
      if (tab.windowId === windowId()) await assign(tab.id);
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== windowId()) await chrome.windows.update(tab.windowId, { focused: true });
      return;
    }
    const created = await call("createTab", { windowId: windowId(), container: container.id, url: page.url, active: true });
    await saveLive({ ...live, [created]: page.id });
    await assign(created);
    changed();
  }

  async function openAll(container) {
    for (const page of pagesOf(container)) {
      if (tabOf(live, page.id) != null) continue;
      const created = await call("createTab", { windowId: windowId(), container: container.id, url: page.url, active: false });
      live = { ...live, [created]: page.id };
      await assign(created);
    }
    await saveLive(live);
    changed();
  }

  async function closeAll(container) {
    const ids = pagesOf(container).map((p) => tabOf(live, p.id)).filter((id) => id != null);
    if (ids.length) await chrome.tabs.remove(ids).catch(() => {});
  }

  async function saveTab(tab, containerId) {
    const id = pinId("cpage");
    await saveLive({ ...live, [tab.id]: id });
    await save(addPage(containers, containerId, { id, url: tab.url || tab.pendingUrl || "", title: tab.title }));
  }

  async function adopt(tabId, containerId) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab) await saveTab(tab, containerId);
  }

  async function forget(page, tab) {
    await save(removePage(containers, page.id));
    if (tab) {
      const { [tab.id]: _, ...rest } = live;
      await saveLive(rest);
    }
    changed();
  }

  function pageMenu(container, page, tab, x, y) {
    const away = tab && drifted(page.url, tab.url);
    showMenu([
      ...(away ? [
        { icon: "corner-up-left", label: "Voltar à página salva", action: () => chrome.tabs.update(tab.id, { url: page.url }) },
        { icon: "save", label: "Salvar o endereço atual", action: () => save(updatePage(containers, page.id, { url: tab.url, title: tab.title })) },
      ] : []),
      { icon: "link", label: "Copiar link", action: () => navigator.clipboard.writeText(tab?.url || page.url) },
      "divider",
      { icon: "trash-2", label: `Tirar do grupo ${container.name}`, action: () => forget(page, tab) },
      ...(tab ? [{ icon: "x", label: "Fechar", danger: true, action: () => chrome.tabs.remove(tab.id) }] : []),
    ], x, y);
  }

  function groupMenu(container, x, y) {
    const open = pagesOf(container).filter((p) => tabOf(live, p.id) != null).length;
    showMenu([
      { icon: "layers", label: "Abrir todas as páginas", action: () => openAll(container) },
      ...(open ? [{ icon: "x", label: "Fechar as abas do grupo", action: () => closeAll(container) }] : []),
      { icon: "plus", label: `Nova aba no container ${container.name}`, action: () => call("createTab", { windowId: windowId(), container: container.id, active: true }) },
      "divider",
      { icon: "settings", label: "Editar containers", action: () => chrome.tabs.create({ url: `${chrome.runtime.getURL("settings.html")}#containers`, windowId: windowId() }) },
    ], x, y);
  }

  function pageRow(container, page, tabs, activeId) {
    const tab = tabs.get(tabOf(live, page.id));
    const li = document.createElement("li");
    li.className = "k-list-item k-state k-type-label tab group-page" + (tab ? "" : " group-page--closed") + (tab && tab.id === activeId ? " k-list-item--active" : "");
    li.title = tab?.title || page.title;
    const leading = document.createElement("span");
    leading.className = "k-list-item__leading";
    if (tab?.status === "loading") {
      const loader = document.createElement("k-loading-indicator");
      loader.setAttribute("size", "18");
      leading.append(loader);
    } else {
      const img = Object.assign(document.createElement("img"), { alt: "", src: (tab && faviconOf(tab)) || faviconFor(page.url) });
      img.onerror = () => img.replaceWith(icon("globe"));
      leading.append(img);
    }
    const label = Object.assign(document.createElement("span"), { className: "k-list-item__label", textContent: page.title });
    li.append(leading, label);
    if (tab && drifted(page.url, tab.url)) {
      const back = iconButton("corner-up-left", "Voltar à página salva", () => chrome.tabs.update(tab.id, { url: page.url }));
      back.classList.add("group-page__back");
      li.append(back);
    }
    if (tab) {
      const trailing = document.createElement("span");
      trailing.className = "k-list-item__trailing";
      trailing.append(iconButton("x", "Fechar (a página continua salva)", () => chrome.tabs.remove(tab.id)));
      li.append(trailing);
    }
    li.onclick = () => { pop(leading); open(container, page); };
    li.onauxclick = (e) => { if (e.button === 1 && tab) chrome.tabs.remove(tab.id); };
    li.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); pageMenu(container, page, tab, e.clientX, e.clientY); };
    return li;
  }

  function group(container, tabs, activeId) {
    const pages = pagesOf(container);
    const openTabs = pages.filter((p) => tabs.has(tabOf(live, p.id)));
    const holdsActive = pages.some((p) => tabOf(live, p.id) === activeId);
    const li = document.createElement("li");
    li.className = "group" + (container.collapsed ? " group--collapsed" : "");
    li.style.setProperty("--container-color", container.color);
    li.dataset.id = container.id;
    const head = document.createElement("div");
    head.className = "group__head k-state k-type-label" + (container.collapsed && holdsActive ? " group__head--active" : "");
    head.setAttribute("role", "button");
    head.setAttribute("aria-expanded", String(!container.collapsed));
    head.title = container.collapsed ? "Mostrar o grupo" : "Recolher o grupo";
    const chip = document.createElement("span");
    chip.className = "group__chip";
    chip.append(icon(container.icon), Object.assign(document.createElement("span"), { textContent: container.name }));
    const count = Object.assign(document.createElement("span"), { className: "group__count k-type-caption", textContent: openTabs.length ? `${openTabs.length}/${pages.length}` : String(pages.length) });
    const chevron = icon("chevron-down");
    chevron.classList.add("group__chevron");
    const add = iconButton("plus", `Nova aba no container ${container.name}`, () => call("createTab", { windowId: windowId(), container: container.id, active: true }));
    add.classList.add("group__add");
    head.append(chip, count, add, chevron);
    head.onclick = async () => {
      const body = li.querySelector(".group__pages");
      if (body && !container.collapsed) {
        await animate(body, [{ height: `${body.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], "spatial-fast")?.finished.catch(() => {});
      }
      save(toggleGroup(containers, container.id));
    };
    head.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); groupMenu(container, e.clientX, e.clientY); };
    li.append(head);
    if (!container.collapsed) {
      const body = document.createElement("ul");
      body.className = "group__pages k-list";
      body.append(...pages.map((page) => pageRow(container, page, tabs, activeId)));
      li.append(body);
    }
    return li;
  }

  let expanded = null;

  function render(tabs, activeId) {
    const shown = containers.filter((c) => pagesOf(c).length);
    section.hidden = shown.length === 0;
    const before = expanded ?? new Set(shown.filter((c) => !c.collapsed).map((c) => c.id));
    expanded = new Set(shown.filter((c) => !c.collapsed).map((c) => c.id));
    list.replaceChildren(...shown.map((c) => group(c, tabs, activeId)));
    for (const id of expanded) {
      if (before.has(id)) continue;
      const body = list.querySelector(`.group[data-id="${CSS.escape(id)}"] .group__pages`);
      if (body) animate(body, [{ height: "0px", opacity: 0 }, { height: `${body.offsetHeight}px`, opacity: 1 }], "spatial-default");
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.containers) {
      containers = loadContainers(changes.containers.newValue);
      changed();
    }
    if (area === "session" && changes.containerLive) {
      live = changes.containerLive.newValue ?? {};
      changed();
    }
  });

  return {
    load, persist, render, liveIds, saveTab, adopt,
    pageOfTab: (tabId) => (live[tabId] ? findPage(containers, live[tabId]) : null),
  };
}
