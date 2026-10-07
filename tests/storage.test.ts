/**
 * Tests for src/shared/storage.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetStorage, chromeMock } from './setup';
import { loadSettings, saveSettings, patchSettings, resetSettings } from '../src/shared/storage';
import { DEFAULT_SETTINGS, PrivacySettings } from '../src/shared/types';

beforeEach(() => {
  resetStorage();
  chromeMock.runtime.lastError = null;
});

describe('loadSettings', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored values over defaults', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, privacyEnabled: true, blurIntensity: 15 });
    const settings = await loadSettings();
    expect(settings.privacyEnabled).toBe(true);
    expect(settings.blurIntensity).toBe(15);
  });

  it('fills in missing keys from defaults (schema migration)', async () => {
    // Simulate stored object missing a newer field
    const partial = { privacyEnabled: true } as Partial<PrivacySettings>;
    chromeMock.storage.local.get.mockImplementationOnce(
      (_key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({ wnu_settings: partial });
      },
    );
    const settings = await loadSettings();
    // Fields not in the partial come from defaults
    expect(settings.blurMessages).toBe(DEFAULT_SETTINGS.blurMessages);
    expect(settings.revealMode).toBe(DEFAULT_SETTINGS.revealMode);
  });

  it('handles chrome.runtime.lastError gracefully', async () => {
    chromeMock.runtime.lastError = { message: 'Storage read error' };
    chromeMock.storage.local.get.mockImplementationOnce(
      (_key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({});
      },
    );
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  it('persists settings and can be read back', async () => {
    const toSave = { ...DEFAULT_SETTINGS, privacyEnabled: true, blurIntensity: 12 };
    await saveSettings(toSave);
    const loaded = await loadSettings();
    expect(loaded.privacyEnabled).toBe(true);
    expect(loaded.blurIntensity).toBe(12);
  });

  it('rejects when chrome.runtime.lastError is set on write', async () => {
    chromeMock.storage.local.set.mockImplementationOnce(
      (_items: unknown, cb?: () => void) => {
        chromeMock.runtime.lastError = { message: 'Quota exceeded' };
        cb?.();
        chromeMock.runtime.lastError = null;
      },
    );
    await expect(saveSettings(DEFAULT_SETTINGS)).rejects.toThrow('Quota exceeded');
  });
});

describe('patchSettings', () => {
  it('merges a partial update without losing other fields', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, privacyEnabled: false, blurIntensity: 5 });
    const updated = await patchSettings({ privacyEnabled: true });
    expect(updated.privacyEnabled).toBe(true);
    expect(updated.blurIntensity).toBe(5); // unchanged
  });

  it('returns the merged result', async () => {
    const result = await patchSettings({ revealMode: 'click' });
    expect(result.revealMode).toBe('click');
  });
});

describe('resetSettings', () => {
  it('restores defaults after changes', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, privacyEnabled: true, blurIntensity: 20 });
    const reset = await resetSettings();
    expect(reset).toEqual(DEFAULT_SETTINGS);
    const loaded = await loadSettings();
    expect(loaded).toEqual(DEFAULT_SETTINGS);
  });
});
