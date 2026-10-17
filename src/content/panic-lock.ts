/**
 * Panic Lock Engine
 *
 * Provides a first-class "Panic Lock" that immediately protects every enabled
 * category and prevents any reveal from showing content while locked.
 *
 * ─── Architecture ───────────────────────────────────────────────────────────
 * The lock is a STATE flag that overlays the normal privacy engine:
 *
 *   unlocked + privacy on  → normal category-based blur, reveal allowed
 *   locked                 → all enabled categories forced-protected, reveal
 *                            blocked, new content immediately protected
 *
 * The lock is SEPARATE from the overlay (showOverlay/hideOverlay): the overlay
 * is a cosmetic full-screen cover; the lock is a content-protection guarantee.
 * Both can be active at the same time (lock → also apply overlay), but they
 * are independently controllable.
 *
 * ─── Shortcut handling ──────────────────────────────────────────────────────
 * Keyboard shortcuts are handled in-page (content script keydown listener).
 * This is by design: the MV3 commands API only supports a fixed set of
 * registered shortcuts defined at build time in manifest.json — it cannot be
 * dynamically reconfigured from settings. User-configurable shortcuts must
 * therefore be processed in-page.
 *
 * Limitation: in-page handlers only fire when the page is focused and the
 * compositor sees the keydown before the browser consumes it. Shortcuts that
 * conflict with browser or OS reservations may not fire. The popup always
 * provides an unlock button as the guaranteed recovery path.
 *
 * ─── Reveal interception ────────────────────────────────────────────────────
 * While locked, the lock engine patches the privacy engine's reveal handlers
 * by forcing `data-wnu-lock` on every protected element. The CSS rule for
 * [data-wnu-lock] overrides [data-wnu-revealed] with full blur, so a user
 * hovering or clicking a protected element cannot see through the lock.
 *
 * ─── Recovery ───────────────────────────────────────────────────────────────
 * The popup always shows a visible "Unlock" button when locked, regardless of
 * shortcut availability. The user can never be locked out permanently.
 *
 * ─── Privacy note ───────────────────────────────────────────────────────────
 * Panic Lock is a visual privacy convenience. It does not encrypt content,
 * prevent screenshots, or protect against malicious extensions, developer
 * tools, or someone with physical access to an unlocked device.
 */

import { PrivacySettings, ShortcutDescriptor } from '../shared/types';
import { patchSettings } from '../shared/storage';

export const LOCK_ATTR = 'data-wnu-lock';
const LOCK_STYLE_ID = 'wnu-lock-styles';

// ─── State ──────────────────────────────────────────────────────────────────

let _locked = false;
let _onLockChange: ((locked: boolean) => void) | null = null;

/** True when the page is currently in the panic-locked state. */
export function isPanicLocked(): boolean {
  return _locked;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function injectLockStyles(): void {
  if (document.getElementById(LOCK_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LOCK_STYLE_ID;
  // Override reveal regardless of [data-wnu-revealed] while locked.
  // The specificity is intentionally higher than the privacy-engine styles.
  style.textContent = `
    [${LOCK_ATTR}][data-wnu-protected] {
      filter: blur(var(--wnu-blur, 8px)) !important;
      user-select: none !important;
      pointer-events: none !important;
      cursor: default !important;
    }
    [${LOCK_ATTR}][data-wnu-protected][data-wnu-revealed] {
      filter: blur(var(--wnu-blur, 8px)) !important;
      user-select: none !important;
    }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}

function removeLockStyles(): void {
  document.getElementById(LOCK_STYLE_ID)?.remove();
}

// ─── Lock/unlock ─────────────────────────────────────────────────────────────

/**
 * Apply the lock attribute to all currently protected elements and newly
 * inserted ones. Also injects override CSS that prevents reveal.
 */
function applyLockAttribute(): void {
  document.querySelectorAll('[data-wnu-protected]').forEach((el) => {
    el.setAttribute(LOCK_ATTR, '');
  });
}

function removeLockAttribute(): void {
  document.querySelectorAll(`[${LOCK_ATTR}]`).forEach((el) => {
    el.removeAttribute(LOCK_ATTR);
  });
}

/**
 * Enter the locked state.
 *
 * - Injects lock CSS (reveal-blocking).
 * - Stamps [data-wnu-lock] on every currently protected element.
 * - Persists the locked state to storage so the popup reflects it.
 */
export function applyPanicLock(_settings: PrivacySettings): void {
  _locked = true;
  injectLockStyles();
  applyLockAttribute();
  _onLockChange?.(true);
  // Persist to storage so popup reflects the real state.
  patchSettings({ panicLocked: true }).catch(() => {});
}

/**
 * Leave the locked state.
 *
 * - Removes lock CSS.
 * - Removes [data-wnu-lock] stamps.
 * - Persists the unlocked state.
 */
export function releasePanicLock(): void {
  _locked = false;
  removeLockAttribute();
  removeLockStyles();
  _onLockChange?.(false);
  patchSettings({ panicLocked: false }).catch(() => {});
}

/**
 * Toggle lock state (for same-shortcut mode).
 */
export function togglePanicLock(settings: PrivacySettings): void {
  if (_locked) {
    releasePanicLock();
  } else {
    applyPanicLock(settings);
  }
}

/**
 * Called by the MutationObserver after new nodes are processed: stamp any
 * newly protected elements so the lock remains effective for dynamic content.
 */
export function stampNewLockedElements(): void {
  if (!_locked) return;
  document.querySelectorAll('[data-wnu-protected]:not([data-wnu-lock])').forEach((el) => {
    el.setAttribute(LOCK_ATTR, '');
  });
}

/**
 * Register a callback to be notified when the lock state changes.
 * (Used by the content script to update the popup-visible state.)
 */
export function onLockChange(cb: (locked: boolean) => void): void {
  _onLockChange = cb;
}

// ─── Shortcut matching ───────────────────────────────────────────────────────

/**
 * True when a KeyboardEvent matches a shortcut descriptor.
 *
 * On macOS, Meta (Command) is treated as equivalent to Ctrl for shortcuts
 * that specify ctrlKey, to support ⌘+Shift+L style.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDescriptor): boolean {
  if (!shortcut.key) return false;
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;

  // On macOS allow Cmd in place of Ctrl.
  const ctrlPressed = event.ctrlKey || (isMac() && event.metaKey && shortcut.ctrlKey);
  if ((shortcut.ctrlKey || shortcut.metaKey) && !ctrlPressed && !event.metaKey) return false;
  if (shortcut.altKey !== event.altKey) return false;
  if (shortcut.shiftKey !== event.shiftKey) return false;
  return true;
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '');
}

/**
 * Describe a shortcut in human-readable form for display.
 */
export function shortcutLabel(s: ShortcutDescriptor): string {
  const parts: string[] = [];
  if (s.ctrlKey || s.metaKey) parts.push(isMac() ? '⌘' : 'Ctrl');
  if (s.altKey) parts.push(isMac() ? '⌥' : 'Alt');
  if (s.shiftKey) parts.push('Shift');
  parts.push(s.key.toUpperCase());
  return parts.join('+');
}

// ─── Shortcut validation ─────────────────────────────────────────────────────

/**
 * Browser-reserved or dangerous combinations that the extension should not
 * claim. This list is advisory: the in-page handler registers unconditionally,
 * but validation warns the user about likely conflicts.
 */
const RESERVED_COMBOS: Array<{ ctrl?: boolean; alt?: boolean; shift?: boolean; key: string }> = [
  // Chrome DevTools (require Ctrl+Shift)
  { ctrl: true, shift: true, key: 'j' },
  { ctrl: true, shift: true, key: 'i' },
  // Chrome address bar / new tab (no Shift)
  { ctrl: true, shift: false, key: 'l' },
  { ctrl: true, shift: false, key: 't' },
  { ctrl: true, shift: false, key: 'n' },
  { ctrl: true, shift: false, key: 'w' },
  // Print / find / save (no Shift)
  { ctrl: true, shift: false, key: 'p' },
  { ctrl: true, shift: false, key: 'f' },
  { ctrl: true, shift: false, key: 's' },
];

export type ShortcutValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateShortcut(s: ShortcutDescriptor): ShortcutValidationResult {
  if (!s.key) return { valid: false, reason: 'No key selected.' };
  const isModified = s.ctrlKey || s.metaKey || s.altKey || s.shiftKey;
  if (!isModified) {
    return { valid: false, reason: 'Shortcuts must include at least one modifier key (Ctrl, Alt, or Shift).' };
  }
  for (const r of RESERVED_COMBOS) {
    if (
      s.key.toLowerCase() === r.key &&
      (r.ctrl === undefined || (r.ctrl === s.ctrlKey)) &&
      (r.alt === undefined || (r.alt === s.altKey)) &&
      (r.shift === undefined || (r.shift === s.shiftKey))
    ) {
      return {
        valid: false,
        reason: `${shortcutLabel(s)} conflicts with a common browser shortcut and may not work reliably.`,
      };
    }
  }
  return { valid: true };
}

export function shortcutsConflict(a: ShortcutDescriptor, b: ShortcutDescriptor): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    a.ctrlKey === b.ctrlKey &&
    a.metaKey === b.metaKey &&
    a.altKey === b.altKey &&
    a.shiftKey === b.shiftKey
  );
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function cleanupPanicLock(): void {
  _locked = false;
  _onLockChange = null;
  removeLockAttribute();
  removeLockStyles();
}
