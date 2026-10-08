/**
 * Instagram adapter tests.
 *
 * The fixture mirrors structures verified against the live
 * www.instagram.com DOM (October 2026):
 *   - `img[alt$="profile picture"]` avatars
 *   - grid/reel thumbnails inside /p/ and /reel/ permalink anchors
 *   - highlight covers inside /stories/ anchors
 *   - post header (profile link + <time>) with the caption as its sibling
 *   - comment rows anchored on /p/<code>/c/<id>/ permalinks, containing
 *     author link, timestamp and a dir="auto" text span
 *
 * Fail-safe rule: navigation, buttons, search and other UI must NEVER be
 * protected — asserted explicitly below.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyProtections, removeProtections, processNewNodes } from '../src/content/dom-processor';
import { clearAllTimers } from '../src/content/privacy-engine';
import { instagramAdapter } from '../src/content/sites/instagram';
import { resolveInstagramCommentItems, resolveInstagramCaptions } from '../src/content/sites/instagram';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

function buildInstagramDOM(): void {
  document.body.innerHTML = `
    <nav data-testid="ig-nav">
      <a href="/">Home</a>
      <a href="/explore/">Explore</a>
      <a href="/direct/inbox/">Direct</a>
      <input name="search" aria-label="Search" />
      <button aria-label="Settings">Settings</button>
    </nav>
    <main>
      <header>
        <img alt="nasa's profile picture" src="https://cdn/pfp.jpg" />
        <h2>nasa</h2>
      </header>
      <section data-testid="grid">
        <a href="/nasa/p/DdHyaYAifb6/">
          <span><span><img alt="Photo by NASA on October 5, 2026. May be an image of text." src="https://cdn/grid1.jpg" /></span></span>
        </a>
        <a href="/nasa/reel/DeIXf9SNQVO/">
          <span><img alt="Video by NASA on October 05, 2026." src="https://cdn/reel1.jpg" /></span>
        </a>
        <a href="/stories/highlights/18195781759377100/">
          <img alt="nasa's highlight story picture" src="https://cdn/highlight.jpg" />
        </a>
      </section>
      <div data-testid="post">
        <div class="post-header">
          <a href="/nasa/"><img alt="nasa's profile picture" src="https://cdn/pfp2.jpg" /></a>
          <span class="post-time"><time datetime="2026-10-05">3 w</time></span>
        </div>
        <span class="post-caption">Cementing their names in history.<span>#artemis</span></span>

        <div class="comment-item" data-fake="comment-1">
          <div class="comment-header">
            <span><a href="/ejitraco/"><span>ejitraco</span></a></span>
            <span><a href="/nasa/p/DdHyaYAifb6/c/18022383731870070/"><time datetime="2026-10-07">27 m</time></a></span>
          </div>
          <div class="comment-text-row">
            <span dir="auto">I think before i turn 30 going to space</span>
          </div>
        </div>

        <div class="comment-item" data-fake="comment-2">
          <div class="comment-header">
            <span><a href="/lalloo_13/"><span>lalloo_13</span></a></span>
            <span><a href="/nasa/p/DdHyaYAifb6/c/18022383731870080/"><time datetime="2026-10-07">51 m</time></a></span>
          </div>
          <div class="comment-text-row">
            <span dir="auto">yoo luca parmitano is the honor</span>
          </div>
        </div>
      </div>
    </main>
  `;
}

const ig = (selector: string): Element | null => document.querySelector(selector);
const igAll = (selector: string): Element[] => Array.from(document.querySelectorAll(selector));

function protectedEls(): Element[] {
  return Array.from(document.querySelectorAll('[data-wnu-protected]'));
}

beforeEach(() => {
  buildInstagramDOM();
  removeProtections();
  clearAllTimers();
});

afterEach(() => {
  removeProtections();
  clearAllTimers();
});

// ─── Selectors ───────────────────────────────────────────────────────────────

describe('Instagram selectors', () => {
  it('protects profile pictures by alt text', () => {
    applyProtections(settings(), instagramAdapter);

    const avatars = igAll('img[alt$="profile picture"]');
    expect(avatars.length).toBe(2);
    avatars.forEach((el) => {
      expect(el.hasAttribute('data-wnu-protected')).toBe(true);
      expect(el.getAttribute('data-wnu-type')).toBe('photo');
    });
  });

  it('protects feed/grid images and reel thumbnails inside permalink anchors', () => {
    applyProtections(settings(), instagramAdapter);

    const gridPhoto = ig('a[href*="/p/"] img')!;
    const reelThumb = ig('a[href*="/reel/"] img')!;
    expect(gridPhoto.hasAttribute('data-wnu-protected')).toBe(true);
    expect(gridPhoto.getAttribute('data-wnu-type')).toBe('image');
    expect(reelThumb.hasAttribute('data-wnu-protected')).toBe(true);
    expect(reelThumb.getAttribute('data-wnu-type')).toBe('video');
  });

  it('protects story/highlight covers', () => {
    applyProtections(settings(), instagramAdapter);
    const highlight = ig('a[href*="/stories/"] img')!;
    expect(highlight.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('unions additive selectors (anchor-based AND alt-based media)', () => {
    // Modal-style media that is NOT inside a permalink anchor.
    const loose = document.createElement('img');
    loose.setAttribute('alt', 'Photo by NASA on October 5, 2026.');
    loose.src = 'https://cdn/modal.jpg';
    ig('main')!.appendChild(loose);

    applyProtections(settings(), instagramAdapter);

    expect(ig('a[href*="/p/"] img')!.hasAttribute('data-wnu-protected')).toBe(true);
    expect(loose.hasAttribute('data-wnu-protected')).toBe(true);
  });
});

// ─── Fail-safe ───────────────────────────────────────────────────────────────

describe('fail-safe behaviour', () => {
  it('never protects navigation, buttons, inputs or generic UI', () => {
    applyProtections(settings(), instagramAdapter);

    expect(ig('nav')!.hasAttribute('data-wnu-protected')).toBe(false);
    igAll('nav a, nav button, nav input').forEach((el) => {
      expect(el.hasAttribute('data-wnu-protected')).toBe(false);
      expect(el.hasAttribute('data-wnu-hidden')).toBe(false);
    });
    expect(ig('header h2')!.hasAttribute('data-wnu-protected')).toBe(false);
    expect(ig('.post-time')!.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('never creates nested blur layers', () => {
    applyProtections(settings(), instagramAdapter);
    expect(protectedEls().length).toBeGreaterThan(0);
    const nested = protectedEls().filter(
      (el) => el.parentElement?.closest('[data-wnu-protected]') !== null,
    );
    expect(nested).toEqual([]);
  });

  it('does nothing when privacy mode is disabled', () => {
    applyProtections({ ...DEFAULT_SETTINGS, privacyEnabled: false }, instagramAdapter);
    expect(protectedEls().length).toBe(0);
  });
});

// ─── Captions ────────────────────────────────────────────────────────────────

describe('Instagram captions', () => {
  it('protects exactly the caption block, not the header or timestamp', () => {
    applyProtections(settings(), instagramAdapter);

    const caption = ig('.post-caption')!;
    expect(caption.hasAttribute('data-wnu-protected')).toBe(true);
    expect(caption.getAttribute('data-wnu-type')).toBe('caption');
    expect(ig('.post-header')!.hasAttribute('data-wnu-protected')).toBe(false);
    expect(ig('.post-time')!.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('respects the captions toggle', () => {
    applyProtections(settings({ blurCaptions: false }), instagramAdapter);
    expect(ig('.post-caption')!.hasAttribute('data-wnu-protected')).toBe(false);
  });
});

// ─── Comments ────────────────────────────────────────────────────────────────

describe('Instagram comments', () => {
  it('protects the whole comment row as ONE owner', () => {
    applyProtections(settings(), instagramAdapter);

    const items = igAll('.comment-item');
    expect(items.length).toBe(2);
    items.forEach((item) => {
      expect(item.hasAttribute('data-wnu-protected')).toBe(true);
      expect(item.getAttribute('data-wnu-type')).toBe('comment');
      // No protected children inside the row (no nested blur conflict).
      expect(item.querySelector('[data-wnu-protected]')).toBeNull();
    });
  });

  it('reveals a comment row as one unit on hover and re-blurs on leave', () => {
    applyProtections(settings(), instagramAdapter);

    const item = igAll('.comment-item')[0];
    const text = item.querySelector('[dir="auto"]')!;
    const author = item.querySelector('a[href="/ejitraco/"]')!;

    expect(text.hasAttribute('data-wnu-protected')).toBe(false);
    expect(author.hasAttribute('data-wnu-protected')).toBe(false);

    item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(item.hasAttribute('data-wnu-revealed')).toBe(true);

    item.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(item.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(item.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('keeps comment rows as separate reveal groups', () => {
    applyProtections(settings(), instagramAdapter);

    const [first, second] = igAll('.comment-item');
    first.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(first.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(second.hasAttribute('data-wnu-revealed')).toBe(false);
  });

  it('respects the comments toggle', () => {
    applyProtections(settings({ blurComments: false }), instagramAdapter);
    igAll('.comment-item').forEach((item) => {
      expect(item.hasAttribute('data-wnu-protected')).toBe(false);
    });
    // Avatars inside comments are then their own owners.
    const avatar = ig('.comment-item a[href="/ejitraco/"] img');
    expect(avatar).toBeNull(); // fixture authors have no avatar image
  });

  it('blurs the comment avatar as part of the row when comments are on', () => {
    const avatar = document.createElement('img');
    avatar.setAttribute('alt', "ejitraco's profile picture");
    ig('.comment-item .comment-header')!.appendChild(avatar);

    applyProtections(settings(), instagramAdapter);

    const item = ig('.comment-item')!;
    expect(item.hasAttribute('data-wnu-protected')).toBe(true);
    // The avatar is covered by the row owner — not blurred a second time.
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(false);
    expect(avatar.parentElement?.closest('[data-wnu-protected]')).not.toBeNull();
  });

  it('protects the avatar alone when comments are disabled', () => {
    const avatar = document.createElement('img');
    avatar.setAttribute('alt', "ejitraco's profile picture");
    ig('.comment-item .comment-header')!.appendChild(avatar);

    applyProtections(settings({ blurComments: false }), instagramAdapter);

    expect(avatar.hasAttribute('data-wnu-protected')).toBe(true);
    expect(ig('.comment-item')!.hasAttribute('data-wnu-protected')).toBe(false);
  });
});

// ─── Structural resolvers ────────────────────────────────────────────────────

describe('structural resolvers', () => {
  it('resolveCommentItems returns exactly the comment rows', () => {
    const items = resolveInstagramCommentItems(document);
    expect(items.length).toBe(2);
    items.forEach((el) => expect(el.classList.contains('comment-item')).toBe(true));
  });

  it('resolveCaptions returns exactly the caption block', () => {
    const captions = resolveInstagramCaptions(document);
    expect(captions.length).toBe(1);
    expect(captions[0].classList.contains('post-caption')).toBe(true);
  });

  it('resolvers are scoped to a subtree', () => {
    const grid = ig('[data-testid="grid"]')!;
    expect(resolveInstagramCommentItems(grid)).toEqual([]);
    expect(resolveInstagramCaptions(grid)).toEqual([]);
  });

  it('resolvers never throw on malformed or empty scopes', () => {
    const detached = document.createElement('div');
    expect(() => resolveInstagramCommentItems(detached)).not.toThrow();
    expect(() => resolveInstagramCaptions(detached)).not.toThrow();
  });
});

// ─── Dynamic DOM ─────────────────────────────────────────────────────────────

describe('dynamic content', () => {
  it('processNewNodes protects newly scrolled-in comments', () => {
    applyProtections(settings(), instagramAdapter);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="comment-item">
        <div class="comment-header">
          <span><a href="/newuser/"><span>newuser</span></a></span>
          <span><a href="/nasa/p/DdHyaYAifb6/c/999/"><time>1 m</time></a></span>
        </div>
        <div class="comment-text-row"><span dir="auto">brand new comment</span></div>
      </div>
    `;
    document.querySelector('[data-testid="post"]')!.appendChild(wrap);
    processNewNodes([wrap] as unknown as NodeList, settings(), instagramAdapter);

    const item = wrap.querySelector('.comment-item')!;
    expect(item.hasAttribute('data-wnu-protected')).toBe(true);
    expect(item.getAttribute('data-wnu-type')).toBe('comment');
  });

  it('processNewNodes honours disabled categories', () => {
    applyProtections(settings({ blurComments: false }), instagramAdapter);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="comment-item">
        <div class="comment-header">
          <span><a href="/newuser/"><span>newuser</span></a></span>
          <span><a href="/nasa/p/DdHyaYAifb6/c/999/"><time>1 m</time></a></span>
        </div>
        <div class="comment-text-row"><span dir="auto">brand new comment</span></div>
      </div>
    `;
    document.querySelector('[data-testid="post"]')!.appendChild(wrap);
    processNewNodes([wrap] as unknown as NodeList, settings({ blurComments: false }), instagramAdapter);

    expect(wrap.querySelector('.comment-item')!.hasAttribute('data-wnu-protected')).toBe(false);
  });
});
