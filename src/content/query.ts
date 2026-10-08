/**
 * Generic selector helpers shared by every site adapter.
 *
 * All helpers are fail-safe: a malformed selector never throws, it is
 * skipped silently and the next selector in the chain is tried.
 */

/**
 * Try each selector in order and return all matching elements for the FIRST
 * selector that matches anything (fallback-chain semantics).
 *
 * Use this when the selectors in a list are alternative descriptions of the
 * same elements (they may overlap without causing duplicates).
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

/**
 * Return the union of matches for EVERY selector in the list, de-duplicated.
 *
 * Use this when the selectors in a list are additive (each one describes a
 * different way content appears — e.g. grid thumbnails vs. modal media).
 */
export function queryAllUnion(selectors: readonly string[], root: Document | Element = document): Element[] {
  const out = new Set<Element>();
  for (const sel of selectors) {
    try {
      root.querySelectorAll(sel).forEach((el) => out.add(el));
    } catch {
      // Malformed selector — skip silently
    }
  }
  return Array.from(out);
}

/**
 * Query ONE selector inside `root`, INCLUDING `root` itself when `root` is an
 * Element that matches.
 *
 * `SiteTarget.resolve` receives whatever scope the DOM processor is scanning.
 * When the MutationObserver delivers a single lazy-loaded avatar `<img>` (or a
 * GIF whose `src` was just populated), that element **is** the scope — a plain
 * `querySelectorAll` only walks descendants, would return nothing, and the
 * resolver would silently miss the very node that changed.
 *
 * Structural resolvers in `src/content/sites/*` must enumerate candidates with
 * this helper (or equivalent self-check) instead of `querySelectorAll`.
 */
export function queryAllInScope(selector: string, root: Document | Element): Element[] {
  const out: Element[] = [];
  if (root instanceof Element && matchesSelector(root, selector)) out.push(root);
  try {
    root.querySelectorAll(selector).forEach((el) => out.push(el));
  } catch {
    // Malformed selector — a possible self-match above still stands.
  }
  return out;
}

/**
 * Check whether a single selector matches an element, fail-safe.
 */
export function matchesSelector(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

/**
 * True when `el` matches ANY selector in the list, fail-safe.
 */
export function matchesAnySelector(el: Element, selectors: readonly string[]): boolean {
  for (const sel of selectors) {
    if (matchesSelector(el, sel)) return true;
  }
  return false;
}
