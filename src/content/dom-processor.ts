/**
 * DOM Processor
 *
 * Site-agnostic bridge between a SiteAdapter and the privacy engine.
 * Walks the DOM, classifies elements via the adapter's targets, resolves
 * ONE owning privacy target per logical region, and applies/removes
 * protections through the engine.
 *
 * The processor never contains site-specific selectors — those live in the
 * adapter (src/content/sites/*).
 */

import { PrivacySettings } from '../shared/types';
import { SiteAdapter, SiteTarget } from './sites/types';
import { whatsappAdapter } from './sites/whatsapp';
import { matchesSelector, queryAllUnion } from './query';
import {
  protectGroup,
  unprotectElement,
  hideElement,
  unhideElement,
  unprotectAll,
  pruneDisconnectedGroups,
  PROTECTED_ATTR,
} from './privacy-engine';

const CLASSIFIED_ATTR = 'data-wnu-type';

// The content script always passes the adapter detected for the current
// site. The default keeps standalone callers (and the legacy test suite)
// on WhatsApp without forcing every call site to import an adapter.
const DEFAULT_ADAPTER = whatsappAdapter;

interface ScopeMatches {
  /** Sensitive elements → category type (first target wins on overlap). */
  candidates: Map<Element, string>;
  /** Elements that act as logical reveal-group roots (structural). */
  structuralRoots: Set<Element>;
  /** Elements to visibility-hide (status indicators etc.). */
  hides: Array<[Element, string]>;
}

/**
 * Apply all active protections to the current DOM.
 * Safe to call multiple times; already-protected elements are skipped.
 */
export function applyProtections(settings: PrivacySettings, adapter: SiteAdapter = DEFAULT_ADAPTER): void {
  if (!settings.privacyEnabled) {
    removeProtections();
    return;
  }
  processScope(document, false, adapter, settings);
}

/**
 * Remove all protections (called when privacy mode is disabled or settings
 * are re-applied). Also detaches every reveal group, so no listeners leak.
 *
 * Classification (`data-wnu-type`) is cleared too: a type left behind by a
 * previous pass would be stale state after a toggle changes which categories
 * are even evaluated.
 */
export function removeProtections(): void {
  unprotectAll();
  document.querySelectorAll(`[${CLASSIFIED_ATTR}]`).forEach((el) => {
    el.removeAttribute(CLASSIFIED_ATTR);
  });
}

/**
 * Process newly-added nodes (called by MutationObserver).
 * Only processes elements that match the adapter's selectors and haven't
 * been seen; already-protected subtrees are skipped cheaply.
 */
export function processNewNodes(nodes: NodeList, settings: PrivacySettings, adapter: SiteAdapter = DEFAULT_ADAPTER): void {
  if (!settings.privacyEnabled) return;

  // Drop groups whose content the site has discarded (e.g. chat switched).
  pruneDisconnectedGroups();

  const set = new Set<Element>();
  nodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) set.add(node as Element);
  });

  // Skip nodes nested inside another added node — their subtree is already
  // covered by the ancestor's scan (avoids duplicate processing).
  const roots = Array.from(set).filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (set.has(p)) return false;
    }
    return true;
  });

  roots.forEach((el) => processScope(el, true, adapter, settings));
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

// ─── Internals ───────────────────────────────────────────────────────────────

function processScope(
  scope: Document | Element,
  includeSelf: boolean,
  adapter: SiteAdapter,
  settings: PrivacySettings,
): void {
  const matches = collectMatches(scope, includeSelf, adapter, settings);

  // Hide-mode targets are independent of blur grouping.
  matches.hides.forEach(([el, type]) => {
    markType(el, type);
    hideElement(el);
  });

  // Resolve ONE owning target per logical region and register reveal groups.
  for (const [el, type] of matches.candidates) {
    markType(el, type);
    const { owner, covered } = resolveOwner(el, matches.candidates);
    if (covered) continue; // already inside a protected ancestor — single blur layer
    const root = resolveRevealRoot(owner, adapter, matches.structuralRoots);
    protectGroup(owner, root, settings);
  }
}

function collectMatches(
  scope: Document | Element,
  includeSelf: boolean,
  adapter: SiteAdapter,
  settings: PrivacySettings,
): ScopeMatches {
  const candidates = new Map<Element, string>();
  const structuralRoots = new Set<Element>();
  const hides: Array<[Element, string]> = [];

  const addCandidate = (el: Element, type: string, structural: boolean): void => {
    if (!candidates.has(el)) candidates.set(el, type);
    if (structural) structuralRoots.add(el);
  };

  for (const target of adapter.targets) {
    if (!settings[target.setting]) continue; // toggle off → target not evaluated

    if (target.resolve) {
      let resolved: Element[] = [];
      try {
        resolved = target.resolve(scope);
      } catch {
        resolved = []; // fail-safe: a broken resolver never blurs anything
      }
      const usable = applyExclusions(resolved, target.exclude);
      if (target.mode === 'hide') {
        usable.forEach((el) => hides.push([el, target.type]));
      } else {
        usable.forEach((el) => addCandidate(el, target.type, target.resolvedAreGroupRoots === true));
      }
    }

    const found = applyExclusions(matchTarget(target, scope, includeSelf), target.exclude);
    if (target.mode === 'hide') {
      found.forEach((el) => hides.push([el, target.type]));
    } else {
      found.forEach((el) => addCandidate(el, target.type, false));
    }
  }

  return { candidates, structuralRoots, hides };
}

/**
 * Drop everything the target explicitly declared as off-limits (site chrome
 * that shares a token with real content). Applied uniformly to selector
 * matches AND resolver output so neither path can leak past it.
 */
function applyExclusions(els: Element[], exclude: readonly string[] | undefined): Element[] {
  if (!exclude || exclude.length === 0) return els;
  return els.filter((el) => {
    for (const sel of exclude) {
      try {
        if (el.closest(sel)) return false;
      } catch {
        // malformed exclusion selector — ignore it rather than drop content
      }
    }
    return true;
  });
}

function matchTarget(target: SiteTarget, scope: Document | Element, includeSelf: boolean): Element[] {
  const isElementScope = includeSelf && scope instanceof Element;
  const selectors = target.selectors;

  if ((target.match ?? 'first') === 'union') {
    const out = new Set<Element>();
    if (isElementScope && selectors.some((sel) => matchesSelector(scope as Element, sel))) {
      out.add(scope as Element);
    }
    queryAllUnion(selectors, scope).forEach((el) => out.add(el));
    return Array.from(out);
  }

  // Fallback semantics: the first selector with matches wins, so overlapping
  // alternatives never produce duplicate/nested results.
  for (const sel of selectors) {
    const found: Element[] = [];
    if (isElementScope && matchesSelector(scope as Element, sel)) found.push(scope as Element);
    try {
      scope.querySelectorAll(sel).forEach((el) => found.push(el));
    } catch {
      continue; // malformed selector — try the next one
    }
    if (found.length > 0) {
      return Array.from(new Set(found));
    }
  }
  return [];
}

/**
 * Find the OUTERMOST candidate that owns this element's protection.
 *
 * ─── Ownership rules (one logical region → one blur owner) ──────────────────
 *
 *  1. SINGLE OWNER. A region (a chat header, a message, an avatar wrapper)
 * *     has exactly ONE element carrying `data-wnu-protected`. CSS `filter`
 *     stacks, so a blurred parent could never visually un-blur its child —
 *     two nested owners would make reveal impossible for the inner one.
 *
 *  2. OUTERMOST WINS. If any ancestor of a candidate is also a candidate,
 *     that ancestor owns the region and the inner element is only *classified*
 *     (`data-wnu-type`) so its toggle still has a bookkeeping anchor. It is
 *     blurred by virtue of living inside its owner — never independently.
 *
 *  3. CROSS-CATEGORY ABSORPTION IS INTENTIONAL. The candidate map spans every
 *     ENABLED category, so a photo inside a conversation header is absorbed by
 *     the header owner. This is what keeps the header one visual unit. A
 *     category that is toggled OFF never enters the map, so its elements are
 *     never absorbed by it and never suppress another category's owner.
 *
 *  4. COVERED SHORT-CIRCUIT. An ancestor that is already protected (from an
 *     earlier iteration or a previous pass) means the region is done — the
 *     element is skipped entirely instead of re-protecting an ancestor.
 *
 *  5. NO CROSS-REGION ABSORPTION. Siblings never absorb each other: a chat-list
 *     row's name, preview and avatar are siblings, so each keeps its own
 *     owner and its own reveal group. Only true ancestor relationships
 *     collapse into one owner.
 *
 * Site-specific knowledge (what a "region" is) comes from the adapter's
 * `groupRoots` / structural roots — never from this function.
 */
function resolveOwner(el: Element, candidates: Map<Element, string>): { owner: Element; covered: boolean } {
  let outermost: Element | null = null;
  let covered = false;

  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n.hasAttribute(PROTECTED_ATTR)) covered = true;
    if (candidates.has(n)) outermost = n;
  }

  return { owner: outermost ?? el, covered };
}

/**
 * Nearest logical group root (adapter CSS group roots or structural roots
 * produced by a site adapter's resolver). Falls back to the owner itself,
 * i.e. a standalone region revealed by hovering the element directly.
 */
function resolveRevealRoot(owner: Element, adapter: SiteAdapter, structuralRoots: Set<Element>): Element {
  if (structuralRoots.size === 0 && adapter.groupRoots.length === 0) return owner;
  for (let n: Element | null = owner; n; n = n.parentElement) {
    if (structuralRoots.has(n)) return n;
    if (adapter.groupRoots.length > 0 && matchesAny(n, adapter.groupRoots)) return n;
  }
  return owner;
}

function matchesAny(el: Element, selectors: readonly string[]): boolean {
  for (const sel of selectors) {
    if (matchesSelector(el, sel)) return true;
  }
  return false;
}

function markType(el: Element, type: string): void {
  if (!el.hasAttribute(CLASSIFIED_ATTR)) {
    el.setAttribute(CLASSIFIED_ATTR, type);
  }
}
