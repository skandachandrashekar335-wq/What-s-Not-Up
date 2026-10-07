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
 */

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
   * Only matches known WhatsApp avatar patterns; avoids matching arbitrary
   * images elsewhere on the page.
   */
  profilePhoto: [
    '[data-testid="default-user"]',
    '[data-testid="avatar"]',
    'img[src*="pps.whatsapp.net"]',       // CDN profile photo URL
    'img[src*="static.whatsapp.net"]',
    'img[alt="Profile photo"]',
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
 * Try each selector in order and return all matching elements.
 * Unknown elements produce an empty array — they are never thrown.
 */
export function queryAll(selectors: readonly string[], root: Document | Element = document): Element[] {
  for (const sel of selectors) {
    try {
      const nodes = root.querySelectorAll(sel);
      if (nodes.length > 0) return Array.from(nodes);
    } catch {
      // Malformed selector — skip silently
    }
  }
  return [];
}

/**
 * Return the first matching element or null.
 */
export function queryOne(selectors: readonly string[], root: Document | Element = document): Element | null {
  for (const sel of selectors) {
    try {
      const node = root.querySelector(sel);
      if (node) return node;
    } catch {
      // Malformed selector — skip silently
    }
  }
  return null;
}
