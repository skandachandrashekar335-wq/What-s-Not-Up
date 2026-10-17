/**
 * Video resolver regression tests.
 *
 * Covers:
 *  - resolveWhatsAppVideos catches <img> poster frames inside video containers
 *  - resolveWhatsAppVideos catches <video> elements classified as video
 *  - Forwarded message media is covered (nested extra container)
 *  - Multiple video items in one message
 *  - Avatar images inside video containers are NOT claimed
 *  - Images outside a message (chat list) are NOT claimed
 *  - Picker/dialog images are NOT claimed
 *  - Existing selector-based testid matches still work (regression)
 */
import { describe, it, expect } from 'vitest';
import { resolveWhatsAppVideos } from '../src/content/sites/whatsapp/media-classifier';

// ─── DOM fixture helpers ──────────────────────────────────────────────────────

/** Minimal WhatsApp message container wrapping arbitrary children. */
function msgContainer(inner: string): string {
  return `<div data-testid="msg-container">${inner}</div>`;
}

function videoThumbEl(inner: string): string {
  return `<div data-testid="video-thumb">${inner}</div>`;
}

function forwardedWrap(inner: string): string {
  // Forwarded messages have an extra wrapper but still live inside msg-container.
  return `<div data-testid="forwarded-message">${inner}</div>`;
}

function buildDoc(bodyHTML: string): Document {
  const doc = document.implementation.createHTMLDocument('test');
  doc.body.innerHTML = bodyHTML;
  return doc;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('resolveWhatsAppVideos — <img> poster frame', () => {
  it('claims an <img> inside [data-testid="video-thumb"]', () => {
    const doc = buildDoc(msgContainer(videoThumbEl('<img src="poster.jpg" />')));
    const results = resolveWhatsAppVideos(doc);
    const imgs = results.filter((el) => el.tagName === 'IMG');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it('claims an <img> inside a container with class containing "video"', () => {
    const doc = buildDoc(
      msgContainer('<div class="video-preview-container"><img src="frame.jpg" /></div>')
    );
    const results = resolveWhatsAppVideos(doc);
    const imgs = results.filter((el) => el.tagName === 'IMG');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it('claims an <img> inside a container with aria-label containing "video"', () => {
    const doc = buildDoc(
      msgContainer('<div aria-label="video player"><img src="thumb.jpg" /></div>')
    );
    const results = resolveWhatsAppVideos(doc);
    const imgs = results.filter((el) => el.tagName === 'IMG');
    expect(imgs.length).toBeGreaterThan(0);
  });
});

describe('resolveWhatsAppVideos — <video> element', () => {
  it('claims a <video> element inside a message', () => {
    const doc = buildDoc(
      msgContainer('<div data-testid="media-video"><video src="clip.mp4" controls></video></div>')
    );
    const results = resolveWhatsAppVideos(doc);
    const videos = results.filter((el) => el.tagName === 'VIDEO');
    expect(videos.length).toBeGreaterThan(0);
  });

  it('does NOT claim a looping muted <video> (that is a GIF, not a video)', () => {
    // A looping, control-less video = GIF in the classifier.
    const doc = buildDoc(
      msgContainer('<div data-testid="gif-player"><video src="anim.mp4" loop autoplay></video></div>')
    );
    const results = resolveWhatsAppVideos(doc);
    const videos = results.filter((el) => el.tagName === 'VIDEO');
    // May return 0 because the classifier returns 'gif' for this pattern.
    // If it returns >0 that means the resolver ignores classification — fail.
    expect(videos.length).toBe(0);
  });
});

describe('resolveWhatsAppVideos — forwarded messages', () => {
  it('claims <img> in a forwarded message wrapper inside msg-container', () => {
    const doc = buildDoc(
      msgContainer(forwardedWrap(videoThumbEl('<img src="fwd-poster.jpg" />')))
    );
    const results = resolveWhatsAppVideos(doc);
    const imgs = results.filter((el) => el.tagName === 'IMG');
    expect(imgs.length).toBeGreaterThan(0);
  });
});

describe('resolveWhatsAppVideos — multiple items in one message', () => {
  it('claims multiple video thumbnails in one message bubble', () => {
    const doc = buildDoc(
      msgContainer(
        videoThumbEl('<img src="thumb1.jpg" />') +
        videoThumbEl('<img src="thumb2.jpg" />') +
        videoThumbEl('<img src="thumb3.jpg" />')
      )
    );
    const results = resolveWhatsAppVideos(doc);
    const imgs = results.filter((el) => el.tagName === 'IMG');
    expect(imgs.length).toBe(3);
  });
});

describe('resolveWhatsAppVideos — exclusions', () => {
  it('does NOT claim an <img> outside a message container', () => {
    // Image sits in the chat list pane, not inside msg-container.
    const doc = buildDoc(
      '<div id="pane-side"><div data-testid="video-thumb"><img src="chat-list-img.jpg" /></div></div>'
    );
    const results = resolveWhatsAppVideos(doc);
    expect(results.filter((el) => el.tagName === 'IMG').length).toBe(0);
  });

  it('does NOT claim an avatar image inside a video-labelled container', () => {
    // An avatar has a CDN URL from pps.whatsapp.net — should be excluded.
    const doc = buildDoc(
      msgContainer(
        '<div data-testid="video-thumb"><img src="https://pps.whatsapp.net/avatar.jpg" /></div>'
      )
    );
    const results = resolveWhatsAppVideos(doc);
    expect(results.filter((el) => el.tagName === 'IMG').length).toBe(0);
  });

  it('does NOT claim images inside a picker dialog', () => {
    const doc = buildDoc(
      msgContainer(
        '<div data-testid="emoji-picker"><div data-testid="video-thumb"><img src="picker-video.jpg" /></div></div>'
      )
    );
    const results = resolveWhatsAppVideos(doc);
    expect(results.filter((el) => el.tagName === 'IMG').length).toBe(0);
  });
});

describe('resolveWhatsAppVideos — selector regression', () => {
  it('still catches [data-testid="video-thumb"] containers', () => {
    const doc = buildDoc(
      msgContainer('<div data-testid="video-thumb"><img src="reg-thumb.jpg" /></div>')
    );
    const results = resolveWhatsAppVideos(doc);
    expect(results.length).toBeGreaterThan(0);
  });

  it('still catches [data-testid="media-video"] containers', () => {
    const doc = buildDoc(
      msgContainer('<div data-testid="media-video"><img src="media-thumb.jpg" /></div>')
    );
    const results = resolveWhatsAppVideos(doc);
    expect(results.length).toBeGreaterThan(0);
  });
});
