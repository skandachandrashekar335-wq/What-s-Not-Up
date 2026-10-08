/**
 * Instagram DOM selectors.
 *
 * Verified against the live www.instagram.com DOM (October 2026) on public
 * profile and post pages. Instagram exposes NO data-testid attributes and
 * builds almost everything from generated StyleX classes (x1…, html-div),
 * so only stable, content-derived attributes are used here:
 *
 *   - alt text conventions ("<user>'s profile picture", "Photo by <user> …")
 *   - permalink href shapes (/…/p/…, /…/reel/…, /…/c/…, /stories/…)
 *   - the <video> element (Instagram never uses <video> for UI chrome)
 *
 * Deliberately NOT matched: bare img/div/span/*, [role] containers, or
 * generated class names — those would blur navigation, buttons and settings.
 *
 * Known limitation: alt text is localised with the account language; the
 * alt-based fallbacks only match on English UI (the href-based selectors
 * still work regardless of language).
 */

export const SELECTORS = {
  /**
   * Profile pictures anywhere (profile header, post header, comment
   * avatars, suggested accounts). Verified: `nasa's profile picture`.
   */
  profilePhoto: [
    'img[alt$="profile picture"]',
    'img[alt$="profile photo"]',
  ],

  /**
   * Feed/post/reel media.
   * Grid and explore thumbnails live inside permalink anchors; modal/feed
   * media is matched by the generated alt convention as a fallback.
   * Story/highlight covers live inside /stories/ anchors.
   */
  feedImage: [
    'a[href*="/p/"] img',
    'a[href*="/stories/"] img',
    'img[alt^="Photo by "]',
    'img[alt^="Photo dans "]', // French-UI alt fallback
  ],

  feedVideo: [
    'a[href*="/reel/"] img',
    'a[href*="/p/"] video',
    'img[alt^="Video by "]',
    'video',
  ],

  /**
   * Comment permalink — URL shape verified on live post pages
   * (/p/<code>/c/<comment-id>/). Used by the structural resolver in
   * ../instagram/index.ts to locate whole comment rows, which have no
   * stable class of their own.
   */
  commentPermalink: 'a[href*="/c/"]',

  /**
   * Post timestamp. Post header times are NOT wrapped in a comment
   * permalink; comment times are. Used to locate the caption block.
   */
  postTime: 'time',
} as const;

/**
 * Single-segment profile href (/username/) — Instagram usernames contain
 * only letters, digits, periods and underscores. Excludes /p/, /reel/,
 * /explore/, /accounts/… etc. by construction.
 */
export const PROFILE_HREF_RE = /^\/[A-Za-z0-9._]+\/$/;

export function isProfileHref(href: string | null): boolean {
  return !!href && PROFILE_HREF_RE.test(href);
}
