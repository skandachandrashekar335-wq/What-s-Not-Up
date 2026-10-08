/**
 * Site detection.
 *
 * Only supported sites get an adapter; anything else must do NOTHING
 * (no styles, no observer, no listeners).
 */

import { SiteAdapter, SiteId } from './types';
import { whatsappAdapter } from './whatsapp';
import { instagramAdapter } from './instagram';

export type { SiteId, SiteAdapter } from './types';

const ADAPTERS: readonly SiteAdapter[] = [whatsappAdapter, instagramAdapter];

/** Returns the adapter for an exact hostname, or null for unknown sites. */
export function detectAdapter(hostname: string): SiteAdapter | null {
  const host = hostname.toLowerCase();
  return ADAPTERS.find((adapter) => adapter.host === host) ?? null;
}

/** Returns the site id for a full URL, or null when unsupported/unparsable. */
export function siteIdForUrl(url: string): SiteId | null {
  try {
    return detectAdapter(new URL(url).hostname)?.id ?? null;
  } catch {
    return null;
  }
}

/** All supported hosts (used by the options page to notify open tabs). */
export const SUPPORTED_HOST_PATTERNS: readonly string[] = ADAPTERS.map(
  (adapter) => `https://${adapter.host}/*`,
);
