/**
 * Content Script — What's Not Up
 *
 * Entry point injected into https://web.whatsapp.com/*
 *
 * Responsibilities:
 * - Load settings from storage
 * - Apply privacy engine to current DOM
 * - Watch DOM mutations for new content
 * - Handle keyboard shortcut (Ctrl/Cmd+Shift+P)
 * - Handle focus/blur events if enabled
 * - Listen for messages from popup/background
 */

import { loadSettings } from '../shared/storage';
import { PrivacySettings, ExtensionMessage } from '../shared/types';
import { injectStyles, removeStyles, clearAllTimers, updateRevealMode } from './privacy-engine';
import { applyProtections, removeProtections, processNewNodes } from './dom-processor';
import { showOverlay, hideOverlay, isOverlayVisible } from './overlay';

let currentSettings: PrivacySettings | null = null;
let observer: MutationObserver | null = null;
let focusListenerAttached = false;

// ─── Initialise ──────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const settings = await loadSettings();
  currentSettings = settings;

  if (settings.privacyEnabled) {
    injectStyles(settings.blurIntensity);
    applyProtections(settings);
  }

  startMutationObserver();
  attachKeyboardShortcut();
  attachFocusListeners(settings);

  // If onboarding not complete, open it on first load
  if (!settings.onboardingComplete) {
    chrome.runtime.sendMessage({ type: 'OPEN_ONBOARDING' }).catch(() => {
      // Background may not be awake yet — that's fine
    });
  }
}

// ─── MutationObserver ────────────────────────────────────────────────────────

function startMutationObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    if (!currentSettings?.privacyEnabled) return;

    // Batch: collect all added nodes
    const addedNodes: Node[] = [];
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((n) => addedNodes.push(n));
    }

    if (addedNodes.length > 0) {
      // Use requestAnimationFrame to avoid thrashing during rapid updates
      requestAnimationFrame(() => {
        if (!currentSettings) return;
        const nodeList = {
          length: addedNodes.length,
          item: (i: number) => addedNodes[i] ?? null,
          forEach: (cb: (n: Node, i: number, nl: NodeList) => void) =>
            addedNodes.forEach((n, i) => cb(n, i, nodeList as NodeList)),
          [Symbol.iterator]: () => addedNodes[Symbol.iterator](),
        } as NodeList;
        processNewNodes(nodeList, currentSettings);
      });
    }
  });

  // Observe the whole document for subtree changes
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// ─── Keyboard shortcut ───────────────────────────────────────────────────────

function attachKeyboardShortcut(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      handleEmergencyShortcut();
    }
  });
}

function handleEmergencyShortcut(): void {
  if (isOverlayVisible()) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

// ─── Focus/blur ──────────────────────────────────────────────────────────────

function attachFocusListeners(settings: PrivacySettings): void {
  if (!settings.blurOnFocusLoss) return;
  if (focusListenerAttached) return;
  focusListenerAttached = true;

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

// ─── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ type: 'PONG' });
      break;

    case 'GET_PRIVACY_STATE':
      sendResponse({ type: 'PRIVACY_STATE', enabled: currentSettings?.privacyEnabled ?? false });
      break;

    case 'SET_PRIVACY_ENABLED': {
      if (!currentSettings) break;
      currentSettings = { ...currentSettings, privacyEnabled: message.enabled };
      if (message.enabled) {
        injectStyles(currentSettings.blurIntensity);
        applyProtections(currentSettings);
      } else {
        removeProtections();
        removeStyles();
        hideOverlay();
      }
      break;
    }

    case 'SETTINGS_UPDATED': {
      const prev = currentSettings;
      currentSettings = message.settings;

      if (!currentSettings.privacyEnabled) {
        removeProtections();
        removeStyles();
        hideOverlay();
        break;
      }

      // Update styles if intensity changed
      if (prev?.blurIntensity !== currentSettings.blurIntensity) {
        injectStyles(currentSettings.blurIntensity);
      }

      // Update reveal mode on existing elements if it changed
      if (prev?.revealMode !== currentSettings.revealMode ||
          prev?.temporaryRevealDurationMs !== currentSettings.temporaryRevealDurationMs) {
        updateRevealMode(currentSettings);
      }

      // Re-apply everything to pick up any toggled protections
      removeProtections();
      applyProtections(currentSettings);
      break;
    }

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
