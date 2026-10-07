/**
 * Tests for src/content/overlay.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { showOverlay, hideOverlay, isOverlayVisible } from '../src/content/overlay';

beforeEach(() => {
  // Remove overlay if left over from previous test
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
