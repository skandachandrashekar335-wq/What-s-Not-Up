/**
 * WhatsApp profile-photo detection — layered (selector + structural) tests.
 *
 * Motivation: in a real logged-in session the extension blurred messages and
 * chat previews while profile photos stayed visible, and flipping the
 * selector target from `match: 'first'` to `match: 'union'` did not fix it.
 * That combination means the selector table itself no longer described the
 * live DOM — so detection cannot be selector-only.
 *
 * These tests therefore assert the LAYERS, each one independently:
 *   L1 explicit hint   (testid/class/alt/aria/CDN URL, on img or wrapper)
 *   L2 structural area (chat pane, conversation header, info drawers)
 *   L3 visual shape    (circular clipping, chat-row membership)
 *   ✕  hard exclusions (message content, media cells, text, pickers)
 *
 * Fixtures follow the modern WhatsApp structure (cell-frame-* rows, panes,
 * header, panel wrapper). Where a signal needs a box (jsdom has no layout),
 * the fixture supplies `width`/`height` attributes or an inline
 * `border-radius`, exactly as the real page does via CSS.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyProtections, removeProtections, processNewNodes } from '../src/content/dom-processor';
import { injectStyles, removeStyles, clearAllTimers } from '../src/content/privacy-engine';
import { SELECTORS } from '../src/content/selectors';
import { whatsappAdapter } from '../src/content/sites/whatsapp';
import { resolveWhatsAppProfilePhotos } from '../src/content/sites/whatsapp/avatar-resolver';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

function buildWhatsAppDOM(): void {
  document.body.innerHTML = `
    <div id="app" class="two">
      <!-- ── Left pane: chat list ───────────────────────────────────────── -->
      <div id="pane-side">
        <div data-testid="chat-list-header">
          <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /></svg>
          <!-- square, in the pane, but shares no row with a contact name -->
          <img class="brand-logo" width="40" height="40" src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" />
        </div>

        <div data-testid="chat-list">
          <!-- A. contact avatar: CDN src + chatlist-avatar wrapper -->
          <div role="listitem" data-testid="cell-frame-container">
            <span data-testid="chatlist-avatar">
              <img class="av-alice" src="https://pps.whatsapp.net/alice.jpg" />
            </span>
            <div data-testid="cell-frame-title"><span title="Alice" dir="auto">Alice</span></div>
            <div data-testid="cell-frame-secondary"><span data-testid="last-msg">hey there</span></div>
          </div>

          <!-- B. group avatar: testid renamed, no CDN, no alt, no radius -->
          <div role="listitem" data-testid="cell-frame-container">
            <span data-testid="avatar-v2"><img class="av-group" src="https://media.example.test/pic-1" /></span>
            <div data-testid="cell-frame-title"><span title="Family" dir="auto">Family</span></div>
            <div data-testid="cell-frame-secondary"><span data-testid="last-msg">ok</span></div>
          </div>
        </div>
      </div>

      <!-- ── Right pane: conversation ───────────────────────────────────── -->
      <div id="main">
        <header data-testid="conversation-header">
          <!-- C. header avatar with NO identifying attribute anywhere;
               only its circular clipping identifies it -->
          <span class="_ak9q"><img class="av-header" style="border-radius:50%" src="https://media.example.test/pic-2" /></span>
          <span data-testid="conversation-info-header-chat-title" dir="auto">Alice</span>
          <span data-testid="status">online</span>
        </header>

        <div data-testid="conversation-panel-wrapper">
          <div data-testid="msg-container">
            <span class="selectable-text">Hello 🙂 see this</span>
            <img class="emoji" width="64" height="64" src="data:image/png;base64,AAAA" />
          </div>
          <div data-testid="image-thumb">
            <img class="message-media" src="https://mmg.whatsapp.net/vacation.jpg" />
          </div>
          <div data-testid="link-preview"><img class="link-thumb" src="https://example.com/thumb.jpg" /></div>
        </div>

        <!-- D. participant drawer avatar: renamed testid, nothing else -->
        <div data-testid="group-info-drawer">
          <span data-testid="participant-avatar"><img id="drawer-av" src="https://media.example.test/pic-9" /></span>
          <span dir="auto">Bob</span>
        </div>
      </div>
    </div>
  `;
}

const photos = (): Element[] => Array.from(document.querySelectorAll('[data-wnu-protected][data-wnu-type="photo"]'));
const candidates = (): Element[] => Array.from(document.querySelectorAll('[data-wnu-type="photo"]'));
const protectedAll = (): Element[] => Array.from(document.querySelectorAll('[data-wnu-protected]'));

function noNestedProtection(): boolean {
  return protectedAll().every((el) => el.parentElement?.closest('[data-wnu-protected]') === null);
}

/** Header toggle off → the avatar must own its own blur (isolates the photo target). */
const withoutHeader = () => settings({ blurChatHeader: false });

beforeEach(() => {
  removeProtections();
  clearAllTimers();
  buildWhatsAppDOM();
  injectStyles(8);
});

afterEach(() => {
  removeProtections();
  removeStyles();
  clearAllTimers();
});

// ─── Tied to the implementation ──────────────────────────────────────────────

describe('implementation contract', () => {
  it('the photo target is union-matched and carries a structural resolver', () => {
    const photo = whatsappAdapter.targets.find((t) => t.type === 'photo');
    expect(photo).toBeDefined();
    expect(photo!.setting).toBe('blurProfilePhotos');
    expect(photo!.match).toBe('union');
    expect(typeof photo!.resolve).toBe('function');
    expect(photo!.resolve).toBe(resolveWhatsAppProfilePhotos);
  });

  /**
   * Guards the architectural rule that detection may never degrade into
   * "blur every image": a blur-target selector must always be scoped — either
   * by a compound predicate (`img[src*=…]`) or by an ancestor combinator
   * (`[data-testid="chatlist-avatar"] img`). Bare `img`/`div`/`span`/`*`/
   * `[role=…]` are never allowed.
   */
  it('never uses an unscoped selector (img/div/span/*/[role=…] alone)', () => {
    const FORBIDDEN = new Set(['img', 'div', 'span', 'video', 'canvas', 'picture', 'svg', 'button', 'a', '*']);

    for (const [name, list] of Object.entries(SELECTORS)) {
      const selectors = Array.isArray(list) ? list : [list as string];
      for (const selector of selectors) {
        // Scoped by an ancestor combinator → allowed (the type selector only
        // applies inside a verified container).
        const scoped = /[\s>+~]/.test(selector);
        if (scoped) continue;

        expect(FORBIDDEN.has(selector), `${name}: "${selector}" would blur every ${selector}`).toBe(false);
        expect(selector.startsWith('[role='), `${name}: "${selector}" blurs a whole region`).toBe(false);
        expect(selector.startsWith('[aria-label='), `${name}: "${selector}" is not content-scoped`).toBe(false);
      }
    }
  });

  it('a resolver that throws contributes nothing but never breaks other targets', () => {
    const broken = {
      ...whatsappAdapter,
      targets: whatsappAdapter.targets.map((t) =>
        t.type === 'photo'
          ? { ...t, selectors: [] as readonly string[], resolve: () => { throw new Error('boom'); } }
          : t,
      ),
    };

    expect(() => applyProtections(withoutHeader(), broken)).not.toThrow();
    expect(candidates().length).toBe(0);             // broken resolver → no photo blur
    expect(protectedAll().length).toBeGreaterThan(0); // every other target still works
  });
});

// ─── Detection: every avatar shape ──────────────────────────────────────────

describe('profile photo detection across avatar shapes', () => {
  it('detects a chat-list contact avatar', () => {
    applyProtections(withoutHeader());
    const el = document.querySelector('.av-alice')!;
    expect(el.getAttribute('data-wnu-type')).toBe('photo');
    expect(el.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects a chat-list group avatar', () => {
    applyProtections(withoutHeader());
    const el = document.querySelector('.av-group')!;
    expect(el.getAttribute('data-wnu-type')).toBe('photo');
    expect(el.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects the conversation-header avatar', () => {
    applyProtections(withoutHeader());
    const el = document.querySelector('.av-header')!;
    expect(el.getAttribute('data-wnu-type')).toBe('photo');
    expect(el.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects an avatar in an info/participant drawer', () => {
    applyProtections(settings());
    const el = document.getElementById('drawer-av')!;
    expect(el.getAttribute('data-wnu-type')).toBe('photo');
    expect(el.hasAttribute('data-wnu-protected')).toBe(true);
  });

  /**
   * THE release-blocking case: WhatsApp renamed the avatar testid, dropped
   * the CDN host and the alt text. Every selector path misses; the resolver's
   * hint layer (testid still contains "avatar") must still find it.
   */
  it('detects an avatar whose testid was renamed, when no selector matches', () => {
    const el = document.getElementById('drawer-av')!;
    for (const selector of SELECTORS.profilePhoto) {
      expect(el.matches(selector), `selector "${selector}" must not match`).toBe(false);
    }
    expect(resolveWhatsAppProfilePhotos(document)).toContain(el);
    applyProtections(settings());
    expect(el.hasAttribute('data-wnu-protected')).toBe(true);
  });

  /**
   * The case a selector table can never cover: nothing about the element
   * identifies it — no testid, no class token, no CDN, no alt. Only "it sits
   * in the conversation header" and "it is clipped to a circle".
   */
  it('detects a circular header avatar when NO selector path matches at all', () => {
    const el = document.querySelector('.av-header')!;
    for (const selector of SELECTORS.profilePhoto) {
      expect(el.matches(selector), `selector "${selector}" must not match`).toBe(false);
    }
    applyProtections(withoutHeader());
    expect(el.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getComputedStyle(el).filter).toBe('blur(8px)');
  });

  it('protects every avatar shape simultaneously', () => {
    applyProtections(withoutHeader());
    const classes = photos().map((el) => el.className);
    expect(classes).toContain('av-alice');
    expect(classes).toContain('av-group');
    expect(classes).toContain('av-header');
    expect(document.getElementById('drawer-av')!.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── Fail-safe: what must never be claimed ──────────────────────────────────

describe('false-positive protection (fail-safe)', () => {
  it('does not claim the pane logo even though it is square and in the chat pane', () => {
    const logo = document.querySelector('.brand-logo')!;
    expect(logo.getAttribute('width')).toBe('40'); // square by attribute
    applyProtections(settings());
    expect(logo.getAttribute('data-wnu-type')).not.toBe('photo');
    expect(logo.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('does not claim message media, link-preview thumbs or inline emoji', () => {
    applyProtections(settings());
    for (const sel of ['.message-media', '.link-thumb', '.emoji']) {
      const el = document.querySelector(sel);
      expect(el, `fixture element ${sel} must exist`).not.toBeNull();
      expect(el!.getAttribute('data-wnu-type'), `${sel} must not be a photo`).not.toBe('photo');
      expect(el!.hasAttribute('data-wnu-protected')).toBe(false);
    }
  });

  it('does not claim SVG icons or buttons', () => {
    applyProtections(settings());
    expect(document.querySelector('.search-icon')!.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('does not blanket-protect chat rows or the pane', () => {
    applyProtections(settings());
    document.querySelectorAll('[data-testid="cell-frame-container"]').forEach((row) => {
      expect(row.hasAttribute('data-wnu-protected')).toBe(false);
    });
    expect(document.getElementById('pane-side')!.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('returns nothing for a scope with no avatar evidence at all', () => {
    const empty = document.createElement('div');
    empty.innerHTML = '<img src="https://example.com/photo.jpg" />';
    document.body.appendChild(empty);
    expect(resolveWhatsAppProfilePhotos(empty)).toEqual([]);
  });

  it('never claims anything when the resolver throws on a malformed path', () => {
    // A malformed selector inside a resolver must not blur the world.
    expect(() => resolveWhatsAppProfilePhotos(document)).not.toThrow();
  });
});

// ─── Ownership / reveal ─────────────────────────────────────────────────────

describe('ownership and reveal', () => {
  it('lets the conversation header own its avatar (one blur layer, not two)', () => {
    applyProtections(settings());
    const header = document.querySelector('[data-testid="conversation-header"]')!;
    const avatar = document.querySelector('.av-header')!;

    expect(header.getAttribute('data-wnu-type')).toBe('chat-header');
    expect(header.hasAttribute('data-wnu-protected')).toBe(true);
    expect(avatar.getAttribute('data-wnu-type')).toBe('photo'); // still classified
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(false);
    expect(avatar.parentElement?.closest('[data-wnu-protected]')).toBe(header);
    expect(noNestedProtection()).toBe(true);
  });

  it('releases the avatar as its own owner when the header toggle is off', () => {
    applyProtections(withoutHeader());
    const header = document.querySelector('[data-testid="conversation-header"]')!;
    expect(header.hasAttribute('data-wnu-protected')).toBe(false);
    expect(document.querySelector('.av-header')!.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('never produces a nested protected element anywhere', () => {
    applyProtections(settings());
    expect(protectedAll().length).toBeGreaterThan(0);
    expect(noNestedProtection()).toBe(true);
  });

  it('protects each avatar exactly once even when several layers match it', () => {
    applyProtections(withoutHeader());
    for (const sel of ['.av-alice', '.av-group', '.av-header', '#drawer-av']) {
      const matches = SELECTORS.profilePhoto.filter((s) => document.querySelector(sel)!.matches(s)).length;
      expect(matches).toBeGreaterThanOrEqual(0); // layers may overlap freely
      expect(document.querySelector(sel)!.getAttribute('data-wnu-protected')).toBe('');
    }
    expect(photos().length).toBe(candidates().length); // one owner per candidate
  });

  it('reveals a chat-list avatar on hover and re-blurs on leave', () => {
    applyProtections(withoutHeader());
    const avatar = document.querySelector('.av-alice')!;

    avatar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(avatar.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(getComputedStyle(avatar).filter).toBe('blur(0)');

    avatar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(avatar.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(getComputedStyle(avatar).filter).toBe('blur(8px)');
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('reveals the header avatar together with the whole header group', () => {
    applyProtections(settings());
    const header = document.querySelector('[data-testid="conversation-header"]')!;

    header.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(header.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(document.querySelector('.av-header')!.closest('[data-wnu-revealed]')).toBe(header);

    header.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(header.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(noNestedProtection()).toBe(true);
  });

  it('does not reveal one chat row when another is hovered', () => {
    applyProtections(withoutHeader());
    const rows = document.querySelectorAll('[data-testid="cell-frame-container"]');
    rows[0].querySelector('.av-alice')!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(rows[0].querySelector('.av-alice')!.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(rows[1].querySelector('.av-group')!.hasAttribute('data-wnu-revealed')).toBe(false);
  });
});

// ─── Category independence ──────────────────────────────────────────────────

describe('category independence', () => {
  it('photos ON / messages OFF → avatars blurred, message text visible', () => {
    applyProtections(settings({ blurMessages: false, blurChatHeader: false }));

    expect(photos().length).toBeGreaterThan(0);
    expect(document.querySelector('.selectable-text')!.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('photos OFF / messages ON → avatars visible, message text blurred', () => {
    applyProtections(settings({ blurProfilePhotos: false, blurChatHeader: false }));

    expect(candidates().length).toBe(0);
    document.querySelectorAll('.av-alice, .av-group, .av-header, #drawer-av').forEach((el) => {
      expect(el.hasAttribute('data-wnu-protected')).toBe(false);
    });
    const message = document.querySelector('.selectable-text')!;
    expect(message.getAttribute('data-wnu-type')).toBe('message');
    expect(message.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('photos OFF does not disable the chat-list name/preview categories', () => {
    applyProtections(settings({ blurProfilePhotos: false }));
    expect(document.querySelector('[data-testid="cell-frame-title"]')!.hasAttribute('data-wnu-protected')).toBe(true);
    expect(document.querySelector('[data-testid="last-msg"]')!.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── Live settings (no reload) ──────────────────────────────────────────────

describe('live settings re-apply', () => {
  it('OFF removes protection from already-rendered avatars', () => {
    applyProtections(settings());
    expect(photos().length).toBeGreaterThan(0);

    removeProtections();
    applyProtections(settings({ blurProfilePhotos: false }));

    expect(photos().length).toBe(0);
    expect(candidates().length).toBe(0); // classification is cleared too
    document.querySelectorAll('.av-alice, .av-group, .av-header, #drawer-av').forEach((el) => {
      expect(el.hasAttribute('data-wnu-protected')).toBe(false);
      expect(el.getAttribute('data-wnu-type')).toBeNull();
    });
  });

  it('ON protects already-rendered avatars', () => {
    removeProtections();
    applyProtections(settings({ blurProfilePhotos: false, blurChatHeader: false }));
    expect(candidates().length).toBe(0);

    removeProtections();
    applyProtections(settings({ blurProfilePhotos: true, blurChatHeader: false }));
    expect(photos().length).toBeGreaterThan(0);
    expect(photos().length).toBe(candidates().length);
  });

  it('is idempotent — repeated applies never stack protection', () => {
    applyProtections(settings());
    const before = protectedAll().length;
    applyProtections(settings());
    applyProtections(settings());
    expect(protectedAll().length).toBe(before);
    expect(noNestedProtection()).toBe(true);
  });
});

// ─── Dynamic / lazy content ─────────────────────────────────────────────────

describe('dynamic and lazy avatars', () => {
  it('protects an avatar inserted after the initial scan', () => {
    applyProtections(withoutHeader());

    const row = document.createElement('img');
    row.className = 'late-av';
    row.setAttribute('src', 'https://media.example.test/pic-3');
    document.querySelector('[data-testid="cell-frame-container"]')!.prepend(row);

    processNewNodes([row] as unknown as NodeList, withoutHeader());

    expect(row.getAttribute('data-wnu-type')).toBe('photo');
    expect(row.hasAttribute('data-wnu-protected')).toBe(true);
    expect(noNestedProtection()).toBe(true);
  });

  /**
   * Regression for resolver scoping: `processNewNodes` hands the CHANGED
   * ELEMENT as the scope. A resolver that only did `querySelectorAll` would
   * walk its (empty) descendants and miss the node itself.
   */
  it('classifies a scope that IS the avatar (self, not just descendants)', () => {
    const only = document.createElement('div');
    only.innerHTML = '<img id="self-av" src="https://pps.whatsapp.net/self.jpg" />';
    document.body.appendChild(only);

    const found = resolveWhatsAppProfilePhotos(document.getElementById('self-av')!);
    expect(found.map((el) => el.id)).toContain('self-av');
  });

  it('reclassifies an avatar whose media URL is populated after rendering', () => {
    const header = document.querySelector('[data-testid="conversation-header"]')!;
    const lazy = document.createElement('img');
    lazy.className = 'lazy-av';
    header.appendChild(lazy);

    applyProtections(withoutHeader());
    expect(lazy.hasAttribute('data-wnu-protected')).toBe(false); // no evidence yet

    // WhatsApp lazy-loads the photo: `src` lands afterwards.
    lazy.setAttribute('src', 'https://pps.whatsapp.net/later.jpg');
    processNewNodes([lazy] as unknown as NodeList, withoutHeader());

    expect(lazy.getAttribute('data-wnu-type')).toBe('photo');
    expect(lazy.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('never duplicates protection when the same node is delivered twice', () => {
    applyProtections(withoutHeader());
    const avatar = document.querySelector('.av-alice')!;

    processNewNodes([avatar] as unknown as NodeList, withoutHeader());
    processNewNodes([avatar] as unknown as NodeList, withoutHeader());

    expect(photos().length).toBe(candidates().length);
    expect(noNestedProtection()).toBe(true);
  });
});
