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

// jsdom does not implement Element.prototype.scrollIntoView. Components that
// scroll on mount or interaction — e.g. the issue thread now lands on the
// latest message by default — would otherwise throw under test. Provide a no-op
// only when it's missing so tests that spy on or override it keep working.
if (typeof window !== "undefined" && typeof window.Element !== "undefined") {
  const elementProto = window.Element.prototype as unknown as {
    scrollIntoView?: (...args: unknown[]) => void;
  };
  if (typeof elementProto.scrollIntoView !== "function") {
    elementProto.scrollIntoView = function scrollIntoView() {};
  }
}
