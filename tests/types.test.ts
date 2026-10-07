/**
 * Tests for src/shared/types.ts — verify DEFAULT_SETTINGS shape and values.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/types';

describe('DEFAULT_SETTINGS', () => {
  it('has privacyEnabled off by default', () => {
    expect(DEFAULT_SETTINGS.privacyEnabled).toBe(false);
  });

  it('has all content protection toggles on by default', () => {
    expect(DEFAULT_SETTINGS.blurMessages).toBe(true);
    expect(DEFAULT_SETTINGS.blurContactNames).toBe(true);
    expect(DEFAULT_SETTINGS.blurProfilePhotos).toBe(true);
    expect(DEFAULT_SETTINGS.blurImages).toBe(true);
    expect(DEFAULT_SETTINGS.blurVideos).toBe(true);
    expect(DEFAULT_SETTINGS.blurGifsStickers).toBe(true);
    expect(DEFAULT_SETTINGS.blurDocumentPreviews).toBe(true);
    expect(DEFAULT_SETTINGS.blurLinkPreviews).toBe(true);
    expect(DEFAULT_SETTINGS.blurChatListPreviews).toBe(true);
    expect(DEFAULT_SETTINGS.blurChatHeader).toBe(true);
  });

  it('has online/typing hiding on by default', () => {
    expect(DEFAULT_SETTINGS.hideOnlineStatus).toBe(true);
    expect(DEFAULT_SETTINGS.hideTypingIndicator).toBe(true);
    expect(DEFAULT_SETTINGS.hideLastSeen).toBe(true);
  });

  it('defaults to hover reveal mode', () => {
    expect(DEFAULT_SETTINGS.revealMode).toBe('hover');
  });

  it('has a sensible blur intensity', () => {
    expect(DEFAULT_SETTINGS.blurIntensity).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.blurIntensity).toBeLessThanOrEqual(40);
  });

  it('has a sensible temporary reveal duration', () => {
    expect(DEFAULT_SETTINGS.temporaryRevealDurationMs).toBeGreaterThan(0);
  });

  it('has focus-loss blur off by default', () => {
    expect(DEFAULT_SETTINGS.blurOnFocusLoss).toBe(false);
  });

  it('has onboarding incomplete by default', () => {
    expect(DEFAULT_SETTINGS.onboardingComplete).toBe(false);
  });

  it('has system theme by default', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system');
  });
});
