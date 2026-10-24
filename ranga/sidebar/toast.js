const bar = document.getElementById("snackbar");
const text = bar.querySelector(".k-snackbar__text");
const button = bar.querySelector(".k-snackbar__action");
let timer;

export function hideToast() {
  bar.hidden = true;
}

export function toast(message, action) {
  text.textContent = message;
  button.hidden = !action;
  if (action) {
    button.textContent = action.label;
    button.onclick = (e) => {
      e.stopPropagation();
      hideToast();
      action.run();
    };
  }
  bar.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(hideToast, 6000);
}
