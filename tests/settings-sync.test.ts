/**
 * Regression tests for BUG #2: settings only applied after reloading
 * WhatsApp.
 *
 * Architecture under test:
 *
 *   popup → chrome.storage.local → chrome.storage.onChanged (content script)
 *         → existing DOM reprocessed → UI changes immediately
 *
 * No page reload, no polling, no duplicate listeners.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  init,
  handleSettingsUpdate,
  getContentState,
  processAddedNodes,
} from '../src/content/index';
import { whatsappAdapter } from '../src/content/sites/whatsapp';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';
import { STORAGE_KEY } from '../src/shared/storage';
import { fireStorageChange, storageChangeListenerCount } from './setup';

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

function buildDOM(): void {
  document.body.innerHTML = `
    <div id="pane-side">
      <span title="Alice" dir="ltr">Alice</span>
      <span data-testid="last-msg">Hey there</span>
      <img alt="Profile photo" src="https://example.com/avatar.jpg" />
    </div>
    <div id="main">
      <header data-testid="conversation-header">
        <span data-testid="conversation-info-header-chat-title" dir="ltr">Alice</span>
        <span data-testid="status">online</span>
        <span data-testid="typing">typing…</span>
      </header>
      <div data-testid="conversation-panel-wrapper">
        <div data-testid="msg-container">
          <span class="selectable-text">Hello world</span>
        </div>
        <div data-testid="sticker" data-animated="true">🎉</div>
        <div data-testid="image-thumb"><img alt="photo" src="x.jpg" /></div>
      </div>
    </div>
  `;
}

/** Drain the coalesced settings flush (queueMicrotask) plus timers. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const $ = (sel: string) => document.querySelector(sel);

beforeEach(async () => {
  buildDOM();
  await init({ adapter: whatsappAdapter, hostname: 'web.whatsapp.com' });
});

afterEach(async () => {
  handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: false });
  await flush();
  vi.clearAllMocks();
});

// ─── 1. Settings update event ────────────────────────────────────────────────

describe('settings update event', () => {
  it('applies settings received via chrome.storage.onChanged', async () => {
    expect($('[data-testid="msg-container"] [data-wnu-protected]')).toBeNull();

    fireStorageChange({
      [STORAGE_KEY]: { newValue: { ...DEFAULT_SETTINGS, privacyEnabled: true } },
    });
    await flush();

    expect($('.selectable-text')?.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getContentState().settingsApplyCount).toBeGreaterThan(0);
  });

  it('applies settings received via the SETTINGS_UPDATED-equivalent direct update', async () => {
    handleSettingsUpdate(settings());
    await flush();

    expect($('.selectable-text')?.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getContentState().adapterId).toBe('whatsapp');
  });

  it('ignores storage changes for other keys and other storage areas', async () => {
    handleSettingsUpdate(settings());
    await flush();
    const before = getContentState().settingsApplyCount;

    fireStorageChange({ some_other_key: { newValue: { a: 1 } } }, 'local');
    fireStorageChange({ [STORAGE_KEY]: { newValue: { ...DEFAULT_SETTINGS, privacyEnabled: true } } }, 'sync');
    await flush();

    expect(getContentState().settingsApplyCount).toBe(before);
  });
});

// ─── 2. Disabling a category removes existing protection ────────────────────

describe('disabling a category', () => {
  it('removes protection from already-rendered elements immediately (no reload)', async () => {
    handleSettingsUpdate(settings({ blurGifsStickers: true }));
    await flush();
    expect($('[data-testid="sticker"]')?.hasAttribute('data-wnu-protected')).toBe(true);

    handleSettingsUpdate(settings({ blurGifsStickers: false }));
    await flush();

    expect($('[data-testid="sticker"]')?.hasAttribute('data-wnu-protected')).toBe(false);
    // Other protections survive the toggle.
    expect($('.selectable-text')?.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('removes ALL protection when privacy mode is turned off', async () => {
    handleSettingsUpdate(settings());
    await flush();
    expect(document.querySelectorAll('[data-wnu-protected]').length).toBeGreaterThan(0);

    handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: false });
    await flush();

    expect(document.querySelectorAll('[data-wnu-protected]').length).toBe(0);
    expect(document.getElementById('wnu-privacy-styles')).toBeNull();
  });

  it('drops stale reveal state when settings change (no stuck reveals)', async () => {
    handleSettingsUpdate(settings());
    await flush();

    const text = $('.selectable-text')!;
    text.setAttribute('data-wnu-revealed', ''); // simulate a mid-hover update

    handleSettingsUpdate(settings({ blurIntensity: 12 }));
    await flush();

    expect($('.selectable-text')?.hasAttribute('data-wnu-revealed')).toBe(false);
    expect($('.selectable-text')?.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── 3. Enabling a category protects existing elements ──────────────────────

describe('enabling a category', () => {
  it('protects already-rendered elements immediately (no reload)', async () => {
    handleSettingsUpdate(settings({ blurImages: false }));
    await flush();
    expect($('[data-testid="image-thumb"]')?.hasAttribute('data-wnu-protected')).toBe(false);

    handleSettingsUpdate(settings({ blurImages: true }));
    await flush();

    expect($('[data-testid="image-thumb"]')?.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('enabling privacy mode protects the whole existing DOM', async () => {
    handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: false });
    await flush();
    expect(document.querySelectorAll('[data-wnu-protected]').length).toBe(0);

    handleSettingsUpdate(settings());
    await flush();

    expect(document.querySelectorAll('[data-wnu-protected]').length).toBeGreaterThan(0);
  });
});

// ─── 4. New DOM respects the latest settings ─────────────────────────────────

describe('MutationObserver with latest settings', () => {
  it('does NOT protect newly inserted elements for a disabled category', async () => {
    handleSettingsUpdate(settings({ blurMessages: false }));
    await flush();

    const newMsg = document.createElement('span');
    newMsg.className = 'selectable-text';
    newMsg.textContent = 'New message';
    document.querySelector('[data-testid="conversation-panel-wrapper"]')!.appendChild(newMsg);

    processAddedNodes([newMsg]);

    expect(newMsg.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('protects newly inserted elements once their category is enabled', async () => {
    handleSettingsUpdate(settings({ blurMessages: true }));
    await flush();

    const newMsg = document.createElement('span');
    newMsg.className = 'selectable-text';
    newMsg.textContent = 'New message';
    document.querySelector('[data-testid="conversation-panel-wrapper"]')!.appendChild(newMsg);

    processAddedNodes([newMsg]);

    expect(newMsg.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getContentState().settings).toEqual(settings({ blurMessages: true }));
  });

  it('does not process new nodes while privacy mode is off', async () => {
    handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: false });
    await flush();

    const newMsg = document.createElement('span');
    newMsg.className = 'selectable-text';
    document.body.appendChild(newMsg);

    processAddedNodes([newMsg]);
    expect(newMsg.hasAttribute('data-wnu-protected')).toBe(false);
  });
});

// ─── 5. Repeated updates don't create duplicate listeners ───────────────────

describe('repeated updates', () => {
  it('never registers the storage listener more than once', async () => {
    const before = storageChangeListenerCount();

    await init({ adapter: whatsappAdapter, hostname: 'web.whatsapp.com' });
    await init({ adapter: whatsappAdapter, hostname: 'web.whatsapp.com' });

    expect(storageChangeListenerCount()).toBe(before);
    expect(storageChangeListenerCount()).toBe(1);
  });

  it('coalesces identical updates into a single re-apply', async () => {
    const before = getContentState().settingsApplyCount;

    const next = settings({ blurGifsStickers: false });
    handleSettingsUpdate(next);
    handleSettingsUpdate(next);
    handleSettingsUpdate(next);
    await flush();

    expect(getContentState().settingsApplyCount).toBe(before + 1);
  });

  it('deduplicates the popup message path against the storage event', async () => {
    const before = getContentState().settingsApplyCount;
    const payload = { ...DEFAULT_SETTINGS, privacyEnabled: true };

    // Storage event first, then the redundant direct message with the same
    // payload — exactly what popup + storage propagation produce together.
    fireStorageChange({ [STORAGE_KEY]: { newValue: payload } });
    handleSettingsUpdate({ ...DEFAULT_SETTINGS, ...payload });
    await flush();

    expect(getContentState().settingsApplyCount).toBe(before + 1);
    expect($('.selectable-text')?.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('applies the latest of several rapid different updates', async () => {
    const before = getContentState().settingsApplyCount;

    handleSettingsUpdate(settings({ blurImages: true }));
    handleSettingsUpdate(settings({ blurImages: false }));
    await flush();

    expect(getContentState().settingsApplyCount).toBe(before + 1);
    expect($('[data-testid="image-thumb"]')?.hasAttribute('data-wnu-protected')).toBe(false);
  });
});

// ─── 6. No reload required ───────────────────────────────────────────────────

describe('no reload required', () => {
  it('updates the same live DOM without re-initialising the page', async () => {
    const sentinel = document.createElement('div');
    sentinel.id = 'test-sentinel';
    document.body.appendChild(sentinel);

    handleSettingsUpdate(settings({ blurGifsStickers: true }));
    await flush();
    const applyCountAfterFirst = getContentState().settingsApplyCount;

    handleSettingsUpdate(settings({ blurGifsStickers: false }));
    await flush();

    // Same document, same adapter, no re-init — only the DOM changed.
    expect(document.getElementById('test-sentinel')).toBe(sentinel);
    expect(getContentState().adapterId).toBe('whatsapp');
    expect(getContentState().observerActive).toBe(true);
    expect(getContentState().settingsApplyCount).toBe(applyCountAfterFirst + 1);
    expect($('[data-testid="sticker"]')?.hasAttribute('data-wnu-protected')).toBe(false);
  });
});
