/**
 * Privacy Engine
 *
 * Applies and removes CSS-based blur/hide transformations to DOM elements.
 * This module has no knowledge of site-specific selectors — it receives
 * elements (and their logical reveal groups) from the DOM processor and
 * applies generic transformations.
 *
 * ─── Logical reveal groups ──────────────────────────────────────────────────
 * One logical content region (e.g. a chat message containing text, emoji,
 * links, previews and media) must have exactly ONE owning privacy target.
 * Blurring both a parent and its child would stack CSS filters, so a child
 * inside a blurred parent can never be visually un-blurred on its own.
 *
 * Therefore:
 *  - only the outermost element of a region ever receives `data-wnu-protected`
 *  - reveal listeners are attached to the region's GROUP ROOT
 *  - revealing sets `data-wnu-revealed` on the root AND every protected owner
 *    in the group, so all protected parts reveal and re-blur together
 *
 * All transforms are purely visual (CSS). Content is never collected, stored
 * or transmitted — only attributes are written to elements the site itself
 * has already rendered.
 */

import { PrivacySettings, RevealMode } from '../shared/types';

export const PROTECTED_ATTR = 'data-wnu-protected';
export const REVEALED_ATTR = 'data-wnu-revealed';
export const HIDDEN_ATTR = 'data-wnu-hidden';
export const MODE_ATTR = 'data-wnu-mode';
export const DUR_ATTR = 'data-wnu-dur';

const STYLE_ID = 'wnu-privacy-styles';

interface RevealGroup {
  /** Element the reveal listeners are attached to (the logical container). */
  root: Element;
  /** Protected owner elements that reveal together with the root. */
  owners: Set<Element>;
  mode: RevealMode;
  durationMs: number;
}

/** All active groups, keyed by their reveal root. */
const groups = new Map<Element, RevealGroup>();
/** Owner → its group (fast lookup for unprotectElement). */
const ownerToGroup = new Map<Element, RevealGroup>();
/** Temporary reveal timers, keyed by the group root. */
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
    [${REVEALED_ATTR}] [${PROTECTED_ATTR}] {
      filter: blur(0) !important;
      user-select: text !important;
    }
    [${HIDDEN_ATTR}] {
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

// ─── Protection ──────────────────────────────────────────────────────────────

/**
 * Protect a single element as both owner and reveal root.
 * (Backwards-compatible entry point — most callers want `protectGroup`.)
 */
export function protectElement(el: Element, settings: PrivacySettings): void {
  protectGroup(el, el, settings);
}

/**
 * Protect `owner` (receives the blur) as part of the reveal group rooted at
 * `root`. Every owner in one group reveals and re-blurs together.
 *
 * Idempotent: an element that is already protected is left untouched.
 */
export function protectGroup(owner: Element, root: Element, settings: PrivacySettings): void {
  if (owner.hasAttribute(PROTECTED_ATTR)) return; // already protected

  let group = groups.get(root);
  if (!group) {
    group = {
      root,
      owners: new Set(),
      mode: settings.revealMode,
      durationMs: settings.temporaryRevealDurationMs,
    };
    groups.set(root, group);
    attachGroupListeners(group);
  }

  owner.setAttribute(PROTECTED_ATTR, '');
  group.owners.add(owner);
  ownerToGroup.set(owner, group);

  // If the group is currently revealed (e.g. the pointer is already inside
  // it), the newly protected element must start revealed as well.
  if (root.hasAttribute(REVEALED_ATTR)) {
    owner.setAttribute(REVEALED_ATTR, '');
  }
}

/**
 * Remove protection from a single element.
 */
export function unprotectElement(el: Element): void {
  el.removeAttribute(PROTECTED_ATTR);
  el.removeAttribute(REVEALED_ATTR);
  el.removeAttribute(HIDDEN_ATTR);
  clearTimer(el);

  const group = ownerToGroup.get(el);
  if (group) {
    ownerToGroup.delete(el);
    group.owners.delete(el);
    if (group.owners.size === 0) {
      teardownGroup(group);
      groups.delete(group.root);
    }
  }

  // Legacy/defensive: remove listeners we may have attached directly.
  el.removeEventListener('mouseenter', handleMouseEnter);
  el.removeEventListener('mouseleave', handleMouseLeave);
  el.removeEventListener('click', handleClick);
}

/**
 * Remove all protection from the page (including groups whose root element
 * was detached from the document, so no listeners or timers leak).
 */
export function unprotectAll(): void {
  for (const group of Array.from(groups.values())) {
    group.owners.forEach((owner) => {
      owner.removeAttribute(PROTECTED_ATTR);
      owner.removeAttribute(REVEALED_ATTR);
      ownerToGroup.delete(owner);
    });
    teardownGroup(group);
  }
  groups.clear();

  // Sweep any stray attributes (e.g. written by an older code path).
  document.querySelectorAll(`[${PROTECTED_ATTR}]`).forEach((el) => {
    el.removeAttribute(PROTECTED_ATTR);
    el.removeAttribute(REVEALED_ATTR);
    el.removeAttribute(MODE_ATTR);
    el.removeAttribute(DUR_ATTR);
  });
  document.querySelectorAll(`[${REVEALED_ATTR}]`).forEach((el) => el.removeAttribute(REVEALED_ATTR));
  document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) => el.removeAttribute(HIDDEN_ATTR));
}

/**
 * Drop groups whose root is no longer in the document (content the site
 * discarded). Prevents listeners and map entries from accumulating on
 * highly dynamic pages.
 */
export function pruneDisconnectedGroups(): void {
  for (const group of Array.from(groups.values())) {
    if (!group.root.isConnected) {
      // Owners normally leave with the detached subtree; if the site
      // reparented one out of the group, unprotect it so it cannot get
      // stuck blurred without a reveal listener.
      group.owners.forEach((owner) => {
        ownerToGroup.delete(owner);
        owner.removeAttribute(PROTECTED_ATTR);
        owner.removeAttribute(REVEALED_ATTR);
      });
      teardownGroup(group);
      groups.delete(group.root);
    }
  }
}

function teardownGroup(group: RevealGroup): void {
  clearTimer(group.root);
  group.root.removeAttribute(REVEALED_ATTR);
  detachGroupListeners(group.root);
  group.root.removeAttribute(MODE_ATTR);
  group.root.removeAttribute(DUR_ATTR);
}

// ─── Reveal groups ───────────────────────────────────────────────────────────

function attachGroupListeners(group: RevealGroup): void {
  detachGroupListeners(group.root);

  group.root.setAttribute(MODE_ATTR, group.mode);
  group.root.setAttribute(DUR_ATTR, String(group.durationMs));

  switch (group.mode) {
    case 'hover':
      group.root.addEventListener('mouseenter', handleMouseEnter);
      group.root.addEventListener('mouseleave', handleMouseLeave);
      break;
    case 'click':
    case 'temporary':
      group.root.addEventListener('click', handleClick);
      break;
  }
}

function detachGroupListeners(root: Element): void {
  root.removeEventListener('mouseenter', handleMouseEnter);
  root.removeEventListener('mouseleave', handleMouseLeave);
  root.removeEventListener('click', handleClick);
}

// Named functions so removeEventListener works reliably. `this` is the group
// root at event time; group state is read from the registry.

function handleMouseEnter(this: Element): void {
  revealGroup(this);
}

function handleMouseLeave(this: Element): void {
  unrevealGroup(this);
}

function handleClick(this: Element, ev: Event): void {
  const group = groups.get(this);
  if (!group) return;

  ev.stopPropagation();

  if (group.mode === 'click') {
    if (this.hasAttribute(REVEALED_ATTR)) {
      unrevealGroup(this);
    } else {
      revealGroup(this);
    }
  } else if (group.mode === 'temporary') {
    revealGroup(this);
    scheduleHide(this, group.durationMs);
  }
}

/** Reveal every protected part of a group together. */
function revealGroup(root: Element): void {
  root.setAttribute(REVEALED_ATTR, '');
  groups.get(root)?.owners.forEach((owner) => owner.setAttribute(REVEALED_ATTR, ''));
}

/** Re-blur every protected part of a group together. */
function unrevealGroup(root: Element): void {
  root.removeAttribute(REVEALED_ATTR);
  groups.get(root)?.owners.forEach((owner) => owner.removeAttribute(REVEALED_ATTR));
  clearTimer(root);
}

function scheduleHide(root: Element, durationMs: number): void {
  clearTimer(root);
  const timer = setTimeout(() => {
    root.removeAttribute(REVEALED_ATTR);
    groups.get(root)?.owners.forEach((owner) => owner.removeAttribute(REVEALED_ATTR));
    revealTimers.delete(root);
  }, durationMs);
  revealTimers.set(root, timer);
}

function clearTimer(root: Element): void {
  const timer = revealTimers.get(root);
  if (timer) {
    clearTimeout(timer);
    revealTimers.delete(root);
  }
}

/**
 * Update reveal settings on all active groups (called when settings change
 * without tearing down protection). In-flight reveals are dropped so state
 * always matches the new mode.
 */
export function updateRevealMode(settings: PrivacySettings): void {
  for (const group of groups.values()) {
    group.mode = settings.revealMode;
    group.durationMs = settings.temporaryRevealDurationMs;
    unrevealGroup(group.root);
    attachGroupListeners(group);
  }
}

/** Number of active reveal groups (introspection for tests/debugging). */
export function activeGroupCount(): number {
  return groups.size;
}

// ─── Hide (visibility) ───────────────────────────────────────────────────────

/**
 * Hide an element (visibility: hidden) without removing it from the layout.
 */
export function hideElement(el: Element): void {
  el.setAttribute(HIDDEN_ATTR, '');
}

export function unhideElement(el: Element): void {
  el.removeAttribute(HIDDEN_ATTR);
}

/**
 * Clear all temporary timers (called on unload).
 */
export function clearAllTimers(): void {
  revealTimers.forEach((timer) => clearTimeout(timer));
  revealTimers.clear();
}
