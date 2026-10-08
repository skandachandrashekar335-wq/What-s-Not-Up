/**
 * WhatsApp GIF & sticker detection — layered (selector + structural) tests.
 *
 * GIFs and stickers were reported as never blurring in a real session while
 * messages did. The three stable testids alone cannot be the whole answer:
 * WhatsApp renames testids, moves labels onto wrappers, renders animated
 * stickers on a <canvas> and embeds animated GIFs as looping videos.
 *
 * Detection therefore classifies media rather than matching one attribute:
 *
 *     WhatsApp media candidate → classifyWhatsAppMedia() → IMAGE|VIDEO|GIF|STICKER|null
 *
 * Classification is a pure function of the element, so categories can never
 * overlap (a GIF cannot be claimed by the image target just because that
 * target is evaluated first) — which is what keeps the toggles independent.
 *
 * The fixtures below follow the modern WhatsApp conversation structure
 * (msg-container bubbles inside the panel wrapper) plus the picker surfaces
 * that must stay visible.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyProtections, removeProtections, processNewNodes } from '../src/content/dom-processor';
import { injectStyles, removeStyles, clearAllTimers } from '../src/content/privacy-engine';
import { SELECTORS } from '../src/content/selectors';
import { whatsappAdapter } from '../src/content/sites/whatsapp';
import {
  classifyWhatsAppMedia,
  resolveWhatsAppGifsAndStickers,
} from '../src/content/sites/whatsapp/media-classifier';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

function buildConversationDOM(): void {
  document.body.innerHTML = `
    <div id="app" class="two">
      <!-- ── Left pane ─────────────────────────────────────────────────── -->
      <div id="pane-side">
        <div data-testid="chat-list">
          <div role="listitem" data-testid="cell-frame-container">
            <span data-testid="chatlist-avatar"><img class="av-alice" src="https://pps.whatsapp.net/alice.jpg" /></span>
            <div data-testid="cell-frame-title"><span title="Alice" dir="auto">Alice</span></div>
            <div data-testid="cell-frame-secondary"><span data-testid="last-msg">hey</span></div>
          </div>
          <!-- a GIF-shaped testid in the CHAT LIST: never message media -->
          <div class="pane-art"><div data-testid="gif" class="pane-gif"></div></div>
        </div>
      </div>

      <!-- ── Right pane ────────────────────────────────────────────────── -->
      <div id="main">
        <header data-testid="conversation-header">
          <span class="_ak9q"><img class="av-header" style="border-radius:50%" src="https://media.example.test/pic-2" /></span>
          <span data-testid="conversation-info-header-chat-title" dir="auto">Alice</span>
          <span data-testid="status">online</span>
        </header>

        <div data-testid="conversation-panel-wrapper">
          <!-- text message -->
          <div data-testid="msg-container">
            <div class="copyable-text"><span class="selectable-text">Hello there</span></div>
          </div>

          <!-- A. stable GIF testid, in a bubble that ALSO carries text -->
          <div data-testid="msg-container">
            <span class="selectable-text">Look at this</span>
            <div data-testid="gif"><img class="gif-a" src="https://media.example.test/a.gif" /></div>
          </div>

          <!-- B. renamed testid only — no exact selector path reaches this -->
          <div data-testid="msg-container">
            <div data-testid="gif-thumbnail" class="_ak9r"><img class="gif-b" src="https://media.example.test/blob-1" /></div>
          </div>

          <!-- C. stable sticker testid wrapping the image -->
          <div data-testid="msg-container">
            <div data-testid="sticker"><img class="sticker-a" src="https://media.example.test/s1.webp" /></div>
          </div>

          <!-- D. animated sticker painted on a canvas (no testid at all) -->
          <div data-testid="msg-container"><canvas class="sticker-canvas" width="96" height="96"></canvas></div>

          <!-- E. animated GIF embedded as a looping, control-less video -->
          <div data-testid="msg-container">
            <video class="loop-player" loop muted autoplay playsinline></video>
          </div>

          <!-- F. a real video: must classify as VIDEO, never as a GIF -->
          <div data-testid="msg-container">
            <div data-testid="video-thumb"><video class="real-video" controls poster="x.jpg"></video></div>
          </div>

          <!-- G. a photo message: must classify as IMAGE, never as a sticker -->
          <div data-testid="msg-container">
            <div data-testid="image-thumb"><img class="photo-msg" src="https://mmg.whatsapp.net/p.jpg" /></div>
          </div>

          <!-- H. inline emoji: must never be claimed by any media category -->
          <div data-testid="msg-container">
            <span class="selectable-text">hi 🙂</span>
            <img class="emoji" width="64" height="64" src="data:image/png;base64,AAAA" />
          </div>

          <!-- I. marker attribute presence (not only the literal "true") -->
          <div data-testid="msg-container">
            <div data-animated="1" class="anim-marker"></div>
          </div>
        </div>

        <!-- ── Pickers: identical testids, must stay visible ─────────────── -->
        <div data-testid="gif-picker">
          <div data-testid="gif" class="picker-tile"><img class="picker-gif" src="https://media.example.test/pg.gif" /></div>
        </div>
        <div data-testid="sticker-picker">
          <div data-testid="sticker" class="picker-tile"><img class="picker-sticker" src="https://media.example.test/ps.webp" /></div>
        </div>
      </div>
    </div>
  `;
}

const gifStickers = (): Element[] =>
  Array.from(document.querySelectorAll('[data-wnu-protected][data-wnu-type="gif-sticker"]'));
const gifCandidates = (): Element[] =>
  Array.from(document.querySelectorAll('[data-wnu-type="gif-sticker"]'));
const protectedAll = (): Element[] => Array.from(document.querySelectorAll('[data-wnu-protected]'));

function noNestedProtection(): boolean {
  return protectedAll().every((el) => el.parentElement?.closest('[data-wnu-protected]') === null);
}

const $ = (sel: string) => document.querySelector(sel);
/** Scoped to the conversation so chat-list/picker look-alikes never match. */
const inPanel = (sel: string) => $(`[data-testid="conversation-panel-wrapper"] ${sel}`);

beforeEach(() => {
  removeProtections();
  clearAllTimers();
  buildConversationDOM();
  injectStyles(8);
});

afterEach(() => {
  removeProtections();
  removeStyles();
  clearAllTimers();
});

// ─── Tied to the implementation ──────────────────────────────────────────────

describe('implementation contract', () => {
  it('the gif-sticker target is union-matched, resolved and picker-excluded', () => {
    const target = whatsappAdapter.targets.find((t) => t.type === 'gif-sticker');
    expect(target).toBeDefined();
    expect(target!.setting).toBe('blurGifsStickers');
    expect(target!.match).toBe('union');
    expect(target!.resolve).toBe(resolveWhatsAppGifsAndStickers);
    expect(target!.exclude).toBeDefined();
    expect(target!.exclude!.some((s) => s.includes('picker'))).toBe(true);
  });

  it('media classification is a pure function of the element', () => {
    const el = inPanel('[data-testid="gif-thumbnail"]')!;
    expect(classifyWhatsAppMedia(el)).toBe(classifyWhatsAppMedia(el));
    expect(classifyWhatsAppMedia(el)).toBe('gif');
  });

  it('each category claims only elements of its own kind', () => {
    expect(classifyWhatsAppMedia($('.photo-msg')!)).toBe('image');
    expect(classifyWhatsAppMedia($('.real-video')!)).toBe('video');
    expect(classifyWhatsAppMedia(inPanel('[data-testid="gif"]')!)).toBe('gif');
    expect(classifyWhatsAppMedia(inPanel('[data-testid="sticker"]')!)).toBe('sticker');
    expect(classifyWhatsAppMedia($('.emoji')!)).toBeNull(); // no category owns it
  });
});

// ─── GIF detection across real representations ──────────────────────────────

describe('GIF detection', () => {
  it('detects a message GIF with its stable testid', () => {
    applyProtections(settings());
    const gif = $('[data-testid="msg-container"] [data-testid="gif"]')!;
    expect(gif.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(gif.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getComputedStyle(gif).filter).toBe('blur(8px)');
  });

  /**
   * The release-blocking case: WhatsApp renamed the testid. No exact
   * selector path in SELECTORS.mediaGifSticker reaches it.
   */
  it('detects a GIF whose testid was renamed (no exact selector matches)', () => {
    const renamed = $('[data-testid="gif-thumbnail"]')!;
    for (const selector of SELECTORS.mediaGifSticker) {
      expect(renamed.matches(selector), `selector "${selector}" must not match`).toBe(false);
    }
    expect(resolveWhatsAppGifsAndStickers(document)).toContain(renamed);

    applyProtections(settings());
    expect(renamed.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(renamed.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects a GIF from its media URL when no testid says so', () => {
    applyProtections(settings());
    const img = $('.gif-a')!;
    expect(img.getAttribute('data-wnu-type')).toBe('gif-sticker');
    // covered by its wrapper — one blur layer for the region
    expect(img.hasAttribute('data-wnu-protected')).toBe(false);
    expect(img.parentElement?.closest('[data-wnu-protected]')).not.toBeNull();
  });

  it('detects a GIF embedded as a looping, control-less video', () => {
    const player = $('.loop-player')!;
    expect(classifyWhatsAppMedia(player)).toBe('gif');
    applyProtections(settings());
    expect(player.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(player.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects a marker attribute other than the literal value "true"', () => {
    const marker = $('.anim-marker')!;
    expect(classifyWhatsAppMedia(marker)).toBe('gif');
    applyProtections(settings());
    expect(marker.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('detects an aria-labelled GIF', () => {
    const labelled = document.createElement('div');
    labelled.setAttribute('aria-label', 'Animated GIF');
    labelled.className = 'labelled';
    $('[data-testid="conversation-panel-wrapper"]')!.appendChild(labelled);

    expect(classifyWhatsAppMedia(labelled)).toBe('gif');
    applyProtections(settings());
    expect(labelled.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── Sticker detection across real representations ──────────────────────────

describe('sticker detection', () => {
  it('detects a message sticker with its stable testid', () => {
    applyProtections(settings());
    const sticker = $('[data-testid="msg-container"] [data-testid="sticker"]')!;
    expect(sticker.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(sticker.hasAttribute('data-wnu-protected')).toBe(true);
  });

  /**
   * The wrapper carries the testid, the image carries the pixels. Both end up
   * as candidates; ownership must collapse them into ONE blur layer.
   */
  it('collapses a labelled wrapper and its image into a single owner', () => {
    applyProtections(settings());
    const wrapper = $('[data-testid="msg-container"] [data-testid="sticker"]')!;
    const img = $('.sticker-a')!;

    expect(wrapper.hasAttribute('data-wnu-protected')).toBe(true);
    expect(img.getAttribute('data-wnu-type')).toBe('gif-sticker'); // still classified
    expect(img.hasAttribute('data-wnu-protected')).toBe(false);
    expect(img.parentElement?.closest('[data-wnu-protected]')).toBe(wrapper);
    expect(noNestedProtection()).toBe(true);
  });

  it('detects an animated sticker rendered on a canvas (no testid at all)', () => {
    const canvas = $('.sticker-canvas')!;
    expect(classifyWhatsAppMedia(canvas)).toBe('sticker');

    applyProtections(settings());
    expect(canvas.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(canvas.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getComputedStyle(canvas).filter).toBe('blur(8px)');
  });

  it('detects a sticker identified only by an ancestor label', () => {
    const wrapped = document.createElement('div');
    wrapped.setAttribute('data-testid', 'sticker-rail');
    wrapped.innerHTML = '<img id="bare-sticker" src="https://media.example.test/zz.png" />';
    $('[data-testid="conversation-panel-wrapper"]')!.appendChild(wrapped);

    expect(classifyWhatsAppMedia($('#bare-sticker')!)).toBe('sticker');
    applyProtections(settings());
    expect($('#bare-sticker')!.getAttribute('data-wnu-type')).toBe('gif-sticker');
  });
});

// ─── Fail-safe: other categories must be untouched ──────────────────────────

describe('false-positive protection (fail-safe)', () => {
  it('never classifies a real video as a GIF', () => {
    expect(classifyWhatsAppMedia($('.real-video')!)).toBe('video');
    applyProtections(settings());
    expect($('.real-video')!.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    expect($('[data-testid="video-thumb"]')!.getAttribute('data-wnu-type')).toBe('video');
    expect($('[data-testid="video-thumb"]')!.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('never classifies a photo message as a sticker', () => {
    expect(classifyWhatsAppMedia($('.photo-msg')!)).toBe('image');
    applyProtections(settings());
    expect($('.photo-msg')!.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    expect($('[data-testid="image-thumb"]')!.getAttribute('data-wnu-type')).toBe('image');
  });

  it('never classifies inline emoji as media, even when it is square', () => {
    const emoji = $('.emoji')!;
    expect(emoji.getAttribute('width')).toBe('64'); // square by attribute
    expect(classifyWhatsAppMedia(emoji)).toBeNull();

    applyProtections(settings());
    expect(emoji.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    expect(emoji.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('never blurs the GIF picker or sticker picker', () => {
    applyProtections(settings());
    for (const sel of [
      '[data-testid="gif-picker"]',
      '[data-testid="gif-picker"] [data-testid="gif"]',
      '.picker-gif',
      '[data-testid="sticker-picker"]',
      '[data-testid="sticker-picker"] [data-testid="sticker"]',
      '.picker-sticker',
    ]) {
      const el = $(sel);
      expect(el, `fixture element ${sel} must exist`).not.toBeNull();
      expect(el!.hasAttribute('data-wnu-protected'), `${sel} must stay visible`).toBe(false);
      expect(el!.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    }
  });

  it('never treats chat-list art as message media', () => {
    applyProtections(settings());
    const paneGif = $('.pane-gif')!;
    expect(paneGif.hasAttribute('data-wnu-protected')).toBe(false);
    expect(paneGif.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
  });

  it('never touches profile photos, names or message text', () => {
    applyProtections(settings());
    expect($('.av-alice')!.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    expect($('.av-header')!.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    expect($('[data-testid="cell-frame-title"]')!.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    expect($('.selectable-text')!.getAttribute('data-wnu-type')).toBe('message');
  });

  it('returns nothing for a scope with no media evidence', () => {
    const empty = document.createElement('div');
    empty.innerHTML = '<span class="selectable-text">plain text</span>';
    document.body.appendChild(empty);
    expect(resolveWhatsAppGifsAndStickers(empty)).toEqual([]);
  });
});

// ─── Category independence ──────────────────────────────────────────────────

describe('category independence', () => {
  it('GIFs OFF + messages ON → GIF/stickers visible, text blurred', () => {
    applyProtections(settings({ blurGifsStickers: false }));

    expect(gifCandidates().length).toBe(0);
    for (const sel of [
      '[data-testid="conversation-panel-wrapper"] [data-testid="gif"]',
      '[data-testid="conversation-panel-wrapper"] [data-testid="sticker"]',
      '.sticker-canvas',
      '.loop-player',
    ]) {
      expect($(sel)!.hasAttribute('data-wnu-protected'), `${sel} must be visible`).toBe(false);
    }
    expect($('.selectable-text')!.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('GIFs ON + messages OFF → GIF/stickers blurred, text visible', () => {
    applyProtections(settings({ blurMessages: false }));

    expect(gifStickers().length).toBeGreaterThan(0);
    expect($('.selectable-text')!.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('GIFs OFF does not disable image or video protection', () => {
    applyProtections(settings({ blurGifsStickers: false }));
    expect($('[data-testid="image-thumb"]')!.hasAttribute('data-wnu-protected')).toBe(true);
    expect($('[data-testid="video-thumb"]')!.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('images OFF does not disable GIF/sticker protection', () => {
    applyProtections(settings({ blurImages: false }));
    expect($('[data-testid="image-thumb"]')!.hasAttribute('data-wnu-protected')).toBe(false);
    expect($('[data-testid="sticker"]')!.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('photos OFF does not disable GIF/sticker protection', () => {
    applyProtections(settings({ blurProfilePhotos: false, blurChatHeader: false }));
    expect($('.av-header')!.hasAttribute('data-wnu-protected')).toBe(false);
    expect($('[data-testid="sticker"]')!.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── Ownership / reveal ─────────────────────────────────────────────────────

describe('ownership and reveal', () => {
  it('one message region has exactly one blur owner, never a parent and child', () => {
    applyProtections(settings({ blurMessages: false }));
    expect(gifStickers().length).toBeGreaterThan(0);
    expect(noNestedProtection()).toBe(true);
  });

  it('reveals the GIF and the message text together when the bubble is hovered', () => {
    applyProtections(settings());
    const bubbles = document.querySelectorAll('[data-testid="msg-container"]');
    const gifBubble = bubbles[1]; // the A. stable GIF bubble — carries text AND a GIF
    const gif = gifBubble.querySelector('[data-testid="gif"]')!;
    const text = gifBubble.querySelector('.selectable-text')!;

    // two independent owners, one logical group, never nested
    expect(gif.hasAttribute('data-wnu-protected')).toBe(true);
    expect(text.hasAttribute('data-wnu-protected')).toBe(true);
    expect(gif.parentElement?.closest('[data-wnu-protected]')).toBeNull();

    gifBubble.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(gifBubble.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(gif.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(text.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(getComputedStyle(gif).filter).toBe('blur(0)');
    expect(getComputedStyle(text).filter).toBe('blur(0)');

    gifBubble.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(gif.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(text.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(getComputedStyle(gif).filter).toBe('blur(8px)');
    expect(gif.hasAttribute('data-wnu-protected')).toBe(true);
    expect(text.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('does not reveal a neighbouring message when one is hovered', () => {
    applyProtections(settings());
    const bubbles = document.querySelectorAll('[data-testid="msg-container"]');
    bubbles[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(bubbles[2].querySelector('[data-testid="gif-thumbnail"]')!.hasAttribute('data-wnu-revealed')).toBe(false);
  });

  it('the reveal group is the message bubble, not the media element', () => {
    applyProtections(settings());
    const bubble = $('[data-testid="msg-container"] [data-testid="gif"]')!.closest('[data-testid="msg-container"]')!;
    expect(bubble.getAttribute('data-wnu-mode')).toBe('hover');
    expect(bubble.getAttribute('data-wnu-dur')).toBe('3000');
  });

  it('never produces a nested protected element anywhere', () => {
    applyProtections(settings());
    expect(protectedAll().length).toBeGreaterThan(0);
    expect(noNestedProtection()).toBe(true);
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

// ─── Live settings (no reload) ──────────────────────────────────────────────

describe('live settings re-apply', () => {
  it('OFF removes protection from already-rendered GIFs and stickers', () => {
    applyProtections(settings());
    expect(gifStickers().length).toBeGreaterThan(0);

    removeProtections();
    applyProtections(settings({ blurGifsStickers: false }));

    expect(gifStickers().length).toBe(0);
    expect(gifCandidates().length).toBe(0); // classification cleared too
    for (const sel of [
      '[data-testid="conversation-panel-wrapper"] [data-testid="gif"]',
      '[data-testid="conversation-panel-wrapper"] [data-testid="sticker"]',
      '.sticker-canvas',
    ]) {
      expect($(sel)!.hasAttribute('data-wnu-protected')).toBe(false);
      expect($(sel)!.getAttribute('data-wnu-type')).toBeNull();
    }
    // other categories survive the toggle
    expect($('.selectable-text')!.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('ON protects already-rendered GIFs and stickers', () => {
    removeProtections();
    applyProtections(settings({ blurGifsStickers: false }));
    expect(gifCandidates().length).toBe(0);

    removeProtections();
    applyProtections(settings({ blurGifsStickers: true }));
    expect(gifStickers().length).toBeGreaterThan(0);

    // Every classified element is either a blur owner or sits inside one —
    // a wrapper + image pair must never leave the inner element exposed.
    for (const el of gifCandidates()) {
      const owner =
        el.hasAttribute('data-wnu-protected') ||
        el.parentElement?.closest('[data-wnu-protected]') != null;
      expect(owner, 'classified media must be covered by a blur owner').toBe(true);
    }
    expect(noNestedProtection()).toBe(true);
  });
});

// ─── Dynamic content ────────────────────────────────────────────────────────

describe('dynamically inserted media', () => {
  const insert = (html: string): Element => {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const node = holder.firstElementChild!;
    $('[data-testid="conversation-panel-wrapper"]')!.appendChild(node);
    processNewNodes([node] as unknown as NodeList, settings());
    return node;
  };

  it('protects a GIF inserted after the initial scan', () => {
    applyProtections(settings());
    const bubble = insert('<div data-testid="msg-container"><div data-testid="gif-thumbnail"><img src="https://media.example.test/z.gif" /></div></div>');
    const gif = bubble.querySelector('[data-testid="gif-thumbnail"]')!;

    expect(gif.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(gif.hasAttribute('data-wnu-protected')).toBe(true);
    expect(getComputedStyle(gif).filter).toBe('blur(8px)');
    expect(noNestedProtection()).toBe(true);
  });

  it('protects a sticker inserted after the initial scan', () => {
    applyProtections(settings());
    const bubble = insert('<div data-testid="msg-container"><div data-testid="sticker"><img src="https://media.example.test/s2.webp" /></div></div>');

    expect(bubble.querySelector('[data-testid="sticker"]')!.hasAttribute('data-wnu-protected')).toBe(true);
    expect(noNestedProtection()).toBe(true);
  });

  it('protects an animated canvas sticker inserted after the initial scan', () => {
    applyProtections(settings());
    const bubble = insert('<div data-testid="msg-container"><canvas class="late-canvas" width="96" height="96"></canvas></div>');

    expect(bubble.querySelector('canvas')!.getAttribute('data-wnu-type')).toBe('gif-sticker');
    expect(bubble.querySelector('canvas')!.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('protects an avatar inserted after the initial scan', () => {
    applyProtections(settings({ blurChatHeader: false }));
    const row = $('[data-testid="cell-frame-container"]')!;
    const av = document.createElement('img');
    av.className = 'late-av';
    av.setAttribute('src', 'https://media.example.test/pic-7');
    row.prepend(av);
    processNewNodes([av] as unknown as NodeList, settings({ blurChatHeader: false }));

    expect(av.getAttribute('data-wnu-type')).toBe('photo');
    expect(av.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('does NOT insert a GIF for a disabled category', () => {
    applyProtections(settings({ blurGifsStickers: false }));
    const gif = insert('<div data-testid="msg-container"><div data-testid="gif"><img src="https://media.example.test/q.gif" /></div></div>');

    expect(gif.getAttribute('data-wnu-type')).not.toBe('gif-sticker');
    expect(gif.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('never duplicates protection when the same node arrives twice', () => {
    applyProtections(settings());
    const gif = $('[data-testid="msg-container"] [data-testid="gif"]')!;
    const before = gifStickers().length;

    processNewNodes([gif] as unknown as NodeList, settings());
    processNewNodes([gif] as unknown as NodeList, settings());

    expect(gifStickers().length).toBe(before);
    expect(noNestedProtection()).toBe(true);
  });

  it('does nothing for new nodes while privacy mode is off', () => {
    const bubble = document.createElement('div');
    bubble.setAttribute('data-testid', 'msg-container');
    bubble.innerHTML = '<div data-testid="gif"></div>';
    $('[data-testid="conversation-panel-wrapper"]')!.appendChild(bubble);

    processNewNodes([bubble] as unknown as NodeList, { ...DEFAULT_SETTINGS, privacyEnabled: false });
    expect(bubble.querySelector('[data-testid="gif"]')!.hasAttribute('data-wnu-protected')).toBe(false);
  });
});

// ─── Regression: categories that already worked ─────────────────────────────

describe('regression: existing categories still work', () => {
  it('still blurs message text, contact names and chat-list previews', () => {
    applyProtections(settings());
    expect($('.selectable-text')!.getAttribute('data-wnu-type')).toBe('message');
    expect($('.selectable-text')!.hasAttribute('data-wnu-protected')).toBe(true);
    expect($('[data-testid="cell-frame-title"]')!.getAttribute('data-wnu-type')).toBe('name');
    expect($('[data-testid="last-msg"]')!.getAttribute('data-wnu-type')).toBe('chat-preview');
  });

  it('still blurs images, videos and profile photos', () => {
    applyProtections(settings());
    expect($('[data-testid="image-thumb"]')!.getAttribute('data-wnu-type')).toBe('image');
    expect($('[data-testid="video-thumb"]')!.getAttribute('data-wnu-type')).toBe('video');
    expect($('[data-testid="chatlist-avatar"] img')!.getAttribute('data-wnu-type')).toBe('photo');
    expect($('.av-header')!.getAttribute('data-wnu-type')).toBe('photo');
  });

  it('still hides the status indicator', () => {
    applyProtections(settings({ hideOnlineStatus: true }));
    expect($('[data-testid="status"]')!.hasAttribute('data-wnu-hidden')).toBe(true);
  });
});
