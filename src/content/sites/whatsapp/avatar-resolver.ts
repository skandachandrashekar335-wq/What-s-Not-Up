/**
 * WhatsApp profile-photo resolver.
 *
 * Layered avatar detection — no single selector is load-bearing:
 *
 *   L0  exact selector paths      (SELECTORS.profilePhoto, union-matched)
 *   L1  explicit hint             testid/class/alt/aria or a profile-photo CDN
 *                                 URL, on the image or its immediate wrapper
 *   L2  structural context        the image sits where WhatsApp shows avatars
 *                                 (chat pane, conversation header, info drawers,
 *                                 participant/list rows)
 *   L3  visual shape              WhatsApp clips every avatar to a circle; in
 *                                 the chat list the avatar is also the image
 *                                 that shares its row with the contact name
 *
 * A candidate must satisfy L1 outright, OR (L2 AND L3). Anything else is
 * rejected — the resolver returns nothing rather than a wrong blur.
 *
 * Hard exclusions run first: message content, media cells, text runs and
 * pickers never contain a profile photo, so they can never be claimed here.
 *
 * Returns the `<img>` itself, never its wrapper. Nesting (a wrapper that is
 * also a candidate) is resolved upstream by `resolveOwner`, which guarantees a
 * single blur owner per region.
 */

import {
  AVATAR_AREAS,
  MEDIA_CHROME,
  MESSAGE_ZONES,
  PICKER_ZONES,
  TEXT_ZONES,
  chatRowOf,
  hasAvatarHint,
  isAvatarSized,
  isCircular,
  isInsideAny,
  isSquareish,
  isTinyIcon,
  queryInScope,
} from './dom';

/** Zones an avatar can never live in — checked before any positive signal. */
const NEVER_AVATAR_ZONES = [...MESSAGE_ZONES, ...MEDIA_CHROME, ...TEXT_ZONES, ...PICKER_ZONES];

/**
 * True when `img` is a profile photo with enough evidence to blur it.
 * Exported for targeted unit tests (the resolver itself is exercised through
 * `resolveWhatsAppProfilePhotos`).
 */
export function isProfilePhoto(img: Element): boolean {
  // L4: hard exclusions. Message media, inline emoji, previews and picker
  // tiles are content/chrome — never a profile photo.
  if (isInsideAny(img, NEVER_AVATAR_ZONES)) return false;

  // L1: the element says what it is (testid/class/alt/aria/CDN URL).
  if (hasAvatarHint(img)) return true;

  // L2: structural context — without it, shape alone is not evidence.
  if (!isInsideAny(img, AVATAR_AREAS)) return false;

  // L3a: circular clipping (works even if every avatar testid was renamed).
  if (isCircular(img)) return true;

  // L3b: chat-list rows — the avatar shares its row with the contact name,
  // and it is not a ≤16px inline icon.
  const row = chatRowOf(img);
  if (row && !isTinyIcon(img)) return true;

  // L3c: drawer / header avatars that are not yet clipped (e.g. lazy render)
  // must still be square and avatar-sized before being claimed.
  if (isSquareish(img) && isAvatarSized(img)) return true;

  return false;
}

export function resolveWhatsAppProfilePhotos(root: Document | Element): Element[] {
  const out = new Set<Element>();
  for (const img of queryInScope('img', root)) {
    if (isProfilePhoto(img)) out.add(img);
  }
  // Background-image avatars: WhatsApp normally uses <img>, but profile
  // surfaces occasionally paint the photo straight onto a container. Claimed
  // only inside avatar areas and only when explicitly labelled as an avatar,
  // so this can never widen to arbitrary decorative backgrounds.
  for (const el of queryInScope('[style*="background-image"]', root)) {
    if (isInsideAny(el, NEVER_AVATAR_ZONES)) continue;
    if (!isInsideAny(el, AVATAR_AREAS)) continue;
    if (hasAvatarHint(el)) out.add(el);
  }
  return Array.from(out);
}
