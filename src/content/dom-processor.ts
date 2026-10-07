/**
 * DOM Processor
 *
 * Bridges the WhatsApp selector layer with the privacy engine.
 * Walks the DOM, classifies elements by type, and applies/removes protections.
 */

import { PrivacySettings } from '../shared/types';
import { SELECTORS, queryAll } from './selectors';
import {
  protectElement,
  unprotectElement,
  hideElement,
  unhideElement,
  unprotectAll,
} from './privacy-engine';

const CLASSIFIED_ATTR = 'data-wnu-type';

/**
 * Apply all active protections to the current DOM.
 * Safe to call multiple times; already-protected elements are skipped.
 */
export function applyProtections(settings: PrivacySettings): void {
  if (!settings.privacyEnabled) {
    removeProtections();
    return;
  }

  if (settings.blurMessages) {
    queryAll(SELECTORS.messageText).forEach((el) => {
      markType(el, 'message');
      protectElement(el, settings);
    });
  }

  if (settings.blurContactNames) {
    queryAll(SELECTORS.chatListName).forEach((el) => {
      markType(el, 'name');
      protectElement(el, settings);
    });
    queryAll(SELECTORS.chatHeaderName).forEach((el) => {
      markType(el, 'header-name');
      protectElement(el, settings);
    });
  }

  if (settings.blurProfilePhotos) {
    queryAll(SELECTORS.profilePhoto).forEach((el) => {
      markType(el, 'photo');
      protectElement(el, settings);
    });
  }

  if (settings.blurImages) {
    queryAll(SELECTORS.mediaImage).forEach((el) => {
      markType(el, 'image');
      protectElement(el, settings);
    });
  }

  if (settings.blurVideos) {
    queryAll(SELECTORS.mediaVideo).forEach((el) => {
      markType(el, 'video');
      protectElement(el, settings);
    });
  }

  if (settings.blurGifsStickers) {
    queryAll(SELECTORS.mediaGifSticker).forEach((el) => {
      markType(el, 'gif-sticker');
      protectElement(el, settings);
    });
  }

  if (settings.blurDocumentPreviews) {
    queryAll(SELECTORS.documentPreview).forEach((el) => {
      markType(el, 'document');
      protectElement(el, settings);
    });
  }

  if (settings.blurLinkPreviews) {
    queryAll(SELECTORS.linkPreview).forEach((el) => {
      markType(el, 'link-preview');
      protectElement(el, settings);
    });
  }

  if (settings.blurChatListPreviews) {
    queryAll(SELECTORS.chatListPreview).forEach((el) => {
      markType(el, 'chat-preview');
      protectElement(el, settings);
    });
  }

  if (settings.blurChatHeader) {
    queryAll(SELECTORS.chatHeader).forEach((el) => {
      markType(el, 'chat-header');
      protectElement(el, settings);
    });
  }

  if (settings.hideOnlineStatus) {
    queryAll(SELECTORS.onlineStatus).forEach((el) => {
      markType(el, 'online-status');
      hideElement(el);
    });
  }

  if (settings.hideTypingIndicator) {
    queryAll(SELECTORS.typingIndicator).forEach((el) => {
      markType(el, 'typing');
      hideElement(el);
    });
  }
}

/**
 * Remove all protections (called when privacy mode is disabled).
 */
export function removeProtections(): void {
  unprotectAll();
  // Un-hide status elements
  document.querySelectorAll('[data-wnu-type="online-status"]').forEach(unhideElement);
  document.querySelectorAll('[data-wnu-type="typing"]').forEach(unhideElement);
}

/**
 * Process newly-added nodes (called by MutationObserver).
 * Only processes elements that match our selectors and haven't been seen.
 */
export function processNewNodes(nodes: NodeList, settings: PrivacySettings): void {
  if (!settings.privacyEnabled) return;

  nodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;

    // Re-apply to the subtree of the new node
    applyProtectionsInSubtree(el, settings);
  });
}

/**
 * Apply protections to elements within a subtree.
 * Uses the same logic as applyProtections but scoped to a root element.
 */
function applyProtectionsInSubtree(root: Element, settings: PrivacySettings): void {
  const processSet = (selectors: readonly string[], type: string, protect: boolean) => {
    selectors.forEach((sel) => {
      try {
        // Also check if root itself matches
        if (root.matches(sel)) {
          markType(root, type);
          if (protect) { protectElement(root, settings); } else { hideElement(root); }
        }
        root.querySelectorAll(sel).forEach((el) => {
          markType(el, type);
          if (protect) { protectElement(el, settings); } else { hideElement(el); }
        });
      } catch {
        // Ignore invalid selectors
      }
    });
  };

  if (settings.blurMessages) processSet(SELECTORS.messageText, 'message', true);
  if (settings.blurContactNames) {
    processSet(SELECTORS.chatListName, 'name', true);
    processSet(SELECTORS.chatHeaderName, 'header-name', true);
  }
  if (settings.blurProfilePhotos) processSet(SELECTORS.profilePhoto, 'photo', true);
  if (settings.blurImages) processSet(SELECTORS.mediaImage, 'image', true);
  if (settings.blurVideos) processSet(SELECTORS.mediaVideo, 'video', true);
  if (settings.blurGifsStickers) processSet(SELECTORS.mediaGifSticker, 'gif-sticker', true);
  if (settings.blurDocumentPreviews) processSet(SELECTORS.documentPreview, 'document', true);
  if (settings.blurLinkPreviews) processSet(SELECTORS.linkPreview, 'link-preview', true);
  if (settings.blurChatListPreviews) processSet(SELECTORS.chatListPreview, 'chat-preview', true);
  if (settings.blurChatHeader) processSet(SELECTORS.chatHeader, 'chat-header', true);
  if (settings.hideOnlineStatus) processSet(SELECTORS.onlineStatus, 'online-status', false);
  if (settings.hideTypingIndicator) processSet(SELECTORS.typingIndicator, 'typing', false);
}

/**
 * Remove protection from elements of a specific type.
 * Called when an individual toggle is switched off.
 */
export function unprotectByType(type: string): void {
  document.querySelectorAll(`[${CLASSIFIED_ATTR}="${type}"]`).forEach((el) => {
    unprotectElement(el);
    unhideElement(el);
  });
}

function markType(el: Element, type: string): void {
  if (!el.hasAttribute(CLASSIFIED_ATTR)) {
    el.setAttribute(CLASSIFIED_ATTR, type);
  }
}
