const bar = document.getElementById("snackbar");
const text = bar.querySelector(".k-snackbar__text");
const button = bar.querySelector(".k-snackbar__action");
let timer;
let pending;

function expire() {
  const action = pending;
  pending = null;
  action?.expired?.();
}

export function hideToast() {
  bar.hidden = true;
  expire();
}

export function toast(message, action, duration = 6000) {
  expire();
  pending = action;
  text.textContent = message;
  button.hidden = !action;
  if (action) {
    button.textContent = action.label;
    button.onclick = (e) => {
      e.stopPropagation();
      pending = null;
      hideToast();
      action.run();
    };
  }
  bar.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(hideToast, duration);
}
