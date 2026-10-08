/**
 * WhatsApp Web site adapter.
 *
 * All WhatsApp DOM knowledge (selector tables, structural resolvers, media
 * classification, logical content groups) is contained here — the privacy
 * engine and DOM processor stay site-agnostic.
 *
 * ─── Detection layering ─────────────────────────────────────────────────────
 *   SELECTORS (./../selectors.ts)  stable exact paths, matched with `union`
 *                                  for every additive set
 *   resolvers (./avatar-resolver,  rename-safe structural detection: hints
 *             ./media-classifier)  → area → shape, and media classification
 *   exclusions (`exclude`)         site chrome that shares a token with real
 *                                  content (pickers, chat list)
 *
 * Selector table: ../selectors.ts (shared with legacy imports/tests).
 */

import { SiteAdapter } from '../types';
import { SELECTORS } from '../../selectors';
import { PICKER_ZONES } from './dom';
import { resolveWhatsAppProfilePhotos } from './avatar-resolver';
import { resolveWhatsAppGifsAndStickers } from './media-classifier';

/**
 * Regions that can hold GIF/sticker-shaped UI but never hold message media.
 * Applied by the DOM processor to BOTH selector matches and resolver output,
 * so WhatsApp's GIF/sticker/emoji/reaction pickers stay visible no matter
 * which detection layer would otherwise have matched them.
 */
const NOT_MESSAGE_MEDIA = [
  ...PICKER_ZONES,
  '#pane-side',
  '[data-testid="chat-list"]',
] as const;

export const whatsappAdapter: SiteAdapter = {
  id: 'whatsapp',
  host: 'web.whatsapp.com',

  /**
   * Logical reveal-group containers.
   *
   * A WhatsApp message can contain text, emoji, links, link previews,
   * media, stickers and documents in nested containers. Grouping them
   * under the message bubble means ONE owning privacy target per logical
   * region: hovering the message reveals every protected part together,
   * and leaving re-blurs them together — no nested/stacked blur layers.
   *
   * Same for the conversation header, which nests the contact/group name,
   * avatar and title inside the header container.
   *
   * Categories stay independent because a group is only *registered* from
   * owners that were actually protected: with GIFs off, the GIF never
   * becomes an owner, so it is neither blurred nor revealed by this group.
   */
  groupRoots: [
    '[data-testid="msg-container"]',
    '[data-testid="conversation-header"]',
  ],

  targets: [
    {
      type: 'message',
      setting: 'blurMessages',
      selectors: SELECTORS.messageText,
      // Fallback chain: these selectors overlap (a span.selectable-text sits
      // inside a .copyable-text), so union would create nested candidates.
      match: 'first',
    },
    {
      type: 'name',
      setting: 'blurContactNames',
      selectors: SELECTORS.chatListName,
      match: 'first', // overlapping alternatives — same reason as message
    },
    {
      type: 'header-name',
      setting: 'blurContactNames',
      selectors: SELECTORS.chatHeaderName,
      match: 'first',
    },
    {
      type: 'photo',
      setting: 'blurProfilePhotos',
      selectors: SELECTORS.profilePhoto,
      /**
       * Profile photos are an ADDITIVE selector set, not a fallback chain.
       * Chat-list avatars, group avatars, the conversation-header avatar and
       * CDN-backed photos are each reached by a *different* structural path.
       *
       * With `first`, matching stops at the first selector that returns
       * anything, so a single hit anywhere in the document — e.g. one
       * `[data-testid="avatar"]` node — silently suppressed every later path.
       *
       * `union` evaluates all of them, and the structural resolver adds the
       * rename-safe paths. De-duplication (Set) plus owner resolution
       * (outermost candidate wins, inner matches become `covered`) guarantee
       * exactly one blur layer per avatar, so the logical-group / reveal
       * architecture is unaffected.
       */
      match: 'union',
      resolve: resolveWhatsAppProfilePhotos,
    },
    {
      type: 'image',
      setting: 'blurImages',
      selectors: SELECTORS.mediaImage,
      match: 'union', // additive: provider img / image thumb / media image
    },
    {
      type: 'video',
      setting: 'blurVideos',
      selectors: SELECTORS.mediaVideo,
      match: 'union', // additive: video thumb / media video / provider video
    },
    {
      type: 'gif-sticker',
      setting: 'blurGifsStickers',
      selectors: SELECTORS.mediaGifSticker,
      match: 'union', // additive: gif / sticker / animated marker
      resolve: resolveWhatsAppGifsAndStickers,
      exclude: NOT_MESSAGE_MEDIA,
    },
    {
      type: 'document',
      setting: 'blurDocumentPreviews',
      selectors: SELECTORS.documentPreview,
      match: 'union', // additive (and may nest — outermost owner wins)
    },
    {
      type: 'link-preview',
      setting: 'blurLinkPreviews',
      selectors: SELECTORS.linkPreview,
      match: 'union', // additive (thumbnail may sit inside the preview)
    },
    {
      type: 'chat-preview',
      setting: 'blurChatListPreviews',
      selectors: SELECTORS.chatListPreview,
      // Overlapping: `last-msg` lives inside `cell-frame-secondary`, so union
      // would hand ownership to the wider cell and change what blurs.
      match: 'first',
    },
    {
      type: 'chat-header',
      setting: 'blurChatHeader',
      selectors: SELECTORS.chatHeader,
      match: 'first',
    },
    {
      type: 'online-status',
      setting: 'hideOnlineStatus',
      selectors: SELECTORS.onlineStatus,
      match: 'first',
      mode: 'hide',
    },
    {
      type: 'typing',
      setting: 'hideTypingIndicator',
      selectors: SELECTORS.typingIndicator,
      match: 'first',
      mode: 'hide',
    },
  ],
};
