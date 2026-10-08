# Architecture

What's Not Up is a standard Manifest V3 Chrome extension. It has four entry points and a shared library layer.

---

## Entry points

### Content script (`src/content/index.ts`)

Injected into `https://web.whatsapp.com/*` and `https://www.instagram.com/*` pages. Responsibilities:

- Detect the current site and load its adapter (`src/content/sites/detect.ts`)
- Load settings from storage on page load
- Apply initial protections via the DOM processor
- Start the MutationObserver to catch dynamically loaded content
- Listen to `chrome.storage.onChanged` so setting changes re-process the live DOM immediately, without a reload
- Handle the keyboard shortcut (Ctrl/Cmd+Shift+P)
- Listen for window focus/blur if auto-blur is enabled
- Receive messages from the popup and service worker (deduplicated against storage events)

The extension does not collect, store, or transmit content. Privacy transformations are applied locally to content already rendered by the website; the content script only manipulates DOM attributes.

### Service worker (`src/background/service-worker.ts`)

The MV3 background context. Responsibilities:

- Open the onboarding page on first install
- Handle the toolbar icon click (toggle privacy mode as a fallback when popup is not set)
- Relay the `OPEN_ONBOARDING` message from the content script

The service worker is event-driven and does not maintain state beyond what's in storage.

### Popup (`src/popup/`)

A React app loaded in the extension popup. Identifies the active tab's site (`siteIdForUrl`) and shows only the toggles that apply to it. Changes are written to `chrome.storage.local`; the content script picks them up through `chrome.storage.onChanged`. A `SETTINGS_UPDATED` message is also sent as a redundant path — the content script deduplicates identical updates, so the two paths cannot cause double work. No page reload is required.

### Options page (`src/options/`)

A full-page React settings UI. Opened via `chrome.runtime.openOptionsPage()`. Structured into sections: Privacy, Content Protection, Reveal Behaviour, Focus Behaviour, Appearance, Advanced, Reset. Uses the same storage layer as the popup.

---

## Shared library

### `src/shared/types.ts`

All TypeScript types. The `PrivacySettings` interface is the single source of truth for the settings schema. `DEFAULT_SETTINGS` is the canonical default state.

### `src/shared/storage.ts`

Four functions: `loadSettings`, `saveSettings`, `patchSettings`, `resetSettings`. All use `chrome.storage.local`. Merges stored values over defaults on load so new fields added in future versions are always populated.

---

## Content script internals

### `src/content/sites/` — site adapters

Each supported site implements the `SiteAdapter` contract (`sites/types.ts`):

- `id` / `host` — site identity
- `groupRoots` — stable selectors for containers whose contents form one logical reveal group (WhatsApp message rows, conversation header)
- `targets[]` — privacy categories, each mapped to a settings toggle, a list of selectors, a `match: 'first' | 'union'` mode, an optional structural `resolve(root)` function for content with no stable selector, and an optional `exclude` list of hard-exclusion selectors
- `exclude` — site chrome that shares a token with real content (pickers, dialogs, the chat list). Applied by the DOM processor to **both** selector matches and resolver output, so neither path can leak past it

`detect.ts` maps a hostname to an adapter; unsupported hosts get a no-op adapter, so nothing is blurred.

**WhatsApp** (`sites/whatsapp/`) is split by responsibility: `index.ts` wires targets (match modes, resolvers, exclusions), `dom.ts` holds read-only signal helpers (hint attributes, content zones, shape tests), `avatar-resolver.ts` layers profile-photo detection, and `media-classifier.ts` decides whether a media element is an image, video, GIF or sticker. Classification is a pure function of the element, which is what keeps the four media toggles mutually exclusive by construction.

**Instagram** (`sites/instagram/`) locates comments and captions with structural resolvers anchored on permalink URL shapes (see the file header for verification status).

Resolvers are fail-safe: when they cannot identify content they return nothing, which means no blur.

### `src/content/selectors.ts`

WhatsApp Web's selector table — arrays of CSS selectors per element type, tried in priority order. Used only by the WhatsApp adapter. Also exports `queryAll` and `queryOne` — both silently skip malformed selectors and return an empty result rather than throwing (generic helpers live in `src/content/query.ts`).

### `src/content/dom-processor.ts`

Bridges a site adapter to the privacy engine. `applyProtections(settings, adapter)` walks the adapter's targets, resolves matches (selectors or structural resolvers), and protects each match — deduplicating nested candidates so one logical region gets exactly one owning element (no stacked parent/child CSS filters). `processNewNodes` is called by the MutationObserver with each batch of new nodes. `removeProtections` cleans everything up.

The DOM processor is the only layer that knows which adapter target maps to which settings toggle (e.g. `blurMessages → messageText`).

### `src/content/privacy-engine.ts`

A generic CSS engine. Has no knowledge of any particular site. Takes DOM elements and:
- Sets/removes `data-wnu-protected` (triggers CSS blur)
- Sets/removes `data-wnu-hidden` (triggers `visibility: hidden`)
- Registers logical reveal groups: reveal listeners attach to the group root, and revealing sets `data-wnu-revealed` on the root and every protected owner in the group so nested content reveals and re-blurs together
- Attaches the appropriate reveal event listeners based on `revealMode`
- Manages timers for temporary reveal

The CSS is injected via a single `<style id="wnu-privacy-styles">` tag. Updating blur intensity rewrites that one tag — no per-element inline styles.

### `src/content/overlay.ts`

Creates and removes the emergency full-screen overlay div. Self-contained; no external dependencies.

---

## Message protocol

Communication follows a typed union pattern. All messages are defined in `src/shared/types.ts` as `ExtensionMessage`. The content script handles:

| Message type | Effect |
|---|---|
| `PING` | Returns `PONG` (liveness check) |
| `GET_PRIVACY_STATE` | Returns current `privacyEnabled` |
| `SET_PRIVACY_ENABLED` | Toggles privacy without a full settings update |
| `SETTINGS_UPDATED` | Full settings replacement, re-applies protections (redundant with `storage.onChanged`; deduplicated) |

Settings changes propagate primarily through `chrome.storage.onChanged`: a single listener is registered once, coalesces bursts of updates into one re-apply (microtask), and on a real change tears down and re-applies protections against the live DOM.
| `QUICK_LOCK` | Shows the overlay |

---

## Build

Webpack 5 with ts-loader. Five entry points: `background`, `content`, `popup`, `options`, `onboarding`. CSS is extracted via MiniCssExtractPlugin. HTML pages are generated by HtmlWebpackPlugin. Icons and the manifest are copied with CopyWebpackPlugin.

Output is in `dist/`. The dist folder is what gets loaded as the unpacked extension.
