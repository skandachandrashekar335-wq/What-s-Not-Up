import { PrivacySettings, DEFAULT_SETTINGS } from './types';

/**
 * Storage key used for the settings object.
 * Exported so the content script can subscribe to `chrome.storage.onChanged`
 * for exactly this key (the primary settings-propagation mechanism).
 */
export const STORAGE_KEY = 'wnu_settings';

/**
 * Load settings from chrome.storage.local.
 * Merges stored values over defaults so new fields are always populated.
 */
export async function loadSettings(): Promise<PrivacySettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[WNU] storage read error:', chrome.runtime.lastError.message);
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      const stored = result[STORAGE_KEY] as Partial<PrivacySettings> | undefined;
      resolve({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
    });
  });
}

/**
 * Persist settings to chrome.storage.local.
 */
export async function saveSettings(settings: PrivacySettings): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Partially update settings (merge patch).
 */
export async function patchSettings(patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
  const current = await loadSettings();
  const updated = { ...current, ...patch };
  await saveSettings(updated);
  return updated;
}

/**
 * Reset all settings to defaults.
 */
export async function resetSettings(): Promise<PrivacySettings> {
  await saveSettings({ ...DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS };
}
