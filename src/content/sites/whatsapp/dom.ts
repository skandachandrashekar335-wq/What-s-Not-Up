/**
 * WhatsApp Web detection helpers — READ-ONLY.
 *
 * Every function here only *reads* the DOM. Nothing is written, moved or
 * styled; the adapter's targets feed these helpers' results into the generic
 * DOM processor, which is what writes `data-wnu-*` attributes.
 *
 * ─── Why helpers instead of only selectors ──────────────────────────────────
 * WhatsApp rotates auto-generated class names and testids regularly, so a
 * selector table alone is a single point of failure. Detection is therefore
 * layered, and every layer is an *independent* signal that must be present
 * before an element is claimed:
 *
 *   1. explicit hints   — data-testid / aria-label / alt / title / class /
 *                         src tokens that state what the element is
 *   2. structural areas — chat pane, conversation header, info drawers,
 *                         list rows, message containers
 *   3. visual shape     — circular clipping, square aspect, avatar-sized box
 *   4. content zones    — hard exclusions (message content, media cells,
 *                         pickers) that an avatar/GIF never lives in
 *
 * ─── Fail-safe rule ─────────────────────────────────────────────────────────
 * When a signal cannot be determined (no layout yet, no `src`, no width/height
 * attribute, malformed selector) it counts as ABSENT. Absence can only *stop*
 * a candidate from being produced — it never adds one. Low confidence ⇒ no
 * blur, never a wrong blur.
 */

import { matchesAnySelector, queryAllInScope } from '../../query';

// ─── 1. Hints ───────────────────────────────────────────────────────────────

/** Attributes that carry author intent about what an element is. */
const HINT_ATTRS = ['data-testid', 'class', 'aria-label', 'alt', 'title', 'role'] as const;

/**
 * Lower-cased concatenation of every attribute that can describe intent,
 * including the media URL — CDN paths frequently encode the asset kind
 * (`pps.whatsapp.net/…`, `…/sticker/…`, `…gif…`).
 */
export function hintOf(el: Element): string {
  const parts: string[] = [];
  for (const name of HINT_ATTRS) {
    const value = el.getAttribute(name);
    if (value) parts.push(value);
  }
  const media = el as HTMLImageElement;
  const src = media.currentSrc || media.src || '';
  if (src) parts.push(src);
  const srcset = el.getAttribute('srcset');
  if (srcset) parts.push(srcset);
  return parts.join(' ').toLowerCase();
}

/** True when any hint attribute (or the media URL) contains a token. */
export function hasToken(el: Element, tokens: readonly string[]): boolean {
  const hint = hintOf(el);
  if (!hint) return false;
  return tokens.some((token) => hint.includes(token));
}

/**
 * `hasToken` on the element and its first `depth` ancestors.
 *
 * WhatsApp frequently puts the identifying testid on a WRAPPER rather than on
 * the media itself (`<span data-testid="sticker"><img></span>`), so an
 * element's own attributes are not enough.
 */
export function hasTokenNear(el: Element, tokens: readonly string[], depth = 3): boolean {
  let node: Element | null = el;
  for (let i = 0; node && i <= depth; i++, node = node.parentElement) {
    if (hasToken(node, tokens)) return true;
  }
  return false;
}

/** True when `el` sits inside (or is) any selector of the list. Fail-safe. */
export function isInsideAny(el: Element, selectors: readonly string[]): boolean {
  for (const sel of selectors) {
    try {
      if (el.closest(sel)) return true;
    } catch {
      // malformed selector — ignore, never let it swallow content
    }
  }
  return false;
}

/** Descendants of `root`, plus `root` itself when it is a matching element. */
export function queryInScope(selector: string, root: Document | Element): Element[] {
  return queryAllInScope(selector, root);
}

// ─── 2. ZONES ───────────────────────────────────────────────────────────────

/**
 * Message content. Anything inside a message bubble is *content*, never page
 * chrome, and must be classified by the media classifier rather than assumed
 * to be a profile photo.
 */
export const MESSAGE_ZONES = ['[data-testid="msg-container"]'] as const;

/**
 * Media cells WhatsApp wraps real message media in. Used both to keep
 * avatars out of the photo resolver and to tell a photo apart from a
 * sticker (stickers are the media that is NOT inside one of these).
 */
export const MEDIA_CHROME = [
  '[data-testid*="image-thumb"]',
  '[data-testid*="media-image"]',
  '[data-testid*="video-thumb"]',
  '[data-testid*="media-video"]',
  '[data-testid*="media-url-provider"]',
  '[data-testid*="document-thumb"]',
  '[data-testid*="media-document"]',
  '[data-testid*="link-preview"]',
  '[data-testid*="media"]',
] as const;

/** Text regions — an image here is inline emoji/quoting, never media. */
export const TEXT_ZONES = [
  '.selectable-text',
  '.copyable-text',
  '[data-testid*="cell-frame-title"]',
  '[data-testid*="cell-frame-secondary"]',
  '[data-testid*="last-msg"]',
] as const;

/**
 * WhatsApp UI that renders content-shaped tiles which must NEVER blur:
 * emoji picker, GIF picker, sticker picker, reaction picker, modal dialogs.
 */
export const PICKER_ZONES = [
  '[data-testid*="picker"]',
  '[aria-label*="picker" i]',
  '[data-testid*="sticker-search"]',
  '[data-testid*="gif-search"]',
  '[role="dialog"]',
] as const;

/**
 * Areas where WhatsApp legitimately shows a profile photo. Used as the
 * *context* half of avatar detection: a shape signal alone (square/circular)
 * is never enough — the photo must also sit where profile photos appear.
 */
export const AVATAR_AREAS = [
  '#pane-side',                                    // chat list pane
  '[data-testid="chat-list"]',
  '[data-testid="conversation-header"]',
  'header',                                        // conversation header
  '[role="listitem"]',                             // chat-list / participant rows
  '[data-testid*="drawer"]',                       // info drawers
  '[data-testid*="contact-info"]',
  '[data-testid*="group-info"]',
  '[data-testid*="participants"]',
  '[data-testid*="profile"]',
] as const;

/** Structural markers that identify a chat-list ROW (name + preview cell). */
export const CHAT_ROW_MARKERS = [
  'span[title][dir]',
  '[data-testid="cell-frame-title"]',
  '[data-testid="cell-frame-secondary"]',
  '[data-testid="last-msg"]',
  '[data-testid*="cell-frame"]',
] as const;

/**
 * Containers the row walk must never treat as a row. Without this list the
 * walk would keep climbing past the header/pane until it reached a container
 * that happened to hold the chat list's name cells, and would then vouch for
 * every unrelated image on the page.
 */
export const CHAT_ROW_STOP = [
  '#pane-side',
  '#main',
  '#app',
  'body',
  'html',
  '[data-testid="chat-list"]',
  '[data-testid="chat-list-header"]',
  '[data-testid="chat-list-search"]',
  '[data-testid="conversation-header"]',
  '[data-testid="conversation-panel-wrapper"]',
  '[data-testid="conversation-panel"]',
] as const;

// ─── Tokens ─────────────────────────────────────────────────────────────────

export const AVATAR_TOKENS = [
  'avatar',
  'profile picture',
  'profile-photo',
  'profile photo',
  'profile-picture',
  'default-user',
  'chatlist-avatar',
] as const;

/** Stable WhatsApp CDN hosts that only ever serve profile photos. */
export const AVATAR_CDN_TOKENS = ['pps.whatsapp.net', 'static.whatsapp.net'] as const;

export const GIF_TOKENS = ['gif', 'animated'] as const;
export const STICKER_TOKENS = ['sticker'] as const;

/** True when the element (or a near wrapper) is explicitly labelled an avatar. */
export function hasAvatarHint(el: Element): boolean {
  return hasTokenNear(el, AVATAR_TOKENS, 3) || hasTokenNear(el, AVATAR_CDN_TOKENS, 2);
}

export function isMessageContent(el: Element): boolean {
  return isInsideAny(el, MESSAGE_ZONES);
}

/** Inside the conversation surface (message area, panel, header). */
export function inConversation(el: Element): boolean {
  return isInsideAny(el, [
    '[data-testid="msg-container"]',
    '[data-testid="conversation-panel-wrapper"]',
    '#main',
  ]);
}

/**
 * WhatsApp in-message emoji are Unicode text; the rare inline `<img>` emoji
 * carry an `emoji` class/testid or a short non-ASCII `alt`. They must never
 * be mistaken for media.
 */
export function isEmojiLike(el: Element): boolean {
  if (hasTokenNear(el, ['emoji'], 2)) return true;
  const alt = (el.getAttribute('alt') ?? '').trim();
  if (alt.length > 0 && alt.length <= 4 && !/^[\x20-\x7E]+$/.test(alt)) return true;
  return false;
}

// ─── 3. SHAPE ───────────────────────────────────────────────────────────────

/** `border-radius` that clips the box to a circle/pill on any corner. */
function radiusIsCircular(value: string): boolean {
  if (!value || value === 'none') return false;
  return value.split(/[\s/]+/).filter(Boolean).some((token) => {
    if (token.endsWith('%')) return Number.parseFloat(token) >= 50;
    if (token.endsWith('px')) return Number.parseFloat(token) >= 1000; // 9999px pills
    return false;
  });
}

/**
 * WhatsApp clips every avatar to a circle. Checked on the element and on its
 * immediate media-only wrappers (the radius usually sits on the container).
 *
 * Stops as soon as a wrapper contains text: a chat row is not an avatar
 * wrapper, and its radius must not be credited to the image inside it.
 */
export function isCircular(el: Element): boolean {
  let node: Element | null = el;
  for (let i = 0; node && i < 3; i++, node = node.parentElement) {
    if (i > 0 && (node.textContent ?? '').trim().length > 0) break;
    let radius = '';
    try {
      radius = getComputedStyle(node).borderRadius;
    } catch {
      return false;
    }
    if (radiusIsCircular(radius)) return true;
  }
  return false;
}

function toPositive(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * width / height ratio, or `null` when it cannot be established.
 * Prefers explicit attributes (work without layout), then the decoded image
 * size, then the rendered box.
 */
export function aspectRatio(el: Element): number | null {
  const attrW = toPositive(el.getAttribute('width'));
  const attrH = toPositive(el.getAttribute('height'));
  if (attrW && attrH) return attrW / attrH;

  const media = el as HTMLImageElement;
  if (media.naturalWidth && media.naturalHeight) return media.naturalWidth / media.naturalHeight;

  const rect = el.getBoundingClientRect?.();
  if (rect && rect.width > 0 && rect.height > 0) return rect.width / rect.height;

  return null;
}

/** Aspect ratio within `[0.65, 1.55]` — square enough to be an avatar/sticker. */
export function isSquareish(el: Element): boolean {
  const ratio = aspectRatio(el);
  if (ratio === null) return false; // unknown ⇒ absent ⇒ never claimed
  return ratio >= 0.65 && ratio <= 1.55;
}

/**
 * Rendered box in the avatar band (16–300 px). Unknown layout ⇒ false.
 * Deliberately requires a positive measurement so tests/envs without layout
 * fall back to the fail-safe branch instead of guessing.
 */
export function isAvatarSized(el: Element): boolean {
  const rect = el.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return rect.width >= 16 && rect.width <= 300 && rect.height >= 16 && rect.height <= 300;
}

/**
 * Clearly an inline icon rather than content (≤16 px). Unknown ⇒ false, so a
 * layout-less environment never rejects real content.
 */
export function isTinyIcon(el: Element): boolean {
  const rect = el.getBoundingClientRect?.();
  if (!rect || rect.width <= 0) return false;
  return rect.width <= 16 && rect.height <= 16;
}

/**
 * The chat-list row an image belongs to: the nearest ancestor (below the pane
 * itself) that holds a contact-name or last-message cell.
 *
 * This is what separates an avatar from the other images WhatsApp renders in
 * the left pane — preview/search/branding chrome shares no row with a name,
 * so it never resolves to a row.
 *
 * Two guards keep this from over-reaching:
 *  - the walk stops at known page containers (pane, main, app, header), so an
 *    unrelated image in e.g. the conversation header can never inherit the
 *    chat list's name cells as "its row";
 *  - a candidate that itself contains other rows is the LIST, not a row, and
 *    is rejected instead of vouching for every image inside it.
 */
export function chatRowOf(el: Element): Element | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (matchesAnySelector(n, CHAT_ROW_STOP)) return null;

    if (!CHAT_ROW_MARKERS.some((sel) => matchesSelfOrDescendant(n, sel))) continue;

    if (n.querySelector('[role="listitem"], [data-testid*="cell-frame-container"]')) return null;
    return n;
  }
  return null;
}

function matchesSelfOrDescendant(el: Element, selector: string): boolean {
  try {
    return el.matches(selector) || el.querySelector(selector) !== null;
  } catch {
    return false;
  }
}
