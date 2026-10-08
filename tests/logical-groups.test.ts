/**
 * Regression tests for BUG #1: nested privacy targets.
 *
 * Observed on real WhatsApp Web: hovering a message revealed most of it,
 * but nested content stayed blurred because a parent AND its children both
 * received `filter: blur()` — CSS filters stack, so un-blurring the child
 * could never visually win over the blurred parent.
 *
 * Invariants proven here:
 *  1. One logical content region has exactly ONE owning privacy target.
 *  2. No protected element ever has a protected ancestor.
 *  3. Hovering the group root reveals EVERY protected part together.
 *  4. Leaving re-blurs everything together.
 *  5. Click and timed reveal behave the same way.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyProtections,
  removeProtections,
  processNewNodes,
} from '../src/content/dom-processor';
import { clearAllTimers } from '../src/content/privacy-engine';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

/** WhatsApp-like message DOM with all the nested content from the bug report. */
function buildMessageDOM(): void {
  document.body.innerHTML = `
    <div id="chat">
      <div data-testid="msg-container">
        <div class="copyable-text">
          <span class="selectable-text">
            Hello 🙂 see <a href="https://example.com">this link</a>
          </span>
        </div>
        <div data-testid="link-preview">example.com — Preview title</div>
      </div>
      <div data-testid="msg-container">
        <span class="selectable-text">Second message</span>
      </div>
    </div>
    <header data-testid="conversation-header">
      <span data-testid="conversation-info-header-chat-title" dir="ltr">Alice</span>
      <img alt="Profile photo" src="https://example.com/avatar.jpg" />
    </header>
  `;
}

function protectedEls(): Element[] {
  return Array.from(document.querySelectorAll('[data-wnu-protected]'));
}

function noNestedProtection(): boolean {
  return protectedEls().every(
    (el) => el.parentElement?.closest('[data-wnu-protected]') === null,
  );
}

beforeEach(() => {
  buildMessageDOM();
  removeProtections(); // clear group registry from previous tests
  clearAllTimers();
});

afterEach(() => {
  removeProtections();
  clearAllTimers();
});

// ─── Single owning target ────────────────────────────────────────────────────

describe('logical privacy groups', () => {
  it('protects exactly the owners of each region, never a parent and child together', () => {
    applyProtections(settings());

    const protectedTags = protectedEls().map((el) =>
      el.matches('.selectable-text')
        ? 'text'
        : el.matches('[data-testid="link-preview"]')
          ? 'link-preview'
          : el.matches('[data-testid="conversation-header"]')
            ? 'header'
            : el.tagName.toLowerCase(),
    );

    expect(protectedTags.sort()).toEqual(
      ['header', 'link-preview', 'text', 'text'].sort(),
    );
    // The .copyable-text wrapper must NOT become a second blur layer.
    expect(document.querySelector('.copyable-text')?.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('never produces a protected element inside another protected element', () => {
    applyProtections(settings());
    expect(protectedEls().length).toBeGreaterThan(0);
    expect(noNestedProtection()).toBe(true);
  });

  it('does not protect the contact-name span or avatar separately when their header is protected', () => {
    applyProtections(settings());

    const header = document.querySelector('[data-testid="conversation-header"]')!;
    const name = document.querySelector('[data-testid="conversation-info-header-chat-title"]')!;
    const avatar = document.querySelector('img[alt="Profile photo"]')!;

    expect(header.hasAttribute('data-wnu-protected')).toBe(true);
    expect(name.hasAttribute('data-wnu-protected')).toBe(false);
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(false);
    // They are still classified so toggle bookkeeping works.
    expect(name.getAttribute('data-wnu-type')).toBe('header-name');
    expect(noNestedProtection()).toBe(true);
  });

  it('groups text and link preview of one message under the message container', () => {
    applyProtections(settings());

    const bubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
    const text = bubble.querySelector('.selectable-text')!;
    const preview = bubble.querySelector('[data-testid="link-preview"]')!;

    expect(text.hasAttribute('data-wnu-protected')).toBe(true);
    expect(preview.hasAttribute('data-wnu-protected')).toBe(true);
    // Both listen on the same logical container (the group root).
    expect(bubble.getAttribute('data-wnu-mode')).toBe('hover');
    expect(bubble.getAttribute('data-wnu-dur')).toBe('3000');
  });
});

// ─── Group reveal ────────────────────────────────────────────────────────────

describe('group reveal (hover)', () => {
  it('reveals every protected part of the message together', () => {
    applyProtections(settings());

    const bubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
    const text = bubble.querySelector('.selectable-text')!;
    const preview = bubble.querySelector('[data-testid="link-preview"]')!;

    bubble.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(text.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(preview.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(bubble.hasAttribute('data-wnu-revealed')).toBe(true);
  });

  it('re-blurs everything together when the hover ends', () => {
    applyProtections(settings());

    const bubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
    const text = bubble.querySelector('.selectable-text')!;
    const preview = bubble.querySelector('[data-testid="link-preview"]')!;

    bubble.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    bubble.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(text.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(preview.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(bubble.hasAttribute('data-wnu-revealed')).toBe(false);
    // Still protected after re-blur
    expect(text.hasAttribute('data-wnu-protected')).toBe(true);
    expect(preview.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('does not reveal other messages or the chat header', () => {
    applyProtections(settings());

    const firstBubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
    const secondBubble = document.querySelectorAll('[data-testid="msg-container"]')[1];
    const header = document.querySelector('[data-testid="conversation-header"]')!;

    firstBubble.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(secondBubble.querySelector('.selectable-text')!.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(header.hasAttribute('data-wnu-revealed')).toBe(false);
  });

  it('nested elements (emoji, links) reveal with their protected ancestor — no child blur layers', () => {
    applyProtections(settings());

    const bubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
    const text = bubble.querySelector('.selectable-text')!;
    const link = text.querySelector('a')!;

    // The link is NOT independently protected (it lives inside the owner)…
    expect(link.hasAttribute('data-wnu-protected')).toBe(false);
    // …so revealing the owner reveals the link by construction.
    bubble.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(text.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(link.closest('[data-wnu-protected]')).not.toBeNull();

    bubble.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(text.hasAttribute('data-wnu-revealed')).toBe(false);
  });
});

// ─── Click / timed reveal ────────────────────────────────────────────────────

describe('group reveal (click)', () => {
  it('toggles the whole group on click', () => {
    applyProtections(settings({ revealMode: 'click' }));

    const bubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
    const text = bubble.querySelector('.selectable-text')!;
    const preview = bubble.querySelector('[data-testid="link-preview"]')!;

    bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(text.hasAttribute('data-wnu-revealed')).toBe(true);
    expect(preview.hasAttribute('data-wnu-revealed')).toBe(true);

    bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(text.hasAttribute('data-wnu-revealed')).toBe(false);
    expect(preview.hasAttribute('data-wnu-revealed')).toBe(false);
  });
});

describe('group reveal (timed)', () => {
  it('reveals the group, then re-blurs after the duration', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers();
    try {
      applyProtections(settings({ revealMode: 'temporary', temporaryRevealDurationMs: 1000 }));

      const bubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
      const text = bubble.querySelector('.selectable-text')!;
      const preview = bubble.querySelector('[data-testid="link-preview"]')!;

      bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(text.hasAttribute('data-wnu-revealed')).toBe(true);
      expect(preview.hasAttribute('data-wnu-revealed')).toBe(true);

      vi.advanceTimersByTime(1001);
      expect(text.hasAttribute('data-wnu-revealed')).toBe(false);
      expect(preview.hasAttribute('data-wnu-revealed')).toBe(false);
      expect(text.hasAttribute('data-wnu-protected')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── Incremental DOM updates ─────────────────────────────────────────────────

describe('nested content added later', () => {
  it('never protects a new element inside an already-protected region', () => {
    applyProtections(settings());

    const bubble = document.querySelectorAll('[data-testid="msg-container"]')[0];
    const text = bubble.querySelector('.selectable-text')!;

    // A link preview injected INSIDE the protected text span (the real-world
    // WhatsApp nesting scenario).
    const nested = document.createElement('div');
    nested.setAttribute('data-testid', 'link-preview');
    nested.textContent = 'Nested preview';
    text.appendChild(nested);

    processNewNodes([nested] as unknown as NodeList, settings());

    expect(nested.hasAttribute('data-wnu-protected')).toBe(false);
    expect(noNestedProtection()).toBe(true);
    // The region still reveals as one unit via its existing owner.
    bubble.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(text.hasAttribute('data-wnu-revealed')).toBe(true);
  });

  it('re-evaluates ownership after protections are removed and re-applied', () => {
    applyProtections(settings({ blurChatHeader: false }));
    const header = document.querySelector('[data-testid="conversation-header"]')!;
    const avatar = document.querySelector('img[alt="Profile photo"]')!;

    // Header toggle off: the avatar and name become their own owners,
    // grouped by the conversation header container.
    expect(header.hasAttribute('data-wnu-protected')).toBe(false);
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(true);
    expect(header.getAttribute('data-wnu-mode')).toBe('hover');

    // Re-apply with the header toggle on: header owns the region again.
    removeProtections();
    applyProtections(settings());
    expect(header.hasAttribute('data-wnu-protected')).toBe(true);
    expect(avatar.hasAttribute('data-wnu-protected')).toBe(false);
    expect(noNestedProtection()).toBe(true);
  });
});
