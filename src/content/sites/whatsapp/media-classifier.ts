/**
 * WhatsApp media classifier.
 *
 * One pure function decides what a media element IS, and every category
 * target only claims elements whose classification matches its own kind:
 *
 *     WhatsApp media candidate
 *       → classifyWhatsAppMedia()
 *       → IMAGE | VIDEO | GIF | STICKER | null
 *       → category-specific protection
 *
 * Because classification is a pure function of the element, the categories are
 * mutually exclusive by construction: a GIF can never be claimed by the image
 * target just because that target happens to be evaluated first. That is what
 * keeps the toggles independent.
 *
 * ─── Scope ──────────────────────────────────────────────────────────────────
 * Classification only runs inside the conversation surface (message area /
 * panel / header) and never inside pickers or dialogs, so WhatsApp's GIF and
 * sticker pickers, reaction picker and emoji panel stay visible.
 *
 * ─── Confidence ─────────────────────────────────────────────────────────────
 * Every rule below is positive evidence — an identifying token on the element
 * or its wrapper, a marker attribute, or a shape that WhatsApp only uses for
 * that kind of media. Anything ambiguous returns `null`, which means "not my
 * category": the element is left to the other targets (or to no target at
 * all). Fail-safe is always *no blur*, never a wrong blur.
 */

import {
  GIF_TOKENS,
  MEDIA_CHROME,
  PICKER_ZONES,
  STICKER_TOKENS,
  TEXT_ZONES,
  hasAvatarHint,
  hasTokenNear,
  inConversation,
  isEmojiLike,
  isInsideAny,
  isMessageContent,
  isSquareish,
  isTinyIcon,
  queryInScope,
} from './dom';

export type WhatsAppMediaKind = 'image' | 'video' | 'gif' | 'sticker';

/**
 * Element shapes WhatsApp uses for message media. Deliberately NOT a bare
 * `*`/`[role=…]`/`div` sweep — only media tags and the marker attributes
 * that state animation explicitly.
 */
const MEDIA_CANDIDATES =
  'img, video, canvas, picture, [data-animated], [data-autoplay],' +
  ' [data-testid*="gif"], [data-testid*="sticker"],' +
  ' [aria-label*="gif" i], [aria-label*="sticker" i]';

/** Classify one element, or return `null` when there is not enough evidence. */
export function classifyWhatsAppMedia(el: Element): WhatsAppMediaKind | null {
  // Avatars are the photo target's business, never media.
  if (hasAvatarHint(el)) return null;
  // Inline runs of text (emoji, quoted text) are not media.
  if (isInsideAny(el, TEXT_ZONES)) return null;
  if (isEmojiLike(el)) return null;
  // GIFs and stickers only exist inside a conversation — never in the chat
  // list, and never in a picker/dialog where tiles are UI, not content.
  if (!inConversation(el)) return null;
  if (isInsideAny(el, PICKER_ZONES)) return null;

  // ── L1: explicit tokens on the element or a wrapping container ────────────
  if (hasTokenNear(el, STICKER_TOKENS, 3)) return 'sticker';
  if (el.hasAttribute('data-animated') || el.hasAttribute('data-autoplay')) return 'gif';
  if (hasTokenNear(el, GIF_TOKENS, 3)) return 'gif';

  const inMessage = isMessageContent(el);

  // ── L2: rendering mode WhatsApp only uses for one kind of media ───────────
  // WhatsApp never renders a real video as a looping, control-less player —
  // that combination is exactly how an animated GIF is embedded.
  if (el.tagName === 'VIDEO') {
    if (inMessage && el.hasAttribute('loop') && !el.hasAttribute('controls')) return 'gif';
    return 'video';
  }
  // Animated stickers are painted on a canvas; photos never are.
  if (el.tagName === 'CANVAS') return inMessage ? 'sticker' : null;
  if (el.tagName !== 'IMG') return null;

  // ── L3: where the image sits ──────────────────────────────────────────────
  if (isInsideAny(el, MEDIA_CHROME)) return 'image';

  // A bare <img> inside a message bubble that is not in a media cell is how
  // WhatsApp renders stickers: it keeps its own aspect box, has no caption
  // run of its own and is square. Requiring the square test keeps this from
  // claiming inline decorations whose layout is unknown.
  if (inMessage && !isTinyIcon(el) && isSquareish(el)) return 'sticker';

  return null;
}

/**
 * Structural GIF/sticker detection. Runs in addition to the selector table so
 * renamed testids, CDN-only `src` paths, wrapper-based labels, canvas
 * stickers and looped-video GIFs are all reached without a selector update.
 *
 * The element returned is the one that carries the visible media; when a
 * wrapper is ALSO a candidate (e.g. `[data-testid="sticker"]` around an
 * `<img>`), the DOM processor's `resolveOwner` collapses the two into a single
 * blur owner.
 */
export function resolveWhatsAppGifsAndStickers(root: Document | Element): Element[] {
  const out = new Set<Element>();
  for (const el of queryInScope(MEDIA_CANDIDATES, root)) {
    const kind = classifyWhatsAppMedia(el);
    if (kind === 'gif' || kind === 'sticker') out.add(el);
  }
  return Array.from(out);
}
