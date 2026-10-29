import { glyph } from "./kurobe/icons.mjs";

const menu = document.getElementById("context-menu");

export function hideMenu() {
  menu.hidden = true;
}

export function showMenu(entries, x, y) {
  menu.replaceChildren(...entries.map((entry) => {
    if (entry === "divider") {
      const hr = document.createElement("li");
      hr.className = "k-menu__divider";
      hr.setAttribute("role", "separator");
      return hr;
    }
    if (entry.heading) {
      const title = document.createElement("li");
      title.className = "k-menu__heading k-type-caption";
      title.setAttribute("role", "presentation");
      title.textContent = entry.heading;
      return title;
    }
    const li = document.createElement("li");
    li.className = "k-menu__item k-state k-type-label" + (entry.danger ? " k-menu__item--danger" : "");
    li.setAttribute("role", "menuitem");
    li.innerHTML = `<span class="k-icon"></span><span></span>`;
    li.firstChild.textContent = glyph(entry.icon);
    li.lastChild.textContent = entry.label;
    li.onclick = (e) => {
      e.stopPropagation();
      hideMenu();
      entry.action();
    };
    return li;
  }));
  menu.style.visibility = "hidden";
  menu.hidden = false;
  const { offsetWidth: width, offsetHeight: height } = menu;
  const left = Math.max(8, Math.min(x, innerWidth - width - 8));
  const top = Math.max(8, Math.min(y, innerHeight - height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.transformOrigin = `${x - left}px ${y - top}px`;
  menu.hidden = true;
  menu.style.visibility = "";
  requestAnimationFrame(() => { menu.hidden = false; });
}

document.addEventListener("click", hideMenu);
document.addEventListener("contextmenu", (e) => { if (!menu.contains(e.target)) hideMenu(); }, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideMenu(); });
window.addEventListener("blur", hideMenu);
