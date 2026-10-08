/**
 * Background Service Worker — What's Not Up
 *
 * Responsibilities:
 * - Open onboarding on first install
 * - Relay messages between popup and content script
 * - Handle command shortcuts registered in manifest
 */

import { loadSettings, patchSettings } from '../shared/storage';
import { ExtensionMessage } from '../shared/types';
import { siteIdForUrl } from '../content/sites/detect';

// ─── Install / update lifecycle ──────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const settings = await loadSettings();
    if (!settings.onboardingComplete) {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
    }
  }
});

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage & { type: string }, _sender, sendResponse) => {
  if (message.type === 'OPEN_ONBOARDING') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
    sendResponse({});
    return true;
  }

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }

  return false;
});

// ─── Action click (toolbar icon) ─────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  // Popup handles everything; this fires only when no popup is set.
  // Kept as a fallback.
  if (!tab.url || !siteIdForUrl(tab.url)) return;

  const settings = await loadSettings();
  const newEnabled = !settings.privacyEnabled;
  await patchSettings({ privacyEnabled: newEnabled });

  if (tab.id !== undefined) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SET_PRIVACY_ENABLED',
      enabled: newEnabled,
    } satisfies ExtensionMessage).catch(() => {
      // Tab may not have content script — ignore
    });
  }
});
