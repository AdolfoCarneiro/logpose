const MINUTE = 60 * 1000;

function archivable(tab) {
  return /^https?:\/\//.test(tab.url || "");
}

export function plan(tabs, now, { sleepAfterMinutes, archiveAfterHours }, kept = new Set()) {
  const sleep = [];
  const archive = [];
  for (const tab of tabs) {
    if (!tab.lastAccessed || tab.active) continue;
    const idle = now - tab.lastAccessed;
    if (archiveAfterHours > 0 && !tab.pinned && !kept.has(tab.id) && archivable(tab) && idle >= archiveAfterHours * 60 * MINUTE) {
      archive.push(tab.id);
    } else if (sleepAfterMinutes > 0 && !tab.audible && !tab.discarded && idle >= sleepAfterMinutes * MINUTE) {
      sleep.push(tab.id);
    }
  }
  return { sleep, archive };
}

export function archiveEntry(tab, space, now) {
  return { url: tab.url, title: tab.title || tab.url, favIconUrl: tab.favIconUrl || "", space, archivedAt: now };
}

export function pushArchive(archive, entries, limit = 300) {
  return [...entries, ...(archive ?? [])].sort((a, b) => b.archivedAt - a.archivedAt).slice(0, limit);
}
