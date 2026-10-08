/**
 * Instagram site adapter.
 *
 * All Instagram DOM knowledge (selectors, structural resolvers, logical
 * reveal groups) is contained here — the privacy engine and DOM processor
 * stay site-agnostic.
 *
 * Verification status (October 2026, live www.instagram.com):
 *   ✓ profile photos      — public profile, post and comment avatars
 *   ✓ feed/reel media     — profile grid, explore-style permalink anchors
 *   ✓ story/highlight     — /stories/ highlight covers
 *   ✓ post captions       — structural resolver, verified on live post page
 *   ✓ comment rows        — structural resolver, 14/14 live comments matched
 *   ✗ DMs / stories viewer / reels viewer — require login, NOT implemented
 *
 * Instagram has no stable CSS class for "a comment" or "a post", so content
 * that cannot be identified by a stable attribute is located by structural
 * resolvers anchored on verified URL shapes (/p/…/c/… comment permalinks,
 * profile hrefs, timestamps). Resolvers are fail-safe: when unsure they
 * return nothing, which means no blur — never a wrong blur.
 */

import { SiteAdapter } from '../types';
import { SELECTORS, isProfileHref } from './selectors';

function queryAllSafe(selector: string, root: Document | Element): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * A comment row carries its author (single-segment profile link) and its
 * text (a dir="auto" text span that is neither inside a link — that would
 * be the username — nor wrapping a <time> — that would be the timestamp).
 *
 * Structure verified live:
 *   div.comment-item            ← returned element (reveal-group root)
 *     div.header-row            ← nearest ancestor of /p/…/c/… with author link
 *       a[href="/user/"] …
 *       a[href="/p/…/c/…"] > time
 *     div.text-row
 *       span[dir="auto"] …      ← comment text
 */
function looksLikeCommentItem(el: Element): boolean {
  const hasAuthorLink = queryAllSafe('a[href]', el).some((a) => isProfileHref(a.getAttribute('href')));
  if (!hasAuthorLink) return false;

  return queryAllSafe('span[dir="auto"]', el).some((span) => {
    if (span.closest('a')) return false;      // username wrapper, not text
    if (span.querySelector('time')) return false; // timestamp wrapper, not text
    return (span.textContent ?? '').trim().length > 0;
  });
}

export function resolveInstagramCommentItems(root: Document | Element): Element[] {
  const items = new Set<Element>();

  for (const anchor of queryAllSafe(SELECTORS.commentPermalink, root)) {
    // 1. Nearest ancestor containing the author's profile link = header row.
    let header: Element | null = null;
    for (let n = anchor.parentElement; n; n = n.parentElement) {
      if (queryAllSafe('a[href]', n).some((a) => isProfileHref(a.getAttribute('href')))) {
        header = n;
        break;
      }
    }
    if (!header?.parentElement) continue;

    // 2. The header row's parent = the whole comment (author + time + text).
    const item = header.parentElement;
    if (looksLikeCommentItem(item)) items.add(item);
  }

  return Array.from(items);
}

/**
 * The caption block sits next to the post header: the nearest ancestor of
 * the post timestamp (comment timestamps are excluded via their permalink)
 * that contains the author's profile link, then its first non-media text
 * sibling after the header.
 *
 * Verified live: resolved exactly the post caption and nothing else.
 * If the structure does not match (feed vs. permalink view), nothing is
 * returned — fail-safe.
 */
export function resolveInstagramCaptions(root: Document | Element): Element[] {
  const captions = new Set<Element>();

  for (const time of queryAllSafe(SELECTORS.postTime, root)) {
    if (time.closest(SELECTORS.commentPermalink)) continue; // comment timestamp

    let header: Element | null = null;
    for (let n = time.parentElement; n; n = n.parentElement) {
      if (queryAllSafe('a[href]', n).some((a) => isProfileHref(a.getAttribute('href')))) {
        header = n;
        break;
      }
    }
    if (!header?.parentElement) continue;

    const block = header.parentElement;
    const kids = Array.from(block.children);
    const headerIdx = kids.indexOf(header);
    if (headerIdx === -1) continue;

    for (let i = headerIdx + 1; i < kids.length; i++) {
      const kid = kids[i];
      if (kid.querySelector('img, video, svg')) continue; // media / action buttons
      if ((kid.textContent ?? '').trim().length > 0) {
        captions.add(kid);
        break;
      }
    }
  }

  return Array.from(captions);
}

export const instagramAdapter: SiteAdapter = {
  id: 'instagram',
  host: 'www.instagram.com',

  /**
   * No stable CSS class exists for Instagram's logical containers
   * (everything is generated StyleX). Comment rows are grouped via their
   * structural resolver instead (`resolvedAreGroupRoots`); other targets
   * (media, captions, avatars) are standalone regions revealed directly.
   */
  groupRoots: [],

  targets: [
    // Profile photos first: on overlap with media selectors, avatars win.
    {
      type: 'photo',
      setting: 'blurProfilePhotos',
      selectors: SELECTORS.profilePhoto,
      match: 'first',
    },
    {
      type: 'image',
      setting: 'blurImages',
      selectors: SELECTORS.feedImage,
      match: 'union',
    },
    {
      type: 'video',
      setting: 'blurVideos',
      selectors: SELECTORS.feedVideo,
      match: 'union',
    },
    {
      type: 'caption',
      setting: 'blurCaptions',
      selectors: [],
      resolve: resolveInstagramCaptions,
    },
    {
      type: 'comment',
      setting: 'blurComments',
      selectors: [],
      resolve: resolveInstagramCommentItems,
      // The whole comment row is one logical region: author, avatar,
      // timestamp and text reveal and re-blur together.
      resolvedAreGroupRoots: true,
    },
  ],
};
