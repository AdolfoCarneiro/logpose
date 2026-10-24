const api = globalThis.chrome?.rangaPrivate;

export const available = Boolean(api);

export function call(name, ...args) {
  if (!api) return Promise.reject(new Error("rangaPrivate indisponível"));
  return new Promise((resolve, reject) => {
    api[name](...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}
