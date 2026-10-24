import { glyph } from "./kurobe/icons.mjs";
import "./kurobe/loading-indicator.mjs";
import { measure, flip, enter, exit, pop } from "./motion.js";
import { splitEdges } from "./tabs-model.js";

function favicon(url) {
  const img = document.createElement("img");
  img.alt = "";
  img.src = url || "";
  img.onerror = () => img.replaceWith(Object.assign(document.createElement("span"), { className: "k-icon", textContent: glyph("globe") }));
  return img;
}

export function createTabList({ list, indicator, onActivate, onClose, onContextMenu, onMove }) {
  const rows = new Map();
  let drag = null;
  let pending = null;

  function dragTo(e) {
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < 5) return;
      drag.active = true;
      drag.rows = [...list.children];
      drag.from = drag.rows.indexOf(drag.li);
      drag.step = drag.rows.length > 1 ? drag.rows[1].offsetTop - drag.rows[0].offsetTop : drag.li.offsetHeight;
      drag.li.classList.add("tab--dragging");
      list.classList.add("k-list--dragging");
      indicator.style.opacity = "0";
    }
    drag.li.style.transform = `translateY(${dy}px)`;
    drag.to = Math.max(0, Math.min(drag.rows.length - 1, drag.from + Math.round(dy / drag.step)));
    drag.rows.forEach((row, i) => {
      if (row === drag.li) return;
      const shift = drag.from < i && i <= drag.to ? -drag.step : drag.to <= i && i < drag.from ? drag.step : 0;
      row.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  }

  function drop() {
    const done = drag;
    drag = null;
    if (!done?.active) return;
    done.li.dataset.dragged = "1";
    for (const row of done.rows) row.style.transform = "";
    done.li.classList.remove("tab--dragging");
    list.classList.remove("k-list--dragging");
    if (pending) {
      const items = pending;
      pending = null;
      render(items);
    }
    if (done.to !== done.from) onMove(Number(done.li.dataset.id), done.rows[done.to].item);
    else moveIndicator();
  }

  document.addEventListener("pointermove", (e) => { if (drag) dragTo(e); });
  document.addEventListener("pointerup", drop);
  document.addEventListener("pointercancel", drop);

  function paintLeading(li, item) {
    const key = item.loading ? "loading" : item.favIconUrl || "";
    if (li.dataset.leading === key) return;
    li.dataset.leading = key;
    const leading = li.querySelector(".k-list-item__leading");
    if (item.loading) {
      const loader = document.createElement("k-loading-indicator");
      loader.setAttribute("size", "18");
      leading.replaceChildren(loader);
    } else {
      leading.replaceChildren(favicon(item.favIconUrl));
      pop(leading);
    }
  }

  async function close(li, id) {
    rows.delete(id);
    await exit(li);
    li.remove();
    onClose(id);
    moveIndicator();
  }

  function build(item) {
    const li = document.createElement("li");
    li.className = "k-list-item k-state k-type-label tab";
    li.dataset.id = item.id;
    const leading = document.createElement("span");
    leading.className = "k-list-item__leading";
    const label = document.createElement("span");
    label.className = "k-list-item__label";
    const audio = document.createElement("span");
    audio.className = "k-icon tab__audio";
    const trailing = document.createElement("span");
    trailing.className = "k-list-item__trailing";
    const closeButton = document.createElement("button");
    closeButton.className = "k-icon-button k-icon-button--small k-state";
    closeButton.title = "Fechar";
    closeButton.innerHTML = `<span class="k-icon">${glyph("x")}</span>`;
    closeButton.onclick = (e) => { e.stopPropagation(); close(li, Number(li.dataset.id)); };
    trailing.append(closeButton);
    li.append(leading, label, audio, trailing);
    li.onclick = () => {
      if (li.dataset.dragged) {
        delete li.dataset.dragged;
        return;
      }
      onActivate(Number(li.dataset.id));
    };
    li.onpointerdown = (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      drag = { li, startY: e.clientY, active: false };
    };
    li.onauxclick = (e) => { if (e.button === 1) close(li, Number(li.dataset.id)); };
    li.oncontextmenu = (e) => { e.preventDefault(); onContextMenu(li.item, e.clientX, e.clientY); };
    return li;
  }

  function update(li, item) {
    li.item = item;
    li.classList.toggle("k-list-item--active", item.active);
    li.classList.toggle("tab--asleep", item.asleep);
    li.querySelector(".k-list-item__label").textContent = item.title;
    const audio = li.querySelector(".tab__audio");
    audio.hidden = !item.audio;
    audio.textContent = item.audio ? glyph(item.audio === "muted" ? "volume-x" : "volume-2") : "";
    li.title = item.container ? `${item.container.name} · ${item.url}` : item.url;
    li.classList.toggle("tab--contained", Boolean(item.container));
    if (item.container) li.style.setProperty("--container-color", item.container.color);
    else li.style.removeProperty("--container-color");
    paintLeading(li, item);
  }

  function moveIndicator() {
    const active = list.querySelector(".k-list-item--active");
    if (!active) {
      indicator.style.opacity = "0";
      return;
    }
    const first = indicator.dataset.placed !== "1";
    if (first) indicator.style.transition = "none";
    indicator.style.opacity = "1";
    indicator.style.transform = `translateY(${active.offsetTop}px)`;
    indicator.style.height = `${active.offsetHeight}px`;
    if (first) {
      indicator.dataset.placed = "1";
      void indicator.offsetHeight;
      indicator.style.transition = "";
    }
  }

  function render(items) {
    if (drag?.active) {
      pending = items;
      return;
    }
    const before = measure([...rows.values()]);
    const fresh = [];
    const next = items.map((item) => {
      let li = rows.get(item.id);
      if (!li) {
        li = build(item);
        rows.set(item.id, li);
        fresh.push(li);
      }
      update(li, item);
      return li;
    });
    const edges = splitEdges(items);
    next.forEach((li, i) => {
      li.dataset.split = edges[i];
      if (!edges[i]) delete li.dataset.split;
    });
    const keep = new Set(items.map((i) => i.id));
    for (const id of [...rows.keys()]) if (!keep.has(id)) rows.delete(id);
    list.replaceChildren(...next);
    flip(before);
    fresh.forEach(enter);
    moveIndicator();
  }

  return { render, moveIndicator };
}
