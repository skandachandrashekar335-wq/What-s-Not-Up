# What's Not Up

A privacy layer for WhatsApp Web. Blurs messages, contact names, media, and status indicators so you can use WhatsApp in public without worrying about shoulder-surfing.

Everything runs locally in your browser. No data leaves your machine.

---

## Why this exists

WhatsApp Web is useful but visually exposed. On a train, in a coffee shop, or in a shared office, your messages are readable by anyone nearby. This extension puts a configurable blur over the content you care about, lets you reveal individual items on hover or click, and gives you a one-keystroke emergency lock.

It does not read, store, or upload any messages. It is a CSS-based visual filter applied to the page you are already viewing.

---

## What it actually does

**Privacy controls**
- Global privacy mode on/off
- Per-type blur toggles: messages, contact names, profile photos, images, videos, GIFs/stickers, document previews, link previews, chat-list previews, chat header
- Online status, typing indicator, and last-seen visual hiding

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
    index.ts             Content script entry point (MutationObserver, keyboard, messages)
    privacy-engine.ts    Generic CSS-based blur/hide engine (no WhatsApp knowledge)
    dom-processor.ts     WhatsApp DOM → privacy engine bridge
    selectors.ts         All WhatsApp-specific selectors in one place
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
```

The privacy engine (`privacy-engine.ts`) knows nothing about WhatsApp. It receives elements and applies CSS attributes. The DOM processor (`dom-processor.ts`) bridges WhatsApp's structure to the engine. The selector list (`selectors.ts`) is the only file that needs updating when WhatsApp changes its DOM.

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
npm run test         # Vitest (74 tests)
npm run build        # Production build → dist/
```

---

## Testing

The test suite covers:
- Settings defaults, storage read/write/patch/reset, schema migration, error handling
- Privacy engine: style injection, blur clamping, element protection/unprotection, reveal listeners (hover/click/timed), timer management
- DOM processor: applyProtections, removeProtections, processNewNodes, unprotectByType, idempotency
- Selectors: queryAll/queryOne fallback chains, malformed selector handling, subtree scoping
- Overlay: show/hide/idempotency/ARIA

Tests run in jsdom with a chrome API mock. They do not depend on a live WhatsApp session.

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
- never reads, stores, or transmits message content
- never requests your WhatsApp credentials
- never intercepts network traffic
- uses the minimum permissions required

See [PRIVACY.md](PRIVACY.md) for the full privacy model.

---

## Limitations

WhatsApp Web uses auto-generated CSS class names that change without notice. The extension uses stable `data-testid` attributes and ARIA patterns where available, with class-based fallbacks. Some elements may not be caught when WhatsApp updates its DOM.

Specifically:
- Last-seen timestamps are hidden via the same selector as online status; they cannot be targeted independently with current selectors
- Document previews use a testid that may not always be present
- GIF autoplay cannot be stopped — the blur prevents seeing them, but they still load
- The extension works on the visible DOM only; it cannot affect WhatsApp's end-to-end encryption or server-side data

See [docs/limitations.md](docs/limitations.md) for the full list.

---

## Permissions

```json
"permissions": ["storage", "tabs"],
"host_permissions": ["https://web.whatsapp.com/*"]
```

`storage` — to save settings. `tabs` — for the popup to detect if the active tab is WhatsApp Web and to send messages to the content script. No broad host access; only `web.whatsapp.com`.

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
