// All types shared across popup, options, content script and service worker

export type RevealMode = 'hover' | 'click' | 'temporary';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface PrivacySettings {
  // Master switch
  privacyEnabled: boolean;

  // Content protection toggles
  blurMessages: boolean;
  blurContactNames: boolean;
  blurProfilePhotos: boolean;
  blurImages: boolean;
  blurVideos: boolean;
  blurGifsStickers: boolean;
  blurDocumentPreviews: boolean;
  blurLinkPreviews: boolean;
  blurChatListPreviews: boolean;
  blurChatHeader: boolean;
  hideOnlineStatus: boolean;
  hideTypingIndicator: boolean;
  hideLastSeen: boolean;

  // Reveal behaviour
  revealMode: RevealMode;
  temporaryRevealDurationMs: number; // milliseconds

  // Blur intensity 0–100
  blurIntensity: number;

  // Quick privacy / focus behaviour
  blurOnFocusLoss: boolean;

  // Appearance
  theme: ThemeMode;

  // Onboarding
  onboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: PrivacySettings = {
  privacyEnabled: false,
  blurMessages: true,
  blurContactNames: true,
  blurProfilePhotos: true,
  blurImages: true,
  blurVideos: true,
  blurGifsStickers: true,
  blurDocumentPreviews: true,
  blurLinkPreviews: true,
  blurChatListPreviews: true,
  blurChatHeader: true,
  hideOnlineStatus: true,
  hideTypingIndicator: true,
  hideLastSeen: true,
  revealMode: 'hover',
  temporaryRevealDurationMs: 3000,
  blurIntensity: 8,
  blurOnFocusLoss: false,
  theme: 'system',
  onboardingComplete: false,
};

// Messages exchanged between popup/options and content script via chrome.runtime
export type ExtensionMessage =
  | { type: 'GET_PRIVACY_STATE' }
  | { type: 'PRIVACY_STATE'; enabled: boolean }
  | { type: 'SET_PRIVACY_ENABLED'; enabled: boolean }
  | { type: 'SETTINGS_UPDATED'; settings: PrivacySettings }
  | { type: 'QUICK_LOCK' }
  | { type: 'OPEN_ONBOARDING' }
  | { type: 'PING' }
  | { type: 'PONG' };
