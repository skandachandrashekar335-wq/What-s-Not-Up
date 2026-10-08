/**
 * Regression tests for live WhatsApp Web profile-photo protection.
 *
 * Observed bug: with Privacy Mode ON and the "Profile photos" toggle ON,
 * chat-list / contact / group avatars stayed completely visible while
 * message and chat-preview blurring worked — i.e. the extension was running
 * and settings were reaching it, but the avatars were never selected.
 *
 * Root cause proven from the implementation (`dom-processor.ts` →
 * `matchTarget`): the profile-photo target used `match: 'first'`, which
 * returns the results of the FIRST selector that matches anything and never
 * evaluates the rest of the list. SELECTORS.profilePhoto is an *additive*
 * set — chat-list avatars, group avatars, the conversation-header avatar and
 * CDN-backed photos are each reached by a different structural path — so one
 * early hit (e.g. a lone `[data-testid="avatar"]` node) suppressed every
 * later path and left the other avatars unblurred.
 *
 * Fixtures below are built from the selector paths that actually exist in
 * `SELECTORS.profilePhoto` (asserted in the "tied to the implementation"
 * test), not from invented markup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyProtections, removeProtections } from '../src/content/dom-processor';
import { clearAllTimers } from '../src/content/privacy-engine';
import { SELECTORS } from '../src/content/selectors';
import { whatsappAdapter } from '../src/content/sites/whatsapp';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

/**
 * WhatsApp-like DOM exercising every profile-photo selector path that
 * exists in SELECTORS.profilePhoto:
 *   [data-testid="avatar"]                      → detached avatar host
 *   img[src*="pps.whatsapp.net"]                → CDN-backed chat avatar
 *   [data-testid="chatlist-avatar"] img         → chat-list wrapper
 *   [data-testid="conversation-header-avatar"] img → header wrapper
 *
 * Plus unrelated WhatsApp UI that must NEVER be classified as a photo.
 */
function buildAvatarDOM(): void {
  document.body.innerHTML = `
    <div id="pane-side">
      <div data-testid="chat-list">
        <!-- Avatar host matching ONLY [data-testid="avatar"] -->
        <div data-testid="avatar" class="profile-photo-host"></div>

        <!-- Contact avatar: matches ONLY img[src*="pps.whatsapp.net"] -->
        <div class="chat-row">
          <img class="chat-avatar" src="https://pps.whatsapp.net/alice-photo.jpg" />
          <span title="Alice" dir="ltr">Alice</span>
          <span data-testid="last-msg">hey there</span>
        </div>

        <!-- Group avatar: same CDN path, no alt/testid on the img itself -->
        <div class="chat-row">
          <img class="chat-avatar" src="https://pps.whatsapp.net/family-group.jpg" />
          <span title="Family Group" dir="ltr">Family Group</span>
          <span data-testid="last-msg">ok</span>
        </div>

        <!-- Chat-list avatar reached ONLY through the wrapper testid -->
        <div class="chat-row">
          <span data-testid="chatlist-avatar">
            <img class="wrapped-chat-avatar" src="https://media.example.test/bob.jpg" />
          </span>
          <span title="Bob" dir="ltr">Bob</span>
          <span data-testid="last-msg">yo</span>
        </div>

        <!-- Unrelated WhatsApp UI: search + branding + buttons -->
        <div class="search-row">
          <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /></svg>
          <img class="brand-logo" src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" />
        </div>
        <button class="attach-btn" aria-label="Attach">
          <svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" /></svg>
        </button>
      </div>
    </div>

    <div id="main">
      <!-- Conversation-header avatar: matches ONLY the header wrapper testid -->
      <header data-testid="conversation-header">
        <span data-testid="conversation-header-avatar">
          <img class="header-avatar" src="https://media.example.test/header-alice.jpg" />
        </span>
        <span data-testid="conversation-info-header-chat-title" dir="ltr">Alice</span>
        <span data-testid="status">online</span>
      </header>

      <div data-testid="conversation-panel-wrapper">
        <div data-testid="msg-container">
          <span class="selectable-text">Hello 🙂 see this</span>
          <img class="emoji" src="data:image/png;base64,AAAA" />
        </div>
        <div data-testid="image-thumb">
          <img class="message-media" src="https://mmg.whatsapp.net/vacation.jpg" />
        </div>
      </div>
    </div>
  `;
}

const protectedEls = (): Element[] => Array.from(document.querySelectorAll('[data-wnu-protected]'));

/** Elements *classified* as a profile photo (a covered one may still be owned by an ancestor). */
const photoCandidates = (): Element[] =>
  Array.from(document.querySelectorAll('[data-wnu-type="photo"]'));

/** Elements actually carrying the photo blur. */
const protectedPhotos = (): Element[] =>
  Array.from(document.querySelectorAll('[data-wnu-protected][data-wnu-type="photo"]'));

function noNestedProtection(): boolean {
  return protectedEls().every((el) => el.parentElement?.closest('[data-wnu-protected]') === null);
}

beforeEach(() => {
  buildAvatarDOM();
});

// ─── Tied to the implementation ──────────────────────────────────────────────

describe('fixture is tied to the real selector list', () => {
  it('every avatar path exercised by these tests exists in SELECTORS.profilePhoto', () => {
    const selectors = SELECTORS.profilePhoto as readonly string[];
    expect(selectors).toContain('[data-testid="avatar"]');
    expect(selectors).toContain('img[src*="pps.whatsapp.net"]');
    expect(selectors).toContain('[data-testid="chatlist-avatar"] img');
    expect(selectors).toContain('[data-testid="conversation-header-avatar"] img');
  });

  it('the profile-photo target uses union matching (regression for match:"first")', () => {
    const photoTarget = whatsappAdapter.targets.find((t) => t.type === 'photo');
    expect(photoTarget).toBeDefined();
    expect(photoTarget!.setting).toBe('blurProfilePhotos');
    expect(photoTarget!.match).toBe('union');
  });
});

// ─── Detection ───────────────────────────────────────────────────────────────

describe('profile photo detection', () => {
  it('detects chat-list contact avatars', () => {
    applyProtections(settings(), whatsappAdapter);
    const alice = document.querySelector('img[src*="alice-photo.jpg"]')!;
    expect(alice.getAttribute('data-wnu-type')).toBe('photo');
    expect(alice.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects chat-list group avatars', () => {
    applyProtections(settings(), whatsappAdapter);
    const group = document.querySelector('img[src*="family-group.jpg"]')!;
    expect(group.getAttribute('data-wnu-type')).toBe('photo');
    expect(group.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects the conversation-header avatar when the header itself is not a target', () => {
    applyProtections(settings({ blurChatHeader: false }), whatsappAdapter);
    const headerAvatar = document.querySelector('.header-avatar')!;
    expect(headerAvatar.getAttribute('data-wnu-type')).toBe('photo');
    expect(headerAvatar.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('still blurs the header avatar when the header owns the blur (covered, not double-blurred)', () => {
    applyProtections(settings(), whatsappAdapter);
    const header = document.querySelector('[data-testid="conversation-header"]')!;
    const headerAvatar = document.querySelector('.header-avatar')!;
    expect(header.getAttribute('data-wnu-type')).toBe('chat-header');
    expect(header.hasAttribute('data-wnu-protected')).toBe(true);
    expect(headerAvatar.hasAttribute('data-wnu-protected')).toBe(false);
    expect(headerAvatar.parentElement?.closest('[data-wnu-protected]')).toBe(header);
  });

  /**
   * THE regression: with `match: "first"`, the lone `[data-testid="avatar"]`
   * node satisfied the list first and every remaining path was skipped, so
   * all other avatars stayed visible. Union must evaluate every path.
   */
  it('evaluates EVERY avatar selector path, not just the first one that matches', () => {
    applyProtections(settings({ blurChatHeader: false }), whatsappAdapter);

    const expected = [
      '[data-testid="avatar"]',
      'img[src*="alice-photo.jpg"]',
      'img[src*="family-group.jpg"]',
      '[data-testid="chatlist-avatar"] img',
      '.header-avatar',
    ];

    for (const sel of expected) {
      const el = document.querySelector(sel);
      expect(el, `expected fixture element for ${sel}`).not.toBeNull();
      expect(el!.getAttribute('data-wnu-type'), `${sel} must be a photo`).toBe('photo');
      expect(el!.hasAttribute('data-wnu-protected'), `${sel} must be protected`).toBe(true);
    }

    expect(protectedPhotos().length).toBe(expected.length);
  });

  it('supports multiple avatar selector paths simultaneously', () => {
    applyProtections(settings({ blurChatHeader: false }), whatsappAdapter);
    const types = protectedPhotos().map((el) => el.className);
    expect(types).toContain('chat-avatar');       // pps CDN path
    expect(types).toContain('wrapped-chat-avatar'); // chatlist-avatar path
    expect(types).toContain('header-avatar');     // conversation-header path
  });
});

// ─── De-duplication / nesting ────────────────────────────────────────────────

describe('de-duplication and nesting', () => {
  it('protects each avatar exactly once even when it matches several selectors', () => {
    // The avatar satisfies several profile-photo paths at once (CDN src + alt
    // text), and it sits inside an element that is itself a photo candidate
    // (`[data-testid="avatar"]`) — the classic nesting case where a naive
    // implementation would stack two blur layers on the same pixels.
    const dup = document.querySelector('img[src*="alice-photo.jpg"]')!;
    dup.setAttribute('alt', 'Profile photo');

    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-testid', 'avatar');
    dup.replaceWith(wrapper);
    wrapper.appendChild(dup);

    applyProtections(settings({ blurChatHeader: false }), whatsappAdapter);

    // Outermost candidate owns the blur; the inner match is covered, not stacked.
    expect(wrapper.getAttribute('data-wnu-type')).toBe('photo');
    expect(wrapper.hasAttribute('data-wnu-protected')).toBe(true);
    expect(dup.getAttribute('data-wnu-type')).toBe('photo');
    expect(dup.hasAttribute('data-wnu-protected')).toBe(false);
    expect(dup.parentElement?.closest('[data-wnu-protected]')).toBe(wrapper);

    // Exactly one blur owner for this region, and none stacked above it.
    expect(protectedPhotos().length).toBe(photoCandidates().length - 1);
    expect(wrapper.parentElement?.closest('[data-wnu-protected]')).toBeNull();
    expect(noNestedProtection()).toBe(true);
  });

  it('never creates nested protected profile-photo elements', () => {
    applyProtections(settings({ blurChatHeader: false }), whatsappAdapter);
    expect(protectedPhotos().length).toBeGreaterThan(0);
    expect(noNestedProtection()).toBe(true);
  });

  it('never creates nested protected elements anywhere in the document', () => {
    applyProtections(settings(), whatsappAdapter);
    expect(protectedEls().length).toBeGreaterThan(0);
    expect(noNestedProtection()).toBe(true);
  });
});

// ─── Scope: unrelated images must never match ────────────────────────────────

describe('protection scope', () => {
  it('does not classify WhatsApp logo, icons, buttons, emoji or message media as profile photos', () => {
    applyProtections(settings(), whatsappAdapter);

    const unrelated = [
      '.search-icon',
      '.brand-logo',
      '.attach-btn',
      '.attach-btn svg',
      '.emoji',
      '.message-media',
    ];
    for (const sel of unrelated) {
      const el = document.querySelector(sel);
      expect(el, `fixture element for ${sel} must exist`).not.toBeNull();
      expect(el!.getAttribute('data-wnu-type'), `${sel} must not be a photo`).not.toBe('photo');
    }
  });

  it('does not protect the search/branding/buttons subtree at all', () => {
    applyProtections(settings(), whatsappAdapter);
    expect(document.querySelector('.search-row')!.hasAttribute('data-wnu-protected')).toBe(false);
    expect(document.querySelector('.attach-btn')!.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('does not blanket-protect the chat rows that contain avatars', () => {
    applyProtections(settings(), whatsappAdapter);
    document.querySelectorAll('.chat-row').forEach((row) => {
      expect(row.hasAttribute('data-wnu-protected')).toBe(false);
    });
  });
});

// ─── Category independence ───────────────────────────────────────────────────

describe('category independence', () => {
  it('profile photos ON + messages OFF → photos blurred, messages visible', () => {
    applyProtections(settings({ blurMessages: false, blurChatHeader: false }), whatsappAdapter);

    expect(protectedPhotos().length).toBeGreaterThan(0);
    protectedPhotos().forEach((el) => expect(el.hasAttribute('data-wnu-protected')).toBe(true));

    const messageText = document.querySelector('.selectable-text')!;
    expect(messageText.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('profile photos OFF + messages ON → photos visible, messages blurred', () => {
    applyProtections(settings({ blurProfilePhotos: false }), whatsappAdapter);

    expect(photoCandidates().length).toBe(0);
    expect(document.querySelector('.header-avatar')!.hasAttribute('data-wnu-protected')).toBe(false);
    expect(document.querySelector('img[src*="alice-photo.jpg"]')!.hasAttribute('data-wnu-protected')).toBe(false);

    const messageText = document.querySelector('.selectable-text')!;
    expect(messageText.getAttribute('data-wnu-type')).toBe('message');
    expect(messageText.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── Live settings (no reload) ───────────────────────────────────────────────

describe('live settings re-apply', () => {
  it('turning profile photos OFF removes protection from already-rendered avatars', () => {
    applyProtections(settings(), whatsappAdapter);
    expect(protectedPhotos().length).toBeGreaterThan(0);

    // Exactly the flow chrome.storage.onChanged → applySettingsToDOM runs.
    removeProtections();
    applyProtections(settings({ blurProfilePhotos: false }), whatsappAdapter);

    expect(protectedPhotos().length).toBe(0);
    expect(protectedEls().filter((el) => el.getAttribute('data-wnu-type') === 'photo')).toEqual([]);
    document.querySelectorAll('img.chat-avatar, img.header-avatar, .wrapped-chat-avatar')
      .forEach((el) => expect(el.hasAttribute('data-wnu-protected')).toBe(false));
  });

  it('turning profile photos ON protects already-rendered avatars', () => {
    removeProtections();
    applyProtections(settings({ blurProfilePhotos: false, blurChatHeader: false }), whatsappAdapter);
    expect(photoCandidates().length).toBe(0);

    removeProtections();
    applyProtections(settings({ blurProfilePhotos: true, blurChatHeader: false }), whatsappAdapter);

    expect(protectedPhotos().length).toBe(photoCandidates().length);
    expect(protectedPhotos().length).toBeGreaterThan(0);
    protectedPhotos().forEach((el) => expect(el.hasAttribute('data-wnu-protected')).toBe(true));
  });

  it('stays idempotent across repeated applies', () => {
    applyProtections(settings(), whatsappAdapter);
    const first = photoCandidates().length;
    applyProtections(settings(), whatsappAdapter);
    expect(photoCandidates().length).toBe(first);
    expect(noNestedProtection()).toBe(true);
  });
});

// ─── Reveal behaviour ────────────────────────────────────────────────────────

describe('logical reveal', () => {
  it('reveals a chat-list avatar on hover and re-blurs on leave', () => {
    applyProtections(settings({ blurMessages: false }), whatsappAdapter);
    const avatar = document.querySelector('img[src*="alice-photo.jpg"]')!;
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(true);

    avatar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(avatar.hasAttribute('data-wnu-revealed')).toBe(true);

    avatar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(avatar.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('reveals the header avatar together with its conversation-header group root', () => {
    applyProtections(settings(), whatsappAdapter);
    const header = document.querySelector('[data-testid="conversation-header"]')!;
    const headerAvatar = document.querySelector('.header-avatar')!;

    header.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(header.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(headerAvatar.parentElement?.closest('[data-wnu-revealed]')).toBe(header);

    header.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(header.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(header.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('clears timers cleanly', () => {
    applyProtections(settings(), whatsappAdapter);
    expect(() => clearAllTimers()).not.toThrow();
  });
});
