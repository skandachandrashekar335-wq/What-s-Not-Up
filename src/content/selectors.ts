/**
 * WhatsApp Web DOM selectors — isolated from the privacy engine so they can be
 * updated independently when WhatsApp changes its markup.
 *
 * WhatsApp uses auto-generated class names that change regularly.
 * We use a combination of stable data attributes, ARIA roles and structural
 * patterns. Multiple fallback selectors are provided where possible.
 *
 * Design principles:
 * - Prefer stable data-testid attributes over auto-generated class names
 * - Use the most specific selector available to avoid false matches
 * - Never use overly broad selectors like [data-id] or bare `img`
 * - Unknown/unmatched elements are silently ignored by the engine
 *
 * NOTE: These selectors were accurate at time of writing (Oct 2024).
 * WhatsApp Web updates frequently; expect some selectors to drift.
 * Update this file first when a protection stops working after a WhatsApp update.
 * Add new selectors at the TOP of each array; keep old ones as fallbacks.
 *
 * This module is the WhatsApp site adapter's selector table. Generic
 * selector helpers live in ./query and are re-exported here for
 * backwards compatibility.
 */

export { queryAll, queryOne } from './query';

export const SELECTORS = {
  /**
   * The text content inside a message bubble.
   * Targeted at the text span, not the whole bubble container, to avoid
   * accidentally blurring UI chrome (buttons, timestamps, reactions).
   */
  messageText: [
    'span.selectable-text',
    '[data-testid="msg-container"] span.copyable-text',
    '.copyable-text',
  ],

  /**
   * Contact and group names in the chat list.
   * span[title][dir] matches the name spans WhatsApp renders with a title
   * attribute (the full name) and a dir attribute (text direction).
   * Scoped to the chat list pane by the DOM processor to avoid hitting
   * the header name twice.
   */
  chatListName: [
    '[data-testid="cell-frame-title"]',
    '#pane-side span[title][dir]',
    '#pane-side ._ao3e',                  // structural fallback (may change)
  ],

  /**
   * Last-message previews in the chat list.
   */
  chatListPreview: [
    '[data-testid="last-msg"]',
    '[data-testid="cell-frame-secondary"]',
  ],

  /**
   * Profile photos (avatar thumbnails).
   *
   * Additive set — matched with `union` so every path is evaluated (a
   * fallback chain would let one early hit suppress the rest).
   *
   * Only image-level and container-testid paths are listed here; rename-safe
   * detection (a wrapper that was renamed but still says "avatar" somewhere
   * in its testid/class/aria/CDN URL) lives in the structural resolver
   * (sites/whatsapp/avatar-resolver.ts), which returns the <img> itself and
   * therefore can never introduce a nested blur layer.
   */
  profilePhoto: [
    '[data-testid="default-user"]',
    '[data-testid="avatar"]',
    'img[src*="pps.whatsapp.net"]',       // CDN profile photo URL
    'img[src*="static.whatsapp.net"]',
    'img[alt="Profile photo"]',
    'img[alt*="profile photo" i]',        // localised / reworded alt fallback
    'img[alt*="profile picture" i]',
    '[data-testid="chatlist-avatar"] img',
    '[data-testid="conversation-header-avatar"] img',
  ],

  /**
   * Images in conversations (not profile photos).
   * Note: blob: URLs cannot be matched with a CSS attribute selector because
   * querySelectorAll does not support protocol-relative patterns. We match
   * by testid and structural location instead.
   */
  mediaImage: [
    '[data-testid="media-url-provider"] img',
    '[data-testid="image-thumb"]',
    '[data-testid="media-image"]',
  ],

  /**
   * Video thumbnails and players.
   * Scoped to known WhatsApp video containers to avoid matching unrelated videos.
   */
  mediaVideo: [
    '[data-testid="video-thumb"]',
    '[data-testid="media-video"]',
    '[data-testid="media-url-provider"] video',
  ],

  /**
   * GIF and sticker containers.
   *
   * Additive set → matched with `union`. These are the *stable* paths only;
   * rename-safe detection (testid contains "gif"/"sticker", aria/alt/class
   * tokens, CDN `src` paths, canvas stickers, looped-<video> GIFs) is done by
   * the structural classifier in sites/whatsapp/media-classifier.ts, which is
   * additionally scoped to the conversation surface and excludes pickers.
   */
  mediaGifSticker: [
    '[data-testid="gif"]',
    '[data-testid="sticker"]',
    '[data-animated="true"]',
  ],

  /**
   * Document preview panels.
   */
  documentPreview: [
    '[data-testid="document-thumb"]',
    '[data-testid="media-document"]',
  ],

  /**
   * Link previews attached to messages.
   */
  linkPreview: [
    '[data-testid="link-preview"]',
    '[data-testid="link-preview-thumbnail"]',
  ],

  /**
   * The chat header showing the active contact/group name.
   */
  chatHeader: [
    '[data-testid="conversation-header"]',
  ],

  chatHeaderName: [
    '[data-testid="conversation-info-header-chat-title"]',
    '[data-testid="conversation-header"] span[dir]',
  ],

  /**
   * Online / last-seen / typing status indicators.
   * Note: last-seen and online status share the same DOM area in WhatsApp.
   * Both are hidden when online status hiding is enabled.
   * They cannot be distinguished independently with current selectors.
   */
  onlineStatus: [
    '[data-testid="status"]',
    'span[data-testid="last-seen"]',
  ],

  typingIndicator: [
    '[data-testid="typing"]',
    '[data-testid="conversation-info-header-status"]',
  ],
} as const;

/**
 * The helpers below were moved to ./query; the re-exports at the top of this
 * file keep `import { queryAll } from './selectors'` working.
 */
