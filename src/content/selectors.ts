/**
 * WhatsApp Web DOM selectors — isolated from the privacy engine so they can be
 * updated independently when WhatsApp changes its markup.
 *
 * WhatsApp uses auto-generated class names that change regularly.
 * We use a combination of stable data attributes, ARIA roles and structural
 * patterns. Multiple fallback selectors are provided where possible.
 *
 * NOTE: These selectors were accurate at time of writing (Oct 2024).
 * WhatsApp Web updates frequently; expect some selectors to drift.
 * Unknown elements are silently ignored.
 */

export const SELECTORS = {
  /**
   * Individual chat message bubbles in the conversation pane.
   * WhatsApp uses role="row" on message containers or data-id attributes.
   */
  messageBubble: [
    '[data-id]',                          // primary: stable data attribute
    '.message-in',                        // fallback class (may change)
    '.message-out',
    '[data-testid="msg-container"]',      // testid (occasionally present)
  ],

  /**
   * The text content inside a message bubble.
   */
  messageText: [
    'span.selectable-text',
    '[data-testid="msg-container"] span',
    '.copyable-text',
  ],

  /**
   * Contact and group names in the chat list.
   */
  chatListName: [
    '[data-testid="cell-frame-title"]',
    'span[title][dir]',
    '._ao3e',                             // structural fallback
  ],

  /**
   * Last-message previews in the chat list.
   */
  chatListPreview: [
    '[data-testid="last-msg"]',
    '[data-testid="cell-frame-secondary"]',
    '._ao3f',
  ],

  /**
   * Profile photos (avatar thumbnails).
   */
  profilePhoto: [
    '[data-testid="default-user"]',
    '[data-testid="avatar"]',
    'img[src*="pps.whatsapp.net"]',       // CDN URL pattern
    'img[src*="static.whatsapp.net"]',
    'img[alt="Profile photo"]',
    '[data-testid="chatlist-avatar"] img',
    '[data-testid="conversation-header-avatar"] img',
  ],

  /**
   * Images in conversations (not profile photos).
   */
  mediaImage: [
    '[data-testid="media-url-provider"] img',
    'img[src*="blob:"]',                  // blob-loaded images
    '[data-testid="image-thumb"]',
  ],

  /**
   * Video thumbnails and players.
   */
  mediaVideo: [
    'video',
    '[data-testid="video-thumb"]',
    '[data-testid="media-video"]',
  ],

  /**
   * GIF and sticker containers.
   */
  mediaGifSticker: [
    '[data-testid="gif"]',
    '[data-testid="sticker"]',
    'img[src*=".gif"]',
    '[data-animated="true"]',
  ],

  /**
   * Document preview panels.
   */
  documentPreview: [
    '[data-testid="document-thumb"]',
    '[data-testid="media-document"]',
    '.document-thumb',
  ],

  /**
   * Link previews attached to messages.
   */
  linkPreview: [
    '[data-testid="link-preview"]',
    '.link-preview',
  ],

  /**
   * The chat header showing the active contact/group name.
   */
  chatHeader: [
    '[data-testid="conversation-header"]',
    'header[data-testid]',
  ],

  chatHeaderName: [
    '[data-testid="conversation-info-header-chat-title"]',
    '[data-testid="conversation-header"] span[dir]',
  ],

  /**
   * Online / last-seen / typing status indicators.
   */
  onlineStatus: [
    '[data-testid="status"]',
    'span[data-testid="last-seen"]',
    '[aria-label*="online"]',
    '._ao3e + ._ao3f',
  ],

  typingIndicator: [
    '[data-testid="typing"]',
    '[data-testid="conversation-info-header-status"]',
  ],

  /**
   * The overall chat pane — used to determine context.
   */
  chatPane: [
    '[data-testid="conversation-panel-wrapper"]',
    '#main',
  ],

  /**
   * The chat/contact list in the left sidebar.
   */
  chatList: [
    '[data-testid="chat-list"]',
    '#pane-side',
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
