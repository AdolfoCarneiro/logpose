const api = globalThis.chrome?.logposePrivate;

export const available = Boolean(api);

export function call(name, ...args) {
  if (!api) return Promise.reject(new Error("logposePrivate indisponível"));
  return new Promise((resolve, reject) => {
    api[name](...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}
