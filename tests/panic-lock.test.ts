/**
 * Panic Lock tests.
 *
 * Covers:
 *  - applyPanicLock / releasePanicLock / togglePanicLock state transitions
 *  - Lock attribute stamping on protected elements
 *  - CSS injection/removal
 *  - stampNewLockedElements for dynamic content
 *  - matchesShortcut matching and modifier handling
 *  - shortcutLabel display
 *  - validateShortcut — valid, no modifier, reserved combos
 *  - shortcutsConflict
 *  - cleanupPanicLock
 *  - onLockChange callback
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_SETTINGS, ShortcutDescriptor } from '../src/shared/types';
import {
  applyPanicLock,
  releasePanicLock,
  togglePanicLock,
  stampNewLockedElements,
  isPanicLocked,
  matchesShortcut,
  shortcutLabel,
  validateShortcut,
  shortcutsConflict,
  cleanupPanicLock,
  onLockChange,
  LOCK_ATTR,
} from '../src/content/panic-lock';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeProtectedEl(doc: Document): HTMLElement {
  const el = doc.createElement('div');
  el.setAttribute('data-wnu-protected', '');
  doc.body.appendChild(el);
  return el;
}

function makeShortcut(overrides: Partial<ShortcutDescriptor> = {}): ShortcutDescriptor {
  return {
    key: 'l',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: true,
    ...overrides,
  };
}

function makeKeyboardEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: 'l',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  } as KeyboardEvent;
}

// Mock patchSettings so we don't need chrome storage.
vi.mock('../src/shared/storage', () => ({
  patchSettings: vi.fn().mockResolvedValue({}),
  loadSettings: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  resetSettings: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS }),
  STORAGE_KEY: 'wnu_settings',
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset between tests.
  cleanupPanicLock();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

afterEach(() => {
  cleanupPanicLock();
});

// ─── State transitions ────────────────────────────────────────────────────────

describe('isPanicLocked', () => {
  it('is false initially', () => {
    expect(isPanicLocked()).toBe(false);
  });

  it('is true after applyPanicLock', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    expect(isPanicLocked()).toBe(true);
  });

  it('is false after releasePanicLock', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    releasePanicLock();
    expect(isPanicLocked()).toBe(false);
  });
});

describe('togglePanicLock', () => {
  it('locks when unlocked', () => {
    togglePanicLock(DEFAULT_SETTINGS);
    expect(isPanicLocked()).toBe(true);
  });

  it('unlocks when locked', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    togglePanicLock(DEFAULT_SETTINGS);
    expect(isPanicLocked()).toBe(false);
  });

  it('alternates correctly on repeated calls', () => {
    togglePanicLock(DEFAULT_SETTINGS);
    expect(isPanicLocked()).toBe(true);
    togglePanicLock(DEFAULT_SETTINGS);
    expect(isPanicLocked()).toBe(false);
    togglePanicLock(DEFAULT_SETTINGS);
    expect(isPanicLocked()).toBe(true);
  });
});

// ─── LOCK_ATTR stamping ───────────────────────────────────────────────────────

describe('applyPanicLock — attribute stamping', () => {
  it('stamps LOCK_ATTR on currently protected elements', () => {
    const el = makeProtectedEl(document);
    applyPanicLock(DEFAULT_SETTINGS);
    expect(el.hasAttribute(LOCK_ATTR)).toBe(true);
  });

  it('does not stamp non-protected elements', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    applyPanicLock(DEFAULT_SETTINGS);
    expect(el.hasAttribute(LOCK_ATTR)).toBe(false);
  });
});

describe('releasePanicLock — attribute removal', () => {
  it('removes LOCK_ATTR from all elements', () => {
    const el = makeProtectedEl(document);
    applyPanicLock(DEFAULT_SETTINGS);
    expect(el.hasAttribute(LOCK_ATTR)).toBe(true);
    releasePanicLock();
    expect(el.hasAttribute(LOCK_ATTR)).toBe(false);
  });
});

// ─── CSS injection ────────────────────────────────────────────────────────────

describe('lock styles', () => {
  it('injects a <style> tag when locked', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    expect(document.getElementById('wnu-lock-styles')).not.toBeNull();
  });

  it('removes the <style> tag when unlocked', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    releasePanicLock();
    expect(document.getElementById('wnu-lock-styles')).toBeNull();
  });

  it('does not inject duplicate <style> tags', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    applyPanicLock(DEFAULT_SETTINGS);
    const count = document.querySelectorAll('#wnu-lock-styles').length;
    expect(count).toBe(1);
  });
});

// ─── stampNewLockedElements ───────────────────────────────────────────────────

describe('stampNewLockedElements', () => {
  it('does nothing when not locked', () => {
    const el = makeProtectedEl(document);
    stampNewLockedElements();
    expect(el.hasAttribute(LOCK_ATTR)).toBe(false);
  });

  it('stamps newly added protected elements while locked', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    // Add a new protected element after the lock was applied.
    const el = document.createElement('div');
    el.setAttribute('data-wnu-protected', '');
    document.body.appendChild(el);
    stampNewLockedElements();
    expect(el.hasAttribute(LOCK_ATTR)).toBe(true);
  });

  it('does not re-stamp elements that already have LOCK_ATTR', () => {
    const el = makeProtectedEl(document);
    applyPanicLock(DEFAULT_SETTINGS);
    // el should have LOCK_ATTR from applyPanicLock; stamp again to confirm idempotent.
    stampNewLockedElements();
    expect(el.hasAttribute(LOCK_ATTR)).toBe(true);
  });
});

// ─── onLockChange callback ────────────────────────────────────────────────────

describe('onLockChange', () => {
  it('fires with true when locked', () => {
    const cb = vi.fn();
    onLockChange(cb);
    applyPanicLock(DEFAULT_SETTINGS);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('fires with false when unlocked', () => {
    const cb = vi.fn();
    onLockChange(cb);
    applyPanicLock(DEFAULT_SETTINGS);
    releasePanicLock();
    expect(cb).toHaveBeenLastCalledWith(false);
  });
});

// ─── matchesShortcut ─────────────────────────────────────────────────────────

describe('matchesShortcut', () => {
  it('matches an exact Ctrl+Shift+L', () => {
    const shortcut = makeShortcut({ key: 'l', ctrlKey: true, shiftKey: true });
    const event = makeKeyboardEvent({ key: 'l', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(event, shortcut)).toBe(true);
  });

  it('does not match when key differs', () => {
    const shortcut = makeShortcut({ key: 'l', ctrlKey: true, shiftKey: true });
    const event = makeKeyboardEvent({ key: 'k', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(event, shortcut)).toBe(false);
  });

  it('does not match when modifier missing', () => {
    const shortcut = makeShortcut({ key: 'l', ctrlKey: true, shiftKey: true });
    const event = makeKeyboardEvent({ key: 'l', ctrlKey: false, shiftKey: true });
    expect(matchesShortcut(event, shortcut)).toBe(false);
  });

  it('is case-insensitive for the key', () => {
    const shortcut = makeShortcut({ key: 'L', ctrlKey: true, shiftKey: true });
    const event = makeKeyboardEvent({ key: 'l', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(event, shortcut)).toBe(true);
  });

  it('returns false when key is empty', () => {
    const shortcut = makeShortcut({ key: '', ctrlKey: true });
    const event = makeKeyboardEvent({ key: '' });
    expect(matchesShortcut(event, shortcut)).toBe(false);
  });
});

// ─── shortcutLabel ───────────────────────────────────────────────────────────

describe('shortcutLabel', () => {
  it('formats Ctrl+Shift+L on non-Mac', () => {
    // Navigator is not set in jsdom to macOS platform by default.
    const label = shortcutLabel(makeShortcut({ key: 'l', ctrlKey: true, shiftKey: true }));
    // Should contain Ctrl and Shift and L in some form.
    expect(label.toLowerCase()).toMatch(/ctrl|⌘/);
    expect(label).toMatch(/Shift|shift/i);
    expect(label).toMatch(/L/i);
  });

  it('includes Alt when altKey is set', () => {
    const label = shortcutLabel(makeShortcut({ key: 'l', ctrlKey: false, altKey: true }));
    expect(label.toLowerCase()).toMatch(/alt|⌥/);
  });
});

// ─── validateShortcut ────────────────────────────────────────────────────────

describe('validateShortcut', () => {
  it('accepts a valid combination', () => {
    const result = validateShortcut(makeShortcut({ key: 'l', ctrlKey: true, shiftKey: true }));
    expect(result.valid).toBe(true);
  });

  it('rejects an empty key', () => {
    const result = validateShortcut(makeShortcut({ key: '' }));
    expect(result.valid).toBe(false);
  });

  it('rejects a bare letter with no modifier', () => {
    const result = validateShortcut({ key: 'l', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/modifier/i);
  });

  it('rejects a known reserved combination (Ctrl+F)', () => {
    const result = validateShortcut({ key: 'f', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/conflict|reserved|browser/i);
  });

  it('accepts a non-conflicting combination (Ctrl+Alt+K)', () => {
    const result = validateShortcut({ key: 'k', ctrlKey: true, metaKey: false, altKey: true, shiftKey: false });
    expect(result.valid).toBe(true);
  });
});

// ─── shortcutsConflict ────────────────────────────────────────────────────────

describe('shortcutsConflict', () => {
  it('returns true for identical descriptors', () => {
    const s = makeShortcut();
    expect(shortcutsConflict(s, { ...s })).toBe(true);
  });

  it('returns false for different keys', () => {
    const a = makeShortcut({ key: 'l' });
    const b = makeShortcut({ key: 'u' });
    expect(shortcutsConflict(a, b)).toBe(false);
  });

  it('returns false when modifiers differ', () => {
    const a = makeShortcut({ key: 'l', ctrlKey: true, shiftKey: false });
    const b = makeShortcut({ key: 'l', ctrlKey: true, shiftKey: true });
    expect(shortcutsConflict(a, b)).toBe(false);
  });
});

// ─── cleanupPanicLock ────────────────────────────────────────────────────────

describe('cleanupPanicLock', () => {
  it('sets locked to false', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    cleanupPanicLock();
    expect(isPanicLocked()).toBe(false);
  });

  it('removes the lock attribute', () => {
    const el = makeProtectedEl(document);
    applyPanicLock(DEFAULT_SETTINGS);
    cleanupPanicLock();
    expect(el.hasAttribute(LOCK_ATTR)).toBe(false);
  });

  it('removes the lock styles', () => {
    applyPanicLock(DEFAULT_SETTINGS);
    cleanupPanicLock();
    expect(document.getElementById('wnu-lock-styles')).toBeNull();
  });
});
