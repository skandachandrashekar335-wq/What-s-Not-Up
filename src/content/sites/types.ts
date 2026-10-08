/**
 * Site adapter contract.
 *
 * The privacy engine and DOM processor are site-agnostic: they only know how
 * to apply/remove/reveal visual protection. Everything that requires
 * site-specific DOM knowledge (selectors, logical content groups, structural
 * resolvers) lives behind this interface.
 *
 *   Privacy Engine  ←  DOM Processor  ←  Site Adapter (WhatsApp | Instagram)
 */

import { PrivacySettings } from '../../shared/types';

/** Settings keys whose value is a boolean toggle (i.e. a protection gate). */
export type BooleanSettingKey = {
  [K in keyof PrivacySettings]: PrivacySettings[K] extends boolean ? K : never;
}[keyof PrivacySettings];

export type SiteId = 'whatsapp' | 'instagram';

/** How a target's selector list is matched. */
export type MatchMode =
  /** First selector with matches wins (fallback chain, no duplicates). */
  | 'first'
  /** Union of every selector, de-duplicated (additive selector sets). */
  | 'union';

export interface SiteTarget {
  /**
   * Category key written to `data-wnu-type` (e.g. `message`, `comment`).
   * Stable across sites so debugging and `unprotectByType` stay meaningful.
   */
  type: string;
  /** The settings toggle that gates this target. */
  setting: BooleanSettingKey;
  /** CSS selectors for the sensitive elements themselves. */
  selectors: readonly string[];
  /**
   * `protect` = blur with reveal behaviour (default).
   * `hide`    = visibility:hidden (status indicators).
   */
  mode?: 'protect' | 'hide';
  /** Selector matching strategy. Defaults to `first` (fallback semantics). */
  match?: MatchMode;
  /**
   * Site-specific structural resolver for content that cannot be identified
   * by a stable CSS selector (e.g. Instagram comment rows). Runs in addition
   * to `selectors`. Must be fail-safe: return [] when unsure.
   *
   * The scope may be an ELEMENT (MutationObserver subtree scans), and that
   * element may itself be a candidate — resolvers must therefore enumerate
   * with `queryAllInScope`, not `querySelectorAll`.
   */
  resolve?: (root: Document | Element) => Element[];
  /**
   * Hard exclusions applied to everything this target produces (both
   * selector matches and resolver output).
   *
   * Use this for site chrome that shares a token with real content — e.g.
   * WhatsApp's GIF/sticker picker renders `[data-testid="sticker"]` tiles
   * that must stay visible even though message stickers must blur.
   */
  exclude?: readonly string[];
  /**
   * When true, elements produced by `resolve` act as logical group roots:
   * everything protected inside one of them reveals/re-blurs together.
   */
  resolvedAreGroupRoots?: boolean;
}

export interface SiteAdapter {
  id: SiteId;
  /** Hostname this adapter is responsible for (exact match). */
  host: string;
  /**
   * CSS selectors for logical content containers (e.g. a WhatsApp message
   * bubble). All protected content sharing a container is one reveal group:
   * hovering it reveals every protected part together, and leaving re-blurs
   * them together. Nearest matching ancestor wins.
   */
  groupRoots: readonly string[];
  /** Protection targets, evaluated in order. */
  targets: readonly SiteTarget[];
}
