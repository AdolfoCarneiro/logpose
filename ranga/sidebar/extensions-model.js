export const MAX_DEFAULT_PINS = 4;

export function others(actions, ownId) {
  return actions
    .filter((a) => a.id !== ownId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export function pinnedIds(stored, actions) {
  if (Array.isArray(stored)) return stored;
  return actions.slice(0, MAX_DEFAULT_PINS).map((a) => a.id);
}

export function pinnedActions(actions, ids) {
  const byId = new Map(actions.map((a) => [a.id, a]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export function togglePin(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
