/**
 * Tests for src/content/dom-processor.ts
 *
 * We build a fake WhatsApp-like DOM, run applyProtections/removeProtections,
 * and verify that the right elements get protected.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyProtections, removeProtections, processNewNodes, unprotectByType } from '../src/content/dom-processor';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

/**
 * Build a minimal fake WhatsApp DOM so selectors have something to match.
 * Uses the stable selectors from selectors.ts:
 *   messageText → span.selectable-text
 *   chatListName → span[title][dir]
 *   profilePhoto → img[alt="Profile photo"]
 *   mediaImage  → img[src*="blob:"] → we can't fake this easily, use testid
 *   chatListPreview → [data-testid="last-msg"]
 *   onlineStatus → [data-testid="status"]
 *   typingIndicator → [data-testid="typing"]
 */
function buildFakeDOM() {
  document.body.innerHTML = `
    <div id="pane-side">
      <span title="Alice" dir="ltr">Alice</span>
      <span data-testid="last-msg">Hey there</span>
      <img alt="Profile photo" src="https://example.com/avatar.jpg" />
    </div>
    <div id="main">
      <header data-testid="conversation-header">
        <span data-testid="conversation-info-header-chat-title" dir="ltr">Alice</span>
        <span data-testid="status">online</span>
        <span data-testid="typing">typing…</span>
      </header>
      <div data-testid="conversation-panel-wrapper">
        <span class="selectable-text">Hello world</span>
        <span class="selectable-text">Another message</span>
        <div data-testid="link-preview">Link preview</div>
      </div>
    </div>
  `;
}

beforeEach(() => {
  buildFakeDOM();
});

// ─── applyProtections ─────────────────────────────────────────────────────────

describe('applyProtections', () => {
  it('does nothing when privacyEnabled is false', () => {
    applyProtections({ ...DEFAULT_SETTINGS, privacyEnabled: false });
    const protected_ = document.querySelectorAll('[data-wnu-protected]');
    expect(protected_.length).toBe(0);
  });

  it('protects message text spans', () => {
    applyProtections(settings());
    const msgEls = document.querySelectorAll('span.selectable-text');
    msgEls.forEach((el) => {
      expect(el.hasAttribute('data-wnu-protected')).toBe(true);
    });
  });

  it('protects contact names', () => {
    applyProtections(settings());
    const nameEl = document.querySelector('span[title="Alice"]');
    expect(nameEl?.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('protects chat list previews', () => {
    applyProtections(settings());
    const preview = document.querySelector('[data-testid="last-msg"]');
    expect(preview?.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('protects profile photos', () => {
    applyProtections(settings());
    const photo = document.querySelector('img[alt="Profile photo"]');
    expect(photo?.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('hides online status when enabled', () => {
    applyProtections(settings({ hideOnlineStatus: true }));
    const status = document.querySelector('[data-testid="status"]');
    expect(status?.hasAttribute('data-wnu-hidden')).toBe(true);
  });

  it('hides typing indicator when enabled', () => {
    applyProtections(settings({ hideTypingIndicator: true }));
    const typing = document.querySelector('[data-testid="typing"]');
    expect(typing?.hasAttribute('data-wnu-hidden')).toBe(true);
  });

  it('does NOT hide status when the toggle is off', () => {
    applyProtections(settings({ hideOnlineStatus: false }));
    const status = document.querySelector('[data-testid="status"]');
    expect(status?.hasAttribute('data-wnu-hidden')).toBe(false);
  });

  it('does NOT protect messages when blurMessages is off', () => {
    applyProtections(settings({ blurMessages: false }));
    const msgs = document.querySelectorAll('span.selectable-text');
    msgs.forEach((el) => {
      expect(el.hasAttribute('data-wnu-protected')).toBe(false);
    });
  });

  it('marks types on protected elements', () => {
    applyProtections(settings());
    const msgEl = document.querySelector('span.selectable-text');
    expect(msgEl?.getAttribute('data-wnu-type')).toBe('message');
  });

  it('is safe to call multiple times (idempotent)', () => {
    applyProtections(settings());
    applyProtections(settings());
    const msgs = document.querySelectorAll('span.selectable-text');
    msgs.forEach((el) => {
      // data-wnu-protected should be set once, not stacked
      expect(el.getAttribute('data-wnu-protected')).toBe('');
    });
  });
});

// ─── removeProtections ────────────────────────────────────────────────────────

describe('removeProtections', () => {
  it('removes data-wnu-protected from all elements', () => {
    applyProtections(settings());
    removeProtections();
    expect(document.querySelectorAll('[data-wnu-protected]').length).toBe(0);
  });

  it('un-hides status and typing elements', () => {
    applyProtections(settings());
    removeProtections();
    const status = document.querySelector('[data-testid="status"]');
    const typing = document.querySelector('[data-testid="typing"]');
    expect(status?.hasAttribute('data-wnu-hidden')).toBe(false);
    expect(typing?.hasAttribute('data-wnu-hidden')).toBe(false);
  });
});

// ─── processNewNodes ─────────────────────────────────────────────────────────

describe('processNewNodes', () => {
  it('protects elements added to the DOM after initial load', () => {
    applyProtections(settings());

    // Simulate a new message being injected
    const newMsg = document.createElement('span');
    newMsg.className = 'selectable-text';
    newMsg.textContent = 'New message';
    document.getElementById('main')!.appendChild(newMsg);

    // processNewNodes would be called by the MutationObserver
    const nodeList = [newMsg] as unknown as NodeList;
    processNewNodes(nodeList, settings());

    expect(newMsg.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('does nothing when privacyEnabled is false', () => {
    const newMsg = document.createElement('span');
    newMsg.className = 'selectable-text';
    document.body.appendChild(newMsg);

    processNewNodes([newMsg] as unknown as NodeList, { ...DEFAULT_SETTINGS, privacyEnabled: false });
    expect(newMsg.hasAttribute('data-wnu-protected')).toBe(false);
  });
});

// ─── unprotectByType ─────────────────────────────────────────────────────────

describe('unprotectByType', () => {
  it('removes protection only from elements of the specified type', () => {
    applyProtections(settings());

    // There should be message-type elements
    const msgBefore = document.querySelectorAll('[data-wnu-type="message"]');
    expect(msgBefore.length).toBeGreaterThan(0);

    unprotectByType('message');

    const msgAfter = document.querySelectorAll('[data-wnu-type="message"][data-wnu-protected]');
    expect(msgAfter.length).toBe(0);

    // Other types should still be protected
    const names = document.querySelectorAll('[data-wnu-protected]');
    expect(names.length).toBeGreaterThan(0);
  });
});
