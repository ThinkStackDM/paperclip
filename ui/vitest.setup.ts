const storageEntries = new Map<string, string>();

function installStorageMock(target: Record<string, unknown>) {
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storageEntries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageEntries.set(key, String(value));
      },
      removeItem: (key: string) => {
        storageEntries.delete(key);
      },
      clear: () => {
        storageEntries.clear();
      },
    },
  });
}

if (
  typeof globalThis.localStorage?.getItem !== "function"
  || typeof globalThis.localStorage?.setItem !== "function"
  || typeof globalThis.localStorage?.removeItem !== "function"
  || typeof globalThis.localStorage?.clear !== "function"
) {
  installStorageMock(globalThis);
}

if (typeof window !== "undefined" && window.localStorage !== globalThis.localStorage) {
  installStorageMock(window as unknown as Record<string, unknown>);
}

// jsdom does not implement Element.prototype.scrollIntoView. Several surfaces
// (e.g. IssueChatThread's auto-scroll-to-latest, and the issue thread now
// landing on the latest message by default) call it during normal render, so
// provide a no-op default only when it's missing. Tests that assert on scroll
// behaviour spy on or override it on the prototype themselves and restore it.
if (typeof window !== "undefined" && typeof window.Element !== "undefined") {
  const elementProto = window.Element.prototype as unknown as {
    scrollIntoView?: (...args: unknown[]) => void;
  };
  if (typeof elementProto.scrollIntoView !== "function") {
    elementProto.scrollIntoView = function scrollIntoView() {};
  }
}
