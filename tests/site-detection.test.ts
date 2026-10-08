/**
 * Site detection, adapter contracts and fail-safe behaviour for
 * unknown websites.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectAdapter, siteIdForUrl, SUPPORTED_HOST_PATTERNS } from '../src/content/sites/detect';
import { init, getContentState } from '../src/content/index';
import { whatsappAdapter } from '../src/content/sites/whatsapp';
import { instagramAdapter } from '../src/content/sites/instagram';
import { DEFAULT_SETTINGS } from '../src/shared/types';

describe('detectAdapter', () => {
  it('detects WhatsApp on web.whatsapp.com', () => {
    expect(detectAdapter('web.whatsapp.com')?.id).toBe('whatsapp');
  });

  it('detects Instagram on www.instagram.com', () => {
    expect(detectAdapter('www.instagram.com')?.id).toBe('instagram');
  });

  it('returns null for unknown websites', () => {
    expect(detectAdapter('example.com')).toBeNull();
    expect(detectAdapter('evil-whatsapp.com')).toBeNull();
    expect(detectAdapter('')).toBeNull();
  });

  it('does NOT match lookalike or subdomain hosts (exact match only)', () => {
    expect(detectAdapter('web.whatsapp.com.evil.com')).toBeNull();
    expect(detectAdapter('web.whatsapp.com')).not.toBeNull();
    expect(detectAdapter('m.instagram.com')).toBeNull();
    expect(detectAdapter('instagram.com')).toBeNull();
  });
});

describe('siteIdForUrl', () => {
  it('maps supported URLs to their site id', () => {
    expect(siteIdForUrl('https://web.whatsapp.com/')).toBe('whatsapp');
    expect(siteIdForUrl('https://web.whatsapp.com/#starting')).toBe('whatsapp');
    expect(siteIdForUrl('https://www.instagram.com/direct/inbox/')).toBe('instagram');
    expect(siteIdForUrl('https://www.instagram.com/nasa/p/AbC123/')).toBe('instagram');
  });

  it('returns null for unsupported or malformed URLs', () => {
    expect(siteIdForUrl('https://example.com/')).toBeNull();
    expect(siteIdForUrl('not a url')).toBeNull();
    expect(siteIdForUrl('https://www.instagram.com.evil.com/')).toBeNull();
  });
});

describe('supported host patterns (permissions)', () => {
  it('covers exactly the two supported sites', () => {
    expect([...SUPPORTED_HOST_PATTERNS].sort()).toEqual([
      'https://web.whatsapp.com/*',
      'https://www.instagram.com/*',
    ].sort());
  });
});

// ─── Adapter contracts ───────────────────────────────────────────────────────

function expectValidTargets(adapter: typeof whatsappAdapter): void {
  expect(adapter.targets.length).toBeGreaterThan(0);
  for (const target of adapter.targets) {
    // Every target must be gated by a real boolean settings toggle.
    const value = DEFAULT_SETTINGS[target.setting];
    expect(typeof value).toBe('boolean');
    expect(target.type).toMatch(/^[a-z-]+$/);
    // Resolve-only targets may have no selectors, otherwise selectors exist.
    if (!target.resolve) {
      expect(target.selectors.length).toBeGreaterThan(0);
    }
  }
}

describe('WhatsApp adapter', () => {
  it('exposes valid targets', () => {
    expectValidTargets(whatsappAdapter);
  });

  it('groups message content under the message container', () => {
    expect(whatsappAdapter.groupRoots).toContain('[data-testid="msg-container"]');
    expect(whatsappAdapter.groupRoots).toContain('[data-testid="conversation-header"]');
  });

  it('covers the WhatsApp feature set', () => {
    const types = whatsappAdapter.targets.map((t) => t.type);
    expect(types).toContain('message');
    expect(types).toContain('name');
    expect(types).toContain('photo');
    expect(types).toContain('gif-sticker');
    expect(types).toContain('online-status');
    expect(types).toContain('typing');
  });
});

describe('Instagram adapter', () => {
  it('exposes valid targets', () => {
    expectValidTargets(instagramAdapter);
  });

  it('covers the implemented Instagram feature set', () => {
    const types = instagramAdapter.targets.map((t) => t.type);
    expect(types).toContain('photo');
    expect(types).toContain('image');
    expect(types).toContain('video');
    expect(types).toContain('caption');
    expect(types).toContain('comment');
  });

  it('uses structural comment rows as reveal-group roots', () => {
    const comments = instagramAdapter.targets.find((t) => t.type === 'comment')!;
    expect(comments.resolvedAreGroupRoots).toBe(true);
    expect(typeof comments.resolve).toBe('function');
  });
});

// ─── Unknown sites do nothing ────────────────────────────────────────────────

describe('unknown website initialisation', () => {
  beforeEach(async () => {
    await init({ adapter: null, hostname: 'example.com' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not attach the observer, storage listener or adapter', () => {
    const state = getContentState();
    expect(state.adapterId).toBeNull();
    expect(state.observerActive).toBe(false);
    expect(state.storageListenerAttached).toBe(false);
    expect(state.settings).toBeNull();
  });

  it('leaves the DOM untouched even when settings would enable protection', async () => {
    document.body.innerHTML = '<span class="selectable-text">secret</span>';
    // A settings event cannot be accepted without an adapter.
    const { handleSettingsUpdate } = await import('../src/content/index');
    handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll('[data-wnu-protected]').length).toBe(0);
    expect(document.getElementById('wnu-privacy-styles')).toBeNull();
  });
});

describe('supported site initialisation', () => {
  afterEach(async () => {
    const { handleSettingsUpdate } = await import('../src/content/index');
    handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('initialises the Instagram adapter on www.instagram.com', async () => {
    await init({ adapter: null, hostname: 'www.instagram.com' }); // reset
    await init({ hostname: 'www.instagram.com' });

    const state = getContentState();
    expect(state.adapterId).toBe('instagram');
    expect(state.observerActive).toBe(true);
    expect(state.storageListenerAttached).toBe(true);
  });

  it('initialises the WhatsApp adapter on web.whatsapp.com', async () => {
    await init({ hostname: 'web.whatsapp.com' });
    expect(getContentState().adapterId).toBe('whatsapp');
  });
});
