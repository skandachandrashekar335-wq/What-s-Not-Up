/**
 * Privacy Engine
 *
 * Applies and removes CSS-based blur/hide transformations to DOM elements.
 * This module has no knowledge of WhatsApp-specific selectors — it receives
 * element sets from the content script and applies generic transformations.
 *
 * All transforms are purely visual (CSS). No content is read, stored or sent.
 */

import { PrivacySettings, RevealMode } from '../shared/types';

const PROTECTED_ATTR = 'data-wnu-protected';
const REVEALED_ATTR = 'data-wnu-revealed';
const STYLE_ID = 'wnu-privacy-styles';

// Track temporary reveal timers so we can clear them
const revealTimers = new Map<Element, ReturnType<typeof setTimeout>>();

/**
 * Inject (or update) the global CSS that drives blur transforms.
 */
export function injectStyles(intensity: number): void {
  // Clamp to the same range exposed by the UI sliders (2–20px)
  const blur = Math.max(2, Math.min(intensity, 20));
  const existing = document.getElementById(STYLE_ID);
  const css = `
    [${PROTECTED_ATTR}] {
      filter: blur(${blur}px) !important;
      transition: filter 0.15s ease !important;
      user-select: none !important;
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    [${PROTECTED_ATTR}][${REVEALED_ATTR}] {
      filter: blur(0) !important;
      user-select: text !important;
    }
    [data-wnu-hidden] {
      visibility: hidden !important;
    }
    @media (prefers-reduced-motion: reduce) {
      [${PROTECTED_ATTR}] {
        transition: none !important;
      }
    }
  `;

  if (existing) {
    existing.textContent = css;
  } else {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head ?? document.documentElement).appendChild(style);
  }
}

export function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * Mark an element as privacy-protected and attach reveal listeners.
 */
export function protectElement(el: Element, settings: PrivacySettings): void {
  if (el.hasAttribute(PROTECTED_ATTR)) return; // already protected

  el.setAttribute(PROTECTED_ATTR, '');

  attachRevealListener(el, settings);
}

/**
 * Remove protection from a single element.
 */
export function unprotectElement(el: Element): void {
  el.removeAttribute(PROTECTED_ATTR);
  el.removeAttribute(REVEALED_ATTR);
  el.removeAttribute('data-wnu-hidden');

  const timer = revealTimers.get(el);
  if (timer) {
    clearTimeout(timer);
    revealTimers.delete(el);
  }

  // Remove any listeners we attached (we use the attribute as a guard)
  el.removeEventListener('mouseenter', handleMouseEnter);
  el.removeEventListener('mouseleave', handleMouseLeave);
  el.removeEventListener('click', handleClick);
}

/**
 * Remove all protection from the page.
 */
export function unprotectAll(): void {
  document.querySelectorAll(`[${PROTECTED_ATTR}]`).forEach(unprotectElement);
  document.querySelectorAll('[data-wnu-hidden]').forEach((el) => {
    el.removeAttribute('data-wnu-hidden');
  });
}

// ─── Reveal listeners ────────────────────────────────────────────────────────

// We use named functions so we can removeEventListener reliably.
// These close over nothing; current settings are read from the element's own
// dataset at event time via a bound settings holder.

function handleMouseEnter(this: Element): void {
  reveal(this);
}

function handleMouseLeave(this: Element): void {
  unreveal(this);
}

function handleClick(this: Element, ev: Event): void {
  ev.stopPropagation();
  const mode = this.getAttribute('data-wnu-mode') as RevealMode | null;
  if (mode === 'click') {
    if (this.hasAttribute(REVEALED_ATTR)) {
      unreveal(this);
    } else {
      reveal(this);
    }
  } else if (mode === 'temporary') {
    reveal(this);
    const dur = parseInt(this.getAttribute('data-wnu-dur') ?? '3000', 10);
    scheduleHide(this, dur);
  }
}

function reveal(el: Element): void {
  el.setAttribute(REVEALED_ATTR, '');
}

function unreveal(el: Element): void {
  el.removeAttribute(REVEALED_ATTR);
  const timer = revealTimers.get(el);
  if (timer) {
    clearTimeout(timer);
    revealTimers.delete(el);
  }
}

function scheduleHide(el: Element, durationMs: number): void {
  const existing = revealTimers.get(el);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    el.removeAttribute(REVEALED_ATTR);
    revealTimers.delete(el);
  }, durationMs);

  revealTimers.set(el, timer);
}

function attachRevealListener(el: Element, settings: PrivacySettings): void {
  el.setAttribute('data-wnu-mode', settings.revealMode);
  el.setAttribute('data-wnu-dur', String(settings.temporaryRevealDurationMs));

  // Teardown any previous listeners first
  el.removeEventListener('mouseenter', handleMouseEnter);
  el.removeEventListener('mouseleave', handleMouseLeave);
  el.removeEventListener('click', handleClick);

  switch (settings.revealMode) {
    case 'hover':
      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mouseleave', handleMouseLeave);
      break;
    case 'click':
    case 'temporary':
      el.addEventListener('click', handleClick);
      break;
  }
}

/**
 * Update reveal settings on already-protected elements.
 * Called when settings change without a full re-apply.
 */
export function updateRevealMode(settings: PrivacySettings): void {
  document.querySelectorAll(`[${PROTECTED_ATTR}]`).forEach((el) => {
    // Remove old listeners, re-attach with new settings
    el.removeEventListener('mouseenter', handleMouseEnter);
    el.removeEventListener('mouseleave', handleMouseLeave);
    el.removeEventListener('click', handleClick);

    attachRevealListener(el, settings);
  });
}

/**
 * Hide an element (visibility: hidden) without removing it from the layout.
 */
export function hideElement(el: Element): void {
  el.setAttribute('data-wnu-hidden', '');
}

export function unhideElement(el: Element): void {
  el.removeAttribute('data-wnu-hidden');
}

/**
 * Clear all temporary timers (called on unload).
 */
export function clearAllTimers(): void {
  revealTimers.forEach((timer) => clearTimeout(timer));
  revealTimers.clear();
}
