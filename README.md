# What's Not Up

A privacy layer for WhatsApp Web and Instagram. Blurs messages, contact names, media, and status indicators on WhatsApp, and profile photos, posts, videos, captions, and comments on Instagram, so you can use either site in public without worrying about shoulder-surfing.

Everything runs locally in your browser. No data leaves your machine.

---

## Why this exists

WhatsApp Web is useful but visually exposed. On a train, in a coffee shop, or in a shared office, your messages are readable by anyone nearby. This extension puts a configurable blur over the content you care about, lets you reveal individual items on hover or click, and gives you a one-keystroke emergency lock.

The extension does not collect, store, or transmit content. Privacy transformations are applied locally to content already rendered by the website.

---

## What it actually does

**Privacy controls**
- Global privacy mode on/off
- Per-type blur toggles: messages, contact names, profile photos, images, videos, GIFs/stickers, document previews, link previews, chat-list previews, chat header
- Online status, typing indicator, and last-seen visual hiding

**Instagram**
- Blur toggles for profile photos, photos (grid, posts, stories covers), videos & reels, captions, and comments
- A comment row is treated as one region — author, timestamp, and text reveal and re-blur together
- Only reliably identifiable content is blurred; anything the adapter cannot identify is left visible (fail-safe)

**Reveal system**
- Hover to reveal — move the mouse over blurred content to see it
- Click to toggle — click once to reveal, click again to hide
- Timed reveal — content reappears briefly then re-blurs (configurable duration)
- Configurable blur intensity (2–20px)

**Quick privacy**
- `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) — instant full-screen lock overlay
- Quick Lock button in the popup
- Max Privacy button — enables all protections at once
- Optional auto-blur when WhatsApp loses window focus

**UI**
- Compact popup with all primary controls
- Full settings page with theme support (light/dark/system)
- First-run onboarding explaining what the extension does and doesn't do
- Emergency overlay screen

---

## Architecture

```
src/
  manifest.json          MV3 manifest
  shared/
    types.ts             All shared TypeScript types and DEFAULT_SETTINGS
    storage.ts           chrome.storage.local read/write/patch/reset
  content/
    index.ts             Content script entry point (site detection, MutationObserver, storage listener)
    privacy-engine.ts    Generic CSS-based blur/hide engine (no site knowledge)
    dom-processor.ts     Site adapter → privacy engine bridge (logical regions, owner dedup)
    sites/
      types.ts           SiteAdapter contract (selectors, resolvers, exclusions, match mode)
      detect.ts          Hostname → adapter detection
      whatsapp/          WhatsApp Web adapter
        index.ts           target wiring (match modes, resolvers, exclusions)
        selectors.ts       stable exact selector paths (via ../selectors.ts)
        dom.ts             read-only signal helpers (hints, zones, shape)
        avatar-resolver.ts layered profile-photo detection
        media-classifier.ts image/video/GIF/sticker classification
      instagram/         Instagram adapter (selectors, structural resolvers)
    selectors.ts         WhatsApp Web selector table (used by the WhatsApp adapter)
    query.ts             Subtree/union/malformed-selector-safe query helpers
    overlay.ts           Full-screen privacy overlay
  background/
    service-worker.ts    MV3 service worker (install, action click, message relay)
  popup/
    App.tsx              Popup React component
    popup.css
  options/
    Options.tsx          Settings page React component
    options.css
  onboarding/
    index.tsx            Onboarding React component
    onboarding.css
  icons/                 SVG + PNG icons (16/32/48/128px)
scripts/
  validate-extension.mjs Manifest/icon/permission/bundle validation
  whatsapp-live-diagnostic.js  Read-only console diagnostic (dev tool, never bundled)
```

The privacy engine (`privacy-engine.ts`) knows nothing about any particular site. It receives elements and applies CSS attributes. Each supported site has an adapter under `content/sites/` that maps that site's structure to the engine: which selectors target which privacy category, and which DOM nodes form one logical reveal group. The DOM processor (`dom-processor.ts`) is the shared bridge. Adding or fixing site-specific behaviour means editing only that site's adapter (for WhatsApp, `src/content/selectors.ts` plus `sites/whatsapp/`).

### How content is identified

Detection is layered, and no single layer is load-bearing:

1. **Exact selectors** — stable `data-testid`/ARIA/attribute paths from `selectors.ts`
2. **Resolvers** — structural detection that survives renamed testids: explicit hints (testid/class/alt/aria/media URL) → structural area (chat pane, header, message bubble, participant row) → visual shape (circular clipping, square aspect, avatar-sized box)
3. **Media classification** — one pure function decides whether a media element is an image, video, GIF or sticker, so the four toggles are mutually exclusive by construction
4. **Exclusions** — hard rules ruling out pickers, dialogs, the chat list and page chrome before any positive signal
5. **Fail-safe** — when a signal cannot be determined (no layout, no `src`, malformed selector) it counts as *absent*. Absence can only stop a candidate from being produced, never add one: low confidence means **no blur**, never a wrong blur.

Every generic `<img>`/`<video>`/`<canvas>` sweep is avoided; a media element is only ever claimed when positive evidence identifies it. WhatsApp rotates auto-generated class names and testids regularly, so the selector table is a starting point rather than the whole answer — this is why layers 2–5 exist.

---

## Installation (development)

```bash
git clone https://github.com/skandachandrashekhar335-wq/whatsapp-privacy-enhacer.git
cd whatsapp-privacy-enhacer
npm install
npm run build
```

Then in Chrome/Edge/Brave:
1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `dist/` folder

---

## Development

```bash
npm run dev          # webpack watch mode
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm run test         # Vitest (259 tests)
npm run build        # Production build → dist/
npm run validate:extension   # manifest, icons, permissions, bundle checks
```

---

## Testing

The test suite covers:
- Settings defaults, storage read/write/patch/reset, schema migration, error handling
- Privacy engine: style injection, blur clamping, element protection/unprotection, reveal listeners (hover/click/timed), timer management
- Logical reveal groups: one owner per region, nested content revealing together, no stacked CSS filters
- DOM processor: applyProtections, removeProtections, processNewNodes, unprotectByType, idempotency
- Site detection: hostname → adapter, unsupported hosts fall back to no-op
- Settings propagation: storage.onChanged re-processes the live DOM without reload, duplicate listeners, coalesced updates
- WhatsApp profile photos: layered detection (hints → structural area → circular/chat-row/square shape), false-positive rejection, lazy-loaded and changed `src`, dynamically inserted avatars
- WhatsApp GIFs and stickers: classification across representations (testid, renamed testid, wrapper label, canvas, looping video, marker attribute), false-positive rejection (real videos, photo messages, emoji, picker tiles, chat-list art), category independence
- WhatsApp ownership and reveal: one blur owner per region, wrapper/image pairs collapsed to a single layer, the whole message revealed together
- MutationObserver: the real observer started by `init()` — late-inserted messages/GIFs/stickers/avatars, `src`-attribute re-evaluation, scoped processing with no document-wide rescan, no duplicate protection, no observer loop
- Instagram adapter: selector categories, comment/caption structural resolvers, toggle respect, no generic-element blurring
- Selectors: queryAll/queryOne fallback chains, malformed selector handling, subtree scoping
- Overlay: show/hide/idempotency/ARIA

Tests run in jsdom with a chrome API mock. They do not depend on a live WhatsApp or Instagram session.

See [docs/testing.md](docs/testing.md) for what is covered and what isn't.

---

## Browser support

| Browser | Status |
|---------|--------|
| Chrome 120+ | Works (primary target) |
| Edge 120+ | Works (Chromium-based, same codebase) |
| Brave | Works (Chromium-based) |
| Firefox | Not tested — MV3 support in Firefox differs; may work with minor adjustments |

See [docs/browser-support.md](docs/browser-support.md) for details.

---

## Privacy

This extension:
- processes everything locally in your browser
- stores only your settings in `chrome.storage.local`
- does not collect, store, or transmit content; privacy transformations are applied locally to content already rendered by the website
- never requests your WhatsApp or Instagram credentials
- never intercepts network traffic
- uses the minimum permissions required

See [PRIVACY.md](PRIVACY.md) for the full privacy model.

---

## Limitations

WhatsApp Web uses auto-generated CSS class names that change without notice. The extension uses stable `data-testid` attributes and ARIA patterns where available, with class-based fallbacks. Some elements may not be caught when WhatsApp updates its DOM.

Specifically:
- Profile photos, GIFs and stickers are detected in layers (stable selectors → hint attributes → structural area → visual shape → media classification). When none of those layers produces enough evidence the element is left visible, so a WhatsApp change shows *unblurred* content rather than the wrong content being blurred
- Last-seen timestamps are hidden via the same selector as online status; they cannot be targeted independently with current selectors
- Document previews use a testid that may not always be present
- GIF autoplay cannot be stopped — the blur prevents seeing them, but they still load
- The extension works on the visible DOM only; it cannot affect WhatsApp's end-to-end encryption or server-side data
- Selectors and structural resolvers are validated against fixtures shaped like the current WhatsApp/Instagram DOM, not against a live session on every release; WhatsApp and Instagram can and do change their markup without notice

Instagram limitations:
- Direct messages, the stories viewer, and the in-app reels viewer are behind login and are not implemented — no claims are made about them
- Profile photo detection relies on `alt` text ("…'s profile picture"); non-English UI locales may not match, in which case the photo is left visible rather than wrongly blurred
- Comment and caption detection uses structural resolvers anchored on permalink URL shapes; if Instagram changes that structure the resolver returns nothing (no blur) rather than guessing
- Logged-out feed pages redirect to the login screen, so feed-specific behaviour could not be verified

See [docs/limitations.md](docs/limitations.md) for the full list.

---

## Permissions

```json
"permissions": ["storage", "tabs"],
"host_permissions": ["https://web.whatsapp.com/*", "https://www.instagram.com/*"]
```

`storage` — to save settings. `tabs` — for the popup to detect if the active tab is a supported site and to send messages to the content script. No broad host access; only `web.whatsapp.com` and `www.instagram.com`.

---

## Roadmap

- Real PNG icons (currently minimal placeholders)
- Per-chat privacy settings
- Keyboard shortcut customisation
- Firefox MV3 compatibility testing
- Screenshot protection (OS-level, out of scope for a browser extension)

---

## License

MIT
