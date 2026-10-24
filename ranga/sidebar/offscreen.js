chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "offscreen-copy") return;
  const buffer = document.getElementById("buffer");
  buffer.value = msg.text;
  buffer.select();
  document.execCommand("copy");
});
