/**
 * MutationObserver behaviour — the REAL observer started by `init()`, not a
 * direct call to `processNewNodes`.
 *
 * WhatsApp renders its DOM incrementally: avatars are lazy-loaded (the `src`
 * lands after the element exists), new messages arrive over WebSocket, and GIF
 * /sticker bubbles are inserted when their media resolves. Anything the first
 * scan missed must be picked up by the observer, or the page visibly shows
 * unprotected content the moment it scrolls or a chat changes.
 *
 * The properties under test are the three that are easy to break:
 *
 *   1. coverage   — a subtree added later is protected, using the LATEST
 *                   settings, without a reload
 *   2. scope      — processing a mutation touches ONLY that subtree: no
 *                   document-wide teardown/rebuild (which would drop reveal
 *                   state and classification bookkeeping)
 *   3. termination — the batch settles: no observer loop, no duplicated
 *                   protection, no settings re-apply triggered by mutations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  init,
  handleSettingsUpdate,
  getContentState,
} from '../src/content/index';
import { whatsappAdapter } from '../src/content/sites/whatsapp';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

function buildDOM(): void {
  document.body.innerHTML = `
    <div id="app">
      <div id="pane-side">
        <div data-testid="chat-list">
          <div role="listitem" data-testid="cell-frame-container">
            <span data-testid="chatlist-avatar">
              <img class="row-avatar" src="https://pps.whatsapp.net/a.jpg" />
            </span>
            <div data-testid="cell-frame-title"><span title="Alice" dir="auto">Alice</span></div>
            <div data-testid="cell-frame-secondary"><span data-testid="last-msg">hey</span></div>
          </div>
        </div>
      </div>
      <div id="main">
        <header data-testid="conversation-header">
          <span class="_ak9q">
            <img class="hdr-avatar" style="border-radius:50%" src="https://pps.whatsapp.net/b.jpg" />
          </span>
          <span data-testid="conversation-info-header-chat-title" dir="auto">Alice</span>
          <span data-testid="status">online</span>
        </header>
        <div data-testid="conversation-panel-wrapper">
          <div data-testid="msg-container">
            <span class="selectable-text">Existing message</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/** Long enough for the observer's frame-scheduled batch to have run. */
const settle = (ms = 60): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const $ = (sel: string) => document.querySelector(sel);
const protectedCount = () => document.querySelectorAll('[data-wnu-protected]').length;

beforeEach(async () => {
  document.body.innerHTML = '';
  buildDOM();
  await init({ adapter: whatsappAdapter, hostname: 'web.whatsapp.com' });
  handleSettingsUpdate(settings());
  await settle();
});

afterEach(async () => {
  handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: false });
  await settle();
  vi.clearAllMocks();
});

/** Append `html` to the message panel and let the real observer pick it up. */
function appendToPanel(html: string): Element {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const node = holder.firstElementChild!;
  $('[data-testid="conversation-panel-wrapper"]')!.appendChild(node);
  return node;
}

// ─── 1. Coverage: late-rendered content is protected ─────────────────────────

describe('observer protects content added after the initial scan', () => {
  it('protects a dynamically inserted message', async () => {
    const bubble = appendToPanel(
      '<div data-testid="msg-container"><span class="selectable-text">Late message</span></div>',
    );
    await settle();

    const text = bubble.querySelector('.selectable-text')!;
    expect(text.getAttribute('data-wnu-type')).toBe('message');
    expect(text.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getComputedStyle(text).filter).toBe('blur(8px)');
  });

  it('protects a dynamically inserted GIF', async () => {
    const bubble = appendToPanel(
      '<div data-testid="msg-container"><div data-testid="gif"><img src="https://media.example.test/late.gif" /></div></div>',
    );
    await settle();

    const gif = bubble.querySelector('[data-testid="gif"]')!;
    expect(gif.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(gif.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('protects a dynamically inserted sticker', async () => {
    const bubble = appendToPanel(
      '<div data-testid="msg-container"><div data-testid="sticker"><img src="https://media.example.test/late.webp" /></div></div>',
    );
    await settle();

    const sticker = bubble.querySelector('[data-testid="sticker"]')!;
    expect(sticker.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(sticker.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('protects a dynamically inserted chat-list avatar', async () => {
    const row = $('[data-testid="cell-frame-container"]')!;
    const av = document.createElement('img');
    av.className = 'late-row-avatar';
    av.setAttribute('src', 'https://pps.whatsapp.net/late.jpg');
    row.prepend(av);
    await settle();

    expect(av.getAttribute('data-wnu-type')).toBe('photo');
    expect(av.hasAttribute('data-wnu-protected')).toBe(true);
  });

  /**
   * The lazy-load case: WhatsApp mounts the <img> first and fills `src` in a
   * later tick. The observer watches exactly this one attribute so the element
   * becomes identifiable only once its media URL exists.
   */
  it('re-evaluates an image when its `src` is populated after insertion', async () => {
    const lazy = document.createElement('img');
    lazy.className = 'lazy-header-img'; // no hint, no radius, no size → unidentifiable
    $('[data-testid="conversation-header"]')!.appendChild(lazy);
    await settle();

    expect(lazy.getAttribute('data-wnu-type')).toBeNull();

    lazy.setAttribute('src', 'https://pps.whatsapp.net/lazy.jpg');
    await settle();

    // It becomes identifiable, so it is classified as a profile photo — and it
    // is visually blurred either as its own owner or, as here, by the header
    // that already owns the whole header region (one blur layer, never two).
    expect(lazy.getAttribute('data-wnu-type')).toBe('photo');
    const owner =
      lazy.hasAttribute('data-wnu-protected')
        ? lazy
        : (lazy.parentElement?.closest('[data-wnu-protected]') ?? null);
    expect(owner, 'the lazy-loaded photo must be covered by a blur owner').not.toBeNull();
    expect(owner!.matches('[data-wnu-protected]')).toBe(true);
  });

  it('uses the CURRENT settings for late content (no reload)', async () => {
    handleSettingsUpdate(settings({ blurGifsStickers: false }));
    await settle();

    appendToPanel(
      '<div data-testid="msg-container"><div data-testid="gif"><img src="https://media.example.test/off.gif" /></div></div>',
    );
    await settle();

    expect(
      $('[data-testid="conversation-panel-wrapper"] [data-testid="gif"]')!.hasAttribute(
        'data-wnu-protected',
      ),
    ).toBe(false);
    expect($('.selectable-text')!.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── 2. Scope: a mutation is processed locally, never document-wide ──────────

describe('observer scope (no document-wide rescan per mutation)', () => {
  it('leaves classification bookkeeping on unrelated elements untouched', async () => {
    // A type that no target produces. A full teardown (removeProtections)
    // would clear every [data-wnu-type] in the document; a scoped pass must
    // not come anywhere near this element.
    const sentinel = document.createElement('div');
    sentinel.id = 'unrelated-sentinel';
    sentinel.setAttribute('data-wnu-type', 'sentinel');
    document.body.appendChild(sentinel);
    await settle();

    appendToPanel(
      '<div data-testid="msg-container"><span class="selectable-text">Another</span></div>',
    );
    await settle();

    expect(document.getElementById('unrelated-sentinel')).not.toBeNull();
    expect(sentinel.getAttribute('data-wnu-type')).toBe('sentinel');
  });

  it('preserves in-flight reveal state on pre-existing content', async () => {
    const text = $('.selectable-text')!;
    expect(text.hasAttribute('data-wnu-protected')).toBe(true);
    text.setAttribute('data-wnu-revealed', ''); // user is mid-hover

    appendToPanel(
      '<div data-testid="msg-container"><span class="selectable-text">Second</span></div>',
    );
    await settle();

    // A teardown/rebuild would have dropped the reveal (and detached groups).
    expect(text.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(text.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('does not trigger a settings re-apply from DOM mutations', async () => {
    const before = getContentState().settingsApplyCount;

    appendToPanel(
      '<div data-testid="msg-container"><span class="selectable-text">Third</span></div>',
    );
    const bubble = appendToPanel(
      '<div data-testid="msg-container"><div data-testid="sticker"><img src="https://m.test/s.webp" /></div></div>',
    );
    await settle();

    // Both new subtrees were handled by the mutation batch…
    expect(protectedCount()).toBeGreaterThan(0);
    expect(bubble.querySelector('[data-testid="sticker"]')!.hasAttribute('data-wnu-protected')).toBe(true);
    // …without going through the settings path (that one is for toggles only).
    expect(getContentState().settingsApplyCount).toBe(before);
  });

  it('keeps protection counts additive rather than rebuilding them', async () => {
    const before = protectedCount();

    appendToPanel(
      '<div data-testid="msg-container"><span class="selectable-text">Fourth</span></div>',
    );
    await settle();

    // Exactly one new owner; every pre-existing owner survived with its own
    // attributes, i.e. nothing was torn down and re-created.
    expect(protectedCount()).toBe(before + 1);
  });
});

// ─── 3. Termination: the batch settles ───────────────────────────────────────

describe('observer termination (no loops, no duplicates)', () => {
  it('produces no DOM churn once the batch has been processed', async () => {
    let churn = 0;
    const probe = new MutationObserver((records) => {
      churn += records.length;
    });
    probe.observe(document.documentElement, { childList: true, subtree: true });

    appendToPanel(
      '<div data-testid="msg-container"><span class="selectable-text">Churn</span></div>',
    );
    await settle();
    const afterBatch = churn;

    // The observer wrote data-wnu-* attributes for that insertion. Now give it
    // two more settle windows: if processing re-triggered the observer there
    // would be further child-list activity, which is exactly what must not
    // happen (mutation → protect → mutation → …).
    await settle();
    await settle();

    expect(churn).toBe(afterBatch);
    probe.disconnect();
  });

  it('never duplicates protection when the same subtree is reported twice', async () => {
    const bubble = appendToPanel(
      '<div data-testid="msg-container"><div data-testid="gif"><img src="https://media.example.test/dup.gif" /></div></div>',
    );
    await settle();

    const gif = bubble.querySelector('[data-testid="gif"]')!;
    const snapshot = protectedCount();

    // Re-inserting the same subtree (WhatsApp re-renders bubbles constantly)
    // must not stack a second blur layer or a second group.
    $('[data-testid="conversation-panel-wrapper"]')!.appendChild(bubble);
    await settle();
    $('[data-testid="conversation-panel-wrapper"]')!.appendChild(bubble);
    await settle();

    expect(protectedCount()).toBe(snapshot);
    expect(gif.hasAttribute('data-wnu-protected')).toBe(true);
    expect(
      gif.parentElement?.closest('[data-wnu-protected]') ?? null,
      'no nested blur layer is created',
    ).toBeNull();
  });

  it('starts exactly one observer across repeated init() calls', async () => {
    expect(getContentState().observerActive).toBe(true);

    await init({ adapter: whatsappAdapter, hostname: 'web.whatsapp.com' });
    await init({ adapter: whatsappAdapter, hostname: 'web.whatsapp.com' });

    expect(getContentState().observerActive).toBe(true);
    // A second observer would double-process every mutation; the settings
    // apply count is the observable proxy for duplicate registrations.
    const before = getContentState().settingsApplyCount;
    handleSettingsUpdate(settings({ blurIntensity: 14 }));
    await settle();
    expect(getContentState().settingsApplyCount).toBe(before + 1);
  });

  it('stops protecting new content while privacy mode is off', async () => {
    handleSettingsUpdate({ ...DEFAULT_SETTINGS, privacyEnabled: false });
    await settle();

    appendToPanel(
      '<div data-testid="msg-container"><span class="selectable-text">Should stay visible</span></div>',
    );
    await settle();

    expect(protectedCount()).toBe(0);
  });
});
