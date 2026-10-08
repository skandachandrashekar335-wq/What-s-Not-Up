# Changelog

## [1.0.0] — 2026-10-08

Initial release.

### Added

**Privacy engine**
- Global privacy mode on/off
- Blur: messages, contact/group names, profile photos, images, videos, GIFs/stickers, document previews, link previews, chat-list previews, chat header
- Visual hiding: online status, typing indicator, last-seen
- CSS-based transforms only; the extension does not collect, store, or transmit content
- MutationObserver for dynamically loaded content

**Instagram support**
- Site adapter architecture (`src/content/sites/`) with per-site detection; WhatsApp and Instagram adapters, no-op elsewhere
- Blur toggles: profile photos, photos (grid/posts/story covers), videos & reels, captions, comments
- Comment rows and captions located by fail-safe structural resolvers (no blur when the structure cannot be identified)
- Popup and options pages are site-aware; Instagram host access added (`https://www.instagram.com/*`)

**Fixed**
- Nested blur: one logical region now has exactly one owning privacy element; nested content reveals and re-blurs together with no stacked parent/child CSS filters
- Settings changes apply to the already-open page via `chrome.storage.onChanged` — no reload, coalesced updates, no duplicate listeners, focus/blur auto-blur re-arms without reload
- WhatsApp profile photos, GIFs and stickers are detected even when WhatsApp renames or restructures their markup. Detection is now layered rather than selector-only:
  - profile photos: exact selectors → hint attributes (testid/class/alt/aria/CDN URL) → structural area → circular clipping / chat-list row / square-and-avatar-sized shape
  - GIFs and stickers: a single pure classifier distinguishes image / video / GIF / sticker from the element itself (testid on a wrapper, CDN path, marker attribute, animated marker, canvas sticker, looping control-less video) so the four media toggles stay mutually exclusive
  - hard exclusions rule out the GIF picker, sticker picker, emoji picker, dialogs and the chat list before any positive signal, so picker tiles stay visible
- Lazy-loaded avatars and media whose `src` is populated after insertion are now picked up by the MutationObserver (`src` attribute observation, batched, no document-wide rescan)
- `removeProtections()` clears stale `data-wnu-type` classification, so a toggle change can never leave an outdated category behind
- Chat-row ownership no longer climbs past the pane/header, so an unrelated image can never inherit the chat list's name cells as "its row"
- The emergency overlay is operable by keyboard alone: it is a modal dialog that takes focus, is dismissed with Escape as well as the shortcut or a click, and returns focus to the element that had it

**Reveal system**
- Hover mode: reveal on mouseenter, re-blur on mouseleave
- Click mode: toggle on click
- Temporary mode: reveal briefly then auto-re-blur (configurable duration)
- Configurable blur intensity (2–20px)
- Reduced-motion support

**Quick privacy**
- Emergency keyboard shortcut: Ctrl+Shift+P / Cmd+Shift+P
- Quick Lock (full-screen overlay)
- Max Privacy (enables all protections)
- Optional auto-blur on window focus loss

**Extension UI**
- Popup with all primary controls (toggle, content type checkboxes, reveal mode, blur slider, Quick Lock, Max Privacy)
- Full settings/options page with seven sections (Privacy, Content Protection, Reveal Behaviour, Focus Behaviour, Appearance, Advanced, Reset)
- First-run onboarding page
- Emergency privacy overlay

**Technical**
- Manifest V3
- TypeScript throughout
- React for popup, options, onboarding
- `chrome.storage.local` for settings persistence
- Site adapters isolate per-site selectors and structural resolvers
- 259 automated tests (jsdom + Vitest)
- Minimal permissions: `storage`, `tabs`, `https://web.whatsapp.com/*`, `https://www.instagram.com/*`
