/**
 * Content Script — What's Not Up
 *
 * Entry point injected into:
 *   - https://web.whatsapp.com/*
 *   - https://www.instagram.com/*
 *
 * Responsibilities:
 * - Detect the site adapter for the current hostname (unknown sites: do nothing)
 * - Load settings from storage and apply protections to the current DOM
 * - Watch DOM mutations for new content
 * - React to settings changes via chrome.storage.onChanged (no page reload)
 * - Handle keyboard shortcut (Ctrl/Cmd+Shift+P) and focus/blur events
 * - Handle messages from popup/background (kept as a redundant, deduped path)
 */

import { loadSettings, STORAGE_KEY } from '../shared/storage';
import { DEFAULT_SETTINGS, PrivacySettings, ExtensionMessage } from '../shared/types';
import { injectStyles, removeStyles, clearAllTimers, updateRevealMode } from './privacy-engine';
import { applyProtections, removeProtections, processNewNodes } from './dom-processor';
import { showOverlay, hideOverlay, isOverlayVisible } from './overlay';
import { detectAdapter } from './sites/detect';
import { SiteAdapter } from './sites/types';

let adapter: SiteAdapter | null = null;
let currentSettings: PrivacySettings | null = null;
let observer: MutationObserver | null = null;
let focusListenerAttached = false;
let keyListenerAttached = false;
let storageListenerAttached = false;

// Coalesced settings application: multiple updates within the same tick
// (storage event + popup message, rapid toggles) produce exactly one re-scan.
let settingsApplyScheduled = false;
let settingsApplyCount = 0;

export interface ContentState {
  adapterId: string | null;
  settings: PrivacySettings | null;
  storageListenerAttached: boolean;
  observerActive: boolean;
  settingsApplyCount: number;
}

/** Introspection for tests/debugging. */
export function getContentState(): ContentState {
  return {
    adapterId: adapter?.id ?? null,
    settings: currentSettings,
    storageListenerAttached,
    observerActive: observer !== null,
    settingsApplyCount,
  };
}

// ─── Initialise ──────────────────────────────────────────────────────────────

export interface InitOptions {
  /** Overrides hostname detection (tests). */
  hostname?: string;
  /** Overrides adapter detection entirely (tests). `null` = unknown site. */
  adapter?: SiteAdapter | null;
}

export async function init(options: InitOptions = {}): Promise<void> {
  const hostname = options.hostname ?? location.hostname;
  const siteAdapter = options.adapter !== undefined ? options.adapter : detectAdapter(hostname);

  // Unknown website → do nothing: no styles, no observer, no listeners.
  if (!siteAdapter) return;
  adapter = siteAdapter;

  const settings = await loadSettings();
  currentSettings = settings;

  if (settings.privacyEnabled) {
    applySettingsToDOM(settings);
  }

  startMutationObserver();
  attachKeyboardShortcut();
  attachFocusListeners();
  attachStorageListener();

  // If onboarding not complete, open it on first load
  if (!settings.onboardingComplete) {
    chrome.runtime.sendMessage({ type: 'OPEN_ONBOARDING' }).catch(() => {
      // Background may not be awake yet — that's fine
    });
  }
}

// ─── Settings updates (no reload, no polling) ────────────────────────────────

/**
 * Primary settings path: chrome.storage.onChanged fires in EVERY open tab
 * of supported sites as soon as the popup/options page writes storage.
 * The direct SETTINGS_UPDATED message from the popup is kept as a redundant
 * path; identical payloads are deduplicated, so nothing is processed twice.
 */
export function attachStorageListener(): void {
  if (storageListenerAttached) return; // never register duplicate listeners
  storageListenerAttached = true;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const entry = changes[STORAGE_KEY];
    if (!entry || entry.newValue === undefined) return;

    const next: PrivacySettings = {
      ...DEFAULT_SETTINGS,
      ...(entry.newValue as Partial<PrivacySettings>),
    };
    handleSettingsUpdate(next);
  });
}

/**
 * Accept a new settings object and schedule a single DOM re-apply.
 * Equal payloads are ignored (dedupe between storage events and messages).
 */
export function handleSettingsUpdate(next: PrivacySettings): void {
  if (!adapter) return;
  if (currentSettings && settingsEqual(currentSettings, next)) return;

  currentSettings = next;
  if (settingsApplyScheduled) return; // a flush is already pending — it reads the latest state
  settingsApplyScheduled = true;
  queueMicrotask(() => {
    settingsApplyScheduled = false;
    flushSettingsApply();
  });
}

function flushSettingsApply(): void {
  if (!adapter || !currentSettings) return;
  settingsApplyCount++;
  applySettingsToDOM(currentSettings);
}

/**
 * Reprocess the ENTIRE existing DOM against the latest settings.
 *
 * A full reset (tear down → re-apply) is intentional: it is the only way to
 * safely re-evaluate which element owns each logical region when a category
 * is toggled, and it guarantees reveal state/listeners cannot go stale.
 * Runs only on user-initiated settings changes (coalesced to one per tick),
 * never per mutation.
 */
function applySettingsToDOM(settings: PrivacySettings): void {
  if (!adapter) return;

  if (!settings.privacyEnabled) {
    removeProtections();
    removeStyles();
    hideOverlay();
    return;
  }

  injectStyles(settings.blurIntensity); // idempotent — updates CSS in place
  removeProtections();                  // full teardown (groups, listeners, timers)
  applyProtections(settings, adapter);  // rebuild against latest settings
  updateRevealMode(settings);           // listeners match current reveal mode
}

function settingsEqual(a: PrivacySettings, b: PrivacySettings): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// ─── MutationObserver ────────────────────────────────────────────────────────

function startMutationObserver(): void {
  if (observer) return; // one observer only — never duplicate registrations

  observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    // WhatsApp lazy-loads avatars and populates media URLs *after* the
    // element exists, so a node that was invisible to the first scan becomes
    // identifiable only once `src` lands. Observing just this one attribute
    // covers lazy avatars and GIF/stickers whose media URL appears later —
    // without it, `data-wnu-*` writes cannot re-trigger the observer
    // (they are not `src`), so there is no loop.
    attributes: true,
    attributeFilter: ['src'],
  });
}

function handleMutations(mutations: MutationRecord[]): void {
  if (!currentSettings?.privacyEnabled) return;

  const touched: Node[] = [];
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      const target = mutation.target;
      if (target.nodeType === Node.ELEMENT_NODE) touched.push(target as Element);
    } else {
      mutation.addedNodes.forEach((n) => touched.push(n));
    }
  }
  if (touched.length === 0) return;

  // Batch rapid mutations into one frame to avoid layout thrashing.
  scheduleFrame(() => processAddedNodes(touched));
}

/** Process a batch of newly added nodes with the LATEST settings. */
export function processAddedNodes(added: Node[]): void {
  if (!adapter || !currentSettings?.privacyEnabled) return;

  const nodeList = {
    length: added.length,
    item: (i: number) => added[i] ?? null,
    forEach: (cb: (n: Node, i: number, nl: NodeList) => void) =>
      added.forEach((n, i) => cb(n, i, nodeList as NodeList)),
    [Symbol.iterator]: () => added[Symbol.iterator](),
  } as NodeList;

  processNewNodes(nodeList, currentSettings, adapter);
}

const scheduleFrame: (cb: () => void) => void =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16);

// ─── Keyboard shortcut ───────────────────────────────────────────────────────

function attachKeyboardShortcut(): void {
  if (keyListenerAttached) return;
  keyListenerAttached = true;

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (isOverlayVisible()) {
        hideOverlay();
      } else {
        showOverlay();
      }
    }
  });
}

// ─── Focus/blur ──────────────────────────────────────────────────────────────

function attachFocusListeners(): void {
  if (focusListenerAttached) return;
  focusListenerAttached = true;

  // Attached unconditionally so enabling "blur on focus loss" later takes
  // effect immediately — without a page reload. The handlers re-check the
  // live settings on every event.
  window.addEventListener('blur', () => {
    if (currentSettings?.blurOnFocusLoss && currentSettings?.privacyEnabled) {
      showOverlay();
    }
  });

  window.addEventListener('focus', () => {
    if (isOverlayVisible()) {
      hideOverlay();
    }
  });
}

// ─── Message listener (redundant path — deduplicated against storage) ────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ type: 'PONG' });
      break;

    case 'GET_PRIVACY_STATE':
      sendResponse({ type: 'PRIVACY_STATE', enabled: currentSettings?.privacyEnabled ?? false });
      break;

    case 'SET_PRIVACY_ENABLED':
      if (currentSettings) {
        handleSettingsUpdate({ ...currentSettings, privacyEnabled: message.enabled });
      }
      break;

    case 'SETTINGS_UPDATED':
      handleSettingsUpdate(message.settings);
      break;

    case 'QUICK_LOCK':
      showOverlay();
      break;
  }

  return true; // keep message channel open for async responses
});

// ─── Cleanup on unload ───────────────────────────────────────────────────────

window.addEventListener('unload', () => {
  observer?.disconnect();
  clearAllTimers();
  removeStyles();
});

// ─── Boot ────────────────────────────────────────────────────────────────────

init().catch((err) => {
  console.error('[WNU] Failed to initialise content script:', err);
});
