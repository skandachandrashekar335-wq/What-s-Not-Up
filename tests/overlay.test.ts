/**
 * Tests for src/content/overlay.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { showOverlay, hideOverlay, isOverlayVisible } from '../src/content/overlay';

beforeEach(() => {
  // Removes any leftover overlay AND its document-level Escape listener.
  hideOverlay();
  document.getElementById('wnu-overlay')?.remove();
});

describe('showOverlay', () => {
  it('creates an overlay element in the document', () => {
    showOverlay();
    expect(document.getElementById('wnu-overlay')).not.toBeNull();
  });

  it('is idempotent — does not create a second overlay', () => {
    showOverlay();
    showOverlay();
    expect(document.querySelectorAll('#wnu-overlay').length).toBe(1);
  });

  it('has the correct ARIA attributes', () => {
    showOverlay();
    const overlay = document.getElementById('wnu-overlay')!;
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-label')).toBeTruthy();
  });

  it('contains the PRIVATE MODE text', () => {
    showOverlay();
    expect(document.getElementById('wnu-overlay')?.textContent).toContain('PRIVATE MODE');
  });

  it('is a modal dialog that can receive focus', () => {
    showOverlay();
    const overlay = document.getElementById('wnu-overlay')!;
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(overlay.tabIndex).toBe(-1);
  });

  it('moves focus into the overlay so hidden content is not navigated', () => {
    showOverlay();
    expect(document.activeElement).toBe(document.getElementById('wnu-overlay'));
  });

  it('tells the user how to dismiss it with the keyboard', () => {
    showOverlay();
    expect(document.getElementById('wnu-overlay')?.textContent).toContain('Esc');
  });
});

describe('hideOverlay', () => {
  it('removes the overlay', () => {
    showOverlay();
    hideOverlay();
    expect(document.getElementById('wnu-overlay')).toBeNull();
  });

  it('is safe to call when no overlay is present', () => {
    expect(() => hideOverlay()).not.toThrow();
  });

  it('is dismissed by the Escape key', () => {
    showOverlay();
    expect(isOverlayVisible()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(isOverlayVisible()).toBe(false);
    expect(document.getElementById('wnu-overlay')).toBeNull();
  });

  it('ignores other keys while the overlay is up', () => {
    showOverlay();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(isOverlayVisible()).toBe(true);
  });

  it('returns focus to the element that had it before the overlay appeared', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    showOverlay();
    expect(document.activeElement).not.toBe(trigger);

    hideOverlay();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it('stops listening for Escape once hidden', () => {
    showOverlay();
    hideOverlay();

    // A stale listener would still run hideOverlay() against a missing node.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    ).not.toThrow();
    expect(isOverlayVisible()).toBe(false);
  });
});

describe('isOverlayVisible', () => {
  it('returns false when no overlay is present', () => {
    expect(isOverlayVisible()).toBe(false);
  });

  it('returns true when overlay is shown', () => {
    showOverlay();
    expect(isOverlayVisible()).toBe(true);
  });

  it('returns false after overlay is hidden', () => {
    showOverlay();
    hideOverlay();
    expect(isOverlayVisible()).toBe(false);
  });
});
