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
 * ─── Video thumbnail coverage ───────────────────────────────────────────────
 * WhatsApp renders video thumbnails as an <img> (the poster frame) inside a
 * video container, not as a <video> element with a poster attribute. The
 * stable testids ([data-testid="video-thumb"], [data-testid="media-video"])
 * cover the container, but the <img> inside it is what the user actually sees.
 *
 * When those testids change or are absent, resolveWhatsAppVideos() provides a
 * structural fallback: any <img> or <video> inside a video-shaped container
 * (token VIDEO_TOKENS on the element or a close ancestor) inside a message
 * bubble is classified as video. This mirrors the GIF/sticker resolver.
 *
 * Forwarded messages wrap their media in an additional container that still
 * sits inside [data-testid="msg-container"], so inConversation() returns true
 * and the same pipeline covers them without special-casing.
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
  VIDEO_TOKENS,
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

/**
 * Structural video detection. Runs in addition to the selector table to cover:
 *
 *  - Video thumbnails rendered as an <img> (poster frame) inside a container
 *    that has a video-related token but no stable testid yet registered in
 *    SELECTORS.mediaVideo. This is the primary vector for the reported privacy
 *    failure: the <img> preview frame is visible even when blurVideos is on,
 *    because the selector table only matched the container, not its inner img.
 *
 *  - Forwarded video: WhatsApp wraps forwarded media in an extra container
 *    that still lives inside [data-testid="msg-container"], so inConversation()
 *    holds and the same pipeline handles them without special-casing.
 *
 *  - Play-button overlays: the play-button <div> or <svg> that sits on top of
 *    the poster frame is claimed as part of the same video group because it
 *    shares the video container. resolveOwner() then collapses them to one
 *    blur owner, so the play button never reveals the poster frame.
 *
 * The element returned is the visible media element (img or video), not just
 * the outer container, so the blur always lands on what the eye can see.
 */
export function resolveWhatsAppVideos(root: Document | Element): Element[] {
  const out = new Set<Element>();

  // Pass 1: explicit video elements classified as VIDEO by the classifier.
  for (const el of queryInScope('video', root)) {
    if (classifyWhatsAppMedia(el) === 'video') out.add(el);
  }

  // Pass 2: <img> elements that are inside a video-shaped container but are
  // NOT covered by the stable selector table (their container lacks a known
  // testid). This handles the poster-frame-as-img pattern.
  for (const el of queryInScope('img', root)) {
    // Must be inside a message (not in the chat list or pickers).
    if (!isMessageContent(el)) continue;
    if (isInsideAny(el, PICKER_ZONES)) continue;
    if (hasAvatarHint(el)) continue;
    if (isEmojiLike(el)) continue;

    // The image must sit inside a container whose testid/class/aria/title
    // contains a video-indicating token.
    if (hasTokenNear(el, VIDEO_TOKENS, 4)) {
      out.add(el);
    }
  }

  return Array.from(out);
}
