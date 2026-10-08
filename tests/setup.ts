/**
 * Vitest global setup
 *
 * Mocks the chrome extension APIs that are not available in jsdom.
 * Real browser APIs are unavailable in the test environment by design.
 */

import { vi } from 'vitest';

// ─── Chrome storage mock ──────────────────────────────────────────────────────

const storageStore: Record<string, unknown> = {};

type StorageChangeListener = (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  areaName: string,
) => void;

const storageChangeListeners: StorageChangeListener[] = [];

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((key: string, callback: (result: Record<string, unknown>) => void) => {
        callback({ [key]: storageStore[key] });
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(storageStore, items);
        callback?.();
      }),
    },
    onChanged: {
      addListener: vi.fn((listener: StorageChangeListener) => {
        storageChangeListeners.push(listener);
      }),
    },
  },
  runtime: {
    lastError: null as { message: string } | null,
    // MV3 sendMessage returns a Promise; mirror that so `.catch()` works.
    sendMessage: vi.fn(() => Promise.resolve(undefined)),
    onMessage: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
  },
  tabs: {
    query: vi.fn(),
    // MV3 sendMessage returns a Promise; mirror that so `.catch()` works.
    sendMessage: vi.fn(() => Promise.resolve(undefined)),
    create: vi.fn(),
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
};

// Expose on globalThis so any module that accesses `chrome` sees the mock.
(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// Helper to reset storage between tests
export function resetStorage(): void {
  for (const key of Object.keys(storageStore)) {
    delete storageStore[key];
  }
}

/**
 * Fire a chrome.storage.onChanged event to every registered listener,
 * exactly like the real API would.
 */
export function fireStorageChange(
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  areaName = 'local',
): void {
  for (const listener of [...storageChangeListeners]) {
    listener(changes, areaName);
  }
}

/** Registered storage.onChanged listener count (duplicate-listener checks). */
export function storageChangeListenerCount(): number {
  return storageChangeListeners.length;
}

export { chromeMock };
