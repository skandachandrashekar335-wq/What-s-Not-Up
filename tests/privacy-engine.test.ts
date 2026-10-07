/**
 * Tests for src/content/privacy-engine.ts
 *
 * jsdom provides a real DOM so we can test attribute application, style
 * injection and reveal listeners without a real browser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  injectStyles,
  removeStyles,
  protectElement,
  unprotectElement,
  unprotectAll,
  hideElement,
  unhideElement,
  updateRevealMode,
  clearAllTimers,
} from '../src/content/privacy-engine';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEl(tag = 'div'): Element {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function settings(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return { ...DEFAULT_SETTINGS, privacyEnabled: true, ...overrides };
}

beforeEach(() => {
  // Start each test with a clean DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  clearAllTimers();
});

afterEach(() => {
  clearAllTimers();
});

// ─── Style injection ──────────────────────────────────────────────────────────

describe('injectStyles', () => {
  it('creates a <style> element in <head>', () => {
    injectStyles(8);
    const style = document.getElementById('wnu-privacy-styles');
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe('STYLE');
  });

  it('contains the blur value', () => {
    injectStyles(10);
    const css = document.getElementById('wnu-privacy-styles')?.textContent ?? '';
    expect(css).toContain('blur(10px)');
  });

  it('clamps blur below 2 to 2', () => {
    injectStyles(0);
    const css = document.getElementById('wnu-privacy-styles')?.textContent ?? '';
    expect(css).toContain('blur(2px)');
  });

  it('clamps blur above 20 to 20', () => {
    injectStyles(999);
    const css = document.getElementById('wnu-privacy-styles')?.textContent ?? '';
    expect(css).toContain('blur(20px)');
  });

  it('updates existing style element rather than creating another', () => {
    injectStyles(5);
    injectStyles(12);
    const styles = document.querySelectorAll('#wnu-privacy-styles');
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toContain('blur(12px)');
  });
});

describe('removeStyles', () => {
  it('removes the injected style element', () => {
    injectStyles(8);
    removeStyles();
    expect(document.getElementById('wnu-privacy-styles')).toBeNull();
  });

  it('is safe to call when no style is present', () => {
    expect(() => removeStyles()).not.toThrow();
  });
});

// ─── Element protection ───────────────────────────────────────────────────────

describe('protectElement', () => {
  it('sets data-wnu-protected attribute', () => {
    const el = makeEl();
    protectElement(el, settings());
    expect(el.hasAttribute('data-wnu-protected')).toBe(true);
  });

  it('is idempotent — does not double-protect', () => {
    const el = makeEl();
    protectElement(el, settings());
    protectElement(el, settings());
    // Should still have the attribute exactly once (no stacking issues)
    expect(el.getAttribute('data-wnu-protected')).toBe('');
  });

  it('sets data-wnu-mode to the reveal mode', () => {
    const el = makeEl();
    protectElement(el, settings({ revealMode: 'click' }));
    expect(el.getAttribute('data-wnu-mode')).toBe('click');
  });

  it('sets data-wnu-dur to the reveal duration', () => {
    const el = makeEl();
    protectElement(el, settings({ temporaryRevealDurationMs: 5000 }));
    expect(el.getAttribute('data-wnu-dur')).toBe('5000');
  });
});

describe('unprotectElement', () => {
  it('removes data-wnu-protected', () => {
    const el = makeEl();
    protectElement(el, settings());
    unprotectElement(el);
    expect(el.hasAttribute('data-wnu-protected')).toBe(false);
  });

  it('removes data-wnu-revealed', () => {
    const el = makeEl();
    protectElement(el, settings());
    el.setAttribute('data-wnu-revealed', '');
    unprotectElement(el);
    expect(el.hasAttribute('data-wnu-revealed')).toBe(false);
  });

  it('removes data-wnu-hidden', () => {
    const el = makeEl();
    el.setAttribute('data-wnu-hidden', '');
    unprotectElement(el);
    expect(el.hasAttribute('data-wnu-hidden')).toBe(false);
  });
});

describe('unprotectAll', () => {
  it('removes protection from all protected elements', () => {
    const els = [makeEl(), makeEl(), makeEl()];
    els.forEach((el) => protectElement(el, settings()));
    unprotectAll();
    els.forEach((el) => {
      expect(el.hasAttribute('data-wnu-protected')).toBe(false);
    });
  });

  it('removes data-wnu-hidden from all hidden elements', () => {
    const els = [makeEl(), makeEl()];
    els.forEach((el) => el.setAttribute('data-wnu-hidden', ''));
    unprotectAll();
    els.forEach((el) => {
      expect(el.hasAttribute('data-wnu-hidden')).toBe(false);
    });
  });
});

// ─── Hide/unhide ──────────────────────────────────────────────────────────────

describe('hideElement / unhideElement', () => {
  it('sets data-wnu-hidden', () => {
    const el = makeEl();
    hideElement(el);
    expect(el.hasAttribute('data-wnu-hidden')).toBe(true);
  });

  it('removes data-wnu-hidden', () => {
    const el = makeEl();
    hideElement(el);
    unhideElement(el);
    expect(el.hasAttribute('data-wnu-hidden')).toBe(false);
  });
});

// ─── Reveal interactions ──────────────────────────────────────────────────────

describe('hover reveal mode', () => {
  it('reveals on mouseenter and hides on mouseleave', () => {
    const el = makeEl();
    protectElement(el, settings({ revealMode: 'hover' }));

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(el.hasAttribute('data-wnu-revealed')).toBe(true);

    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(el.hasAttribute('data-wnu-revealed')).toBe(false);
  });
});

describe('click reveal mode', () => {
  it('toggles revealed attribute on click', () => {
    const el = makeEl();
    protectElement(el, settings({ revealMode: 'click' }));

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.hasAttribute('data-wnu-revealed')).toBe(true);

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.hasAttribute('data-wnu-revealed')).toBe(false);
  });
});

describe('temporary reveal mode', () => {
  it('reveals on click then auto-hides after duration', () => {
    vi.useFakeTimers();
    const el = makeEl();
    protectElement(el, settings({ revealMode: 'temporary', temporaryRevealDurationMs: 1000 }));

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.hasAttribute('data-wnu-revealed')).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(el.hasAttribute('data-wnu-revealed')).toBe(false);
    vi.useRealTimers();
  });
});

// ─── updateRevealMode ─────────────────────────────────────────────────────────

describe('updateRevealMode', () => {
  it('updates mode attribute on already-protected elements', () => {
    const el = makeEl();
    protectElement(el, settings({ revealMode: 'hover' }));
    expect(el.getAttribute('data-wnu-mode')).toBe('hover');

    updateRevealMode(settings({ revealMode: 'click' }));
    expect(el.getAttribute('data-wnu-mode')).toBe('click');
  });
});

// ─── clearAllTimers ───────────────────────────────────────────────────────────

describe('clearAllTimers', () => {
  it('does not throw when called with no active timers', () => {
    expect(() => clearAllTimers()).not.toThrow();
  });
});
