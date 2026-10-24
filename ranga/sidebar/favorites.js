import { glyph } from "./kurobe/icons.mjs";
import { favoritesRoot, entries } from "./favorites-model.js";
import { animate } from "./motion.js";
import { showMenu } from "./context-menu.js";

function faviconFor(url) {
  const src = new URL(chrome.runtime.getURL("/_favicon/"));
  src.searchParams.set("pageUrl", url);
  src.searchParams.set("size", "32");
  return src.toString();
}

export function setupFavorites({ button, popover, activeTab, windowId }) {
  const title = popover.querySelector(".favorites-title");
  const back = popover.querySelector(".favorites-back");
  const list = popover.querySelector(".favorites-list");
  const save = popover.querySelector(".favorites-save");
  const trail = [];

  async function folder() {
    if (trail.length) {
      const [node] = await chrome.bookmarks.getSubTree(trail.at(-1));
      return node;
    }
    return favoritesRoot(await chrome.bookmarks.getTree());
  }

  function row(entry) {
    const li = document.createElement("li");
    li.className = "k-list-item k-state k-type-label";
    const leading = document.createElement("span");
    leading.className = "k-list-item__leading";
    if (entry.kind === "folder") {
      leading.innerHTML = `<span class="k-icon">${glyph("folder")}</span>`;
    } else {
      const img = document.createElement("img");
      img.alt = "";
      img.src = faviconFor(entry.url);
      leading.append(img);
    }
    const label = document.createElement("span");
    label.className = "k-list-item__label";
    label.textContent = entry.title;
    li.append(leading, label);
    if (entry.kind === "folder") {
      const count = document.createElement("span");
      count.className = "favorites-count k-type-caption";
      count.textContent = `${entry.count}`;
      const chevron = Object.assign(document.createElement("span"), { className: "k-icon", textContent: glyph("chevron-right") });
      li.append(count, chevron);
      li.onclick = (e) => { e.stopPropagation(); trail.push(entry.id); paint(1); };
    } else {
      li.title = entry.url;
      li.onclick = async (e) => {
        e.stopPropagation();
        const tab = await activeTab();
        chrome.tabs.update(tab.id, { url: entry.url });
        close();
      };
      li.onauxclick = (e) => { if (e.button === 1) chrome.tabs.create({ url: entry.url, windowId: windowId(), active: false }); };
      li.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showMenu([
          { icon: "app-window", label: "Abrir em nova aba", action: () => chrome.tabs.create({ url: entry.url, windowId: windowId() }) },
          { icon: "copy", label: "Copiar link", action: () => navigator.clipboard.writeText(entry.url) },
          "divider",
          { icon: "trash-2", label: "Remover dos favoritos", danger: true, action: async () => { await chrome.bookmarks.remove(entry.id); paint(0); } },
        ], e.clientX, e.clientY);
      };
    }
    return li;
  }

  async function paint(direction) {
    const node = await folder();
    title.textContent = trail.length ? node.title : "Favoritos";
    back.hidden = trail.length === 0;
    const items = entries(node);
    list.replaceChildren(...(items.length ? items.map(row) : [Object.assign(document.createElement("li"), { className: "favorites-empty k-type-caption", textContent: "Nenhum favorito aqui ainda." })]));
    if (direction) animate(list, [{ opacity: 0, transform: `translateX(${direction * 24}px)` }, { opacity: 1, transform: "none" }], "spatial-default");
  }

  function close() {
    popover.hidden = true;
    button.classList.remove("favorites-button--open");
  }

  async function open() {
    trail.length = 0;
    await paint(0);
    const rect = button.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 6}px`;
    popover.hidden = false;
    button.classList.add("favorites-button--open");
  }

  button.onclick = (e) => {
    e.stopPropagation();
    if (popover.hidden) open();
    else close();
  };
  back.onclick = (e) => { e.stopPropagation(); trail.pop(); paint(-1); };
  save.onclick = async (e) => {
    e.stopPropagation();
    const tab = await activeTab();
    const node = await folder();
    if (tab?.url) await chrome.bookmarks.create({ parentId: node.id, title: tab.title || tab.url, url: tab.url });
    paint(0);
  };
  popover.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  chrome.bookmarks.onChanged.addListener(() => { if (!popover.hidden) paint(0); });
}
