/**
 * Vitest global setup
 *
 * Mocks the chrome extension APIs that are not available in jsdom.
 * Real browser APIs are unavailable in the test environment by design.
 */

import { vi } from 'vitest';

// ─── Chrome storage mock ──────────────────────────────────────────────────────

const storageStore: Record<string, unknown> = {};

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
  },
  runtime: {
    lastError: null as { message: string } | null,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
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

export { chromeMock };
