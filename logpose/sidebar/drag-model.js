const EDGES = "left,right,top,bottom";

export function windowAt(pointer, windows) {
  return windows.find((w) => pointer.x >= w.x && pointer.x < w.x + w.width && pointer.y >= w.y && pointer.y < w.y + w.height) ?? null;
}

export function chromeWindowFor(found, windows) {
  const matches = windows.filter((w) => `${w.title} - Log Pose` === found.title);
  return matches.length === 1 ? matches[0] : null;
}

export function zonesFor({ dragged, partner, own }) {
  if (own) return !dragged || dragged.splitViewId > 0 || !partner || partner.id === dragged.id || partner.splitViewId > 0 ? "window" : `${EDGES},window`;
  return !partner || partner.splitViewId > 0 ? "join" : `${EDGES},join`;
}
