# Changelog

## [1.0.0] — 2026-10-08

Initial stable release of the local privacy layer for WhatsApp Web and supported Instagram surfaces.

### Added

**Privacy controls**
- Global Privacy Mode master switch
- Independent toggles for messages, contact/group names, profile photos, images, videos, GIFs/stickers, document previews, link previews, chat-list previews, chat header
- Visual hiding of online status, typing indicator and last-seen
- Instagram toggles for profile photos, photos, videos/reels, captions and comments

**Reveal system**
- Hover, click and temporary (timed) reveal modes
- Configurable blur intensity (2–20px) and reduced-motion support
- Emergency shortcut `Ctrl+Shift+P` / `Cmd+Shift+P`, Quick Lock, Max Privacy
- Optional auto-blur on window focus loss
- Full-screen emergency privacy overlay

**Product**
- Popup with primary controls, site-aware so it only shows toggles that apply to the active tab
- Options page with seven sections (Privacy, Content Protection, Reveal Behaviour, Focus Behaviour, Appearance, Advanced, Reset)
- First-run onboarding
- Light / dark / system theme
- Local settings persistence in `chrome.storage.local`

**Architecture**
- Manifest V3 extension with TypeScript throughout and React for popup, options and onboarding
- Licensed under the Apache License 2.0 (`LICENSE`, `"license": "Apache-2.0"`)
- Site adapter architecture (`src/content/sites/`) — the privacy engine and DOM processor are site-agnostic, and all site knowledge lives in per-site adapters
- Layered, rename-safe WhatsApp detection: exact selectors → attribute hints → structural context → shape and media characteristics, with hard exclusions applied before any positive signal
- Pure media classification into `image | video | GIF | sticker`, keeping the media toggles mutually exclusive by construction
- Explicit ownership model: one blur owner per logical region, documented rules, no stacked CSS filters
- `MutationObserver` scoped to added subtrees and `src` attribute changes — no polling, no document-wide rescan per mutation
- `npm run validate:extension` validating manifest, icons, permissions and the built bundle

### Changed

- Settings changes now propagate through `chrome.storage.onChanged` and re-apply to the already-open page — no reload, no polling, updates coalesced per tick and identical payloads deduplicated
- Detection failures now fail safe by design: low confidence produces *no blur* rather than a wrong blur, so a site redesign surfaces as visibly unblurred content instead of blurring UI you did not ask to hide
- Documentation restructured: privacy and security detail moved to `docs/privacy.md` and `docs/security.md`, with root `PRIVACY.md` / `SECURITY.md` acting as pointers

### Fixed

- **WhatsApp profile photos, GIFs and stickers were not blurred** while messages and names worked. Root cause was selector-only detection: a single stale `data-testid` silently disabled a whole category. Replaced with layered detection plus structural resolvers
- **Nested blur.** One logical region now has exactly one owning privacy element; nested content reveals and re-blurs together with no stacked parent/child CSS filters
- **Chat-row over-reach.** The chat-list row walk stops at known page containers and rejects any ancestor that contains other rows, so an unrelated image can no longer inherit the chat list's name cells as "its row"
- **Stale classification.** `removeProtections()` clears `data-wnu-type`, so a toggle change can no longer leave an outdated category behind
- **Lazy media.** Avatars and media whose `src` is populated after insertion are picked up by the observer
- **Emergency overlay accessibility.** It is now a modal dialog that takes focus, is dismissed with `Esc` as well as the shortcut or a click, and returns focus to the element that had it

### Security / Privacy

- Minimal permissions only: `storage`, `tabs`, `https://web.whatsapp.com/*`, `https://www.instagram.com/*`
- No backend, no telemetry, no analytics, no message storage, no message transmission
- No credential access, no network interception (no `webRequest` / `declarativeNetRequest`), no WhatsApp or Instagram API usage
- The optional live diagnostic script is a never-bundled dev tool that reads tags, attributes and media origins only — no text nodes, no credentials, no network calls

### Testing

- 259 automated tests across 14 files (jsdom + Vitest), covering the privacy engine, both site adapters, WhatsApp avatar detection, media classification, DOM ownership, mutation handling, settings propagation, reveal behaviour and the overlay
- Zero tests deleted or weakened
- Full gate passing: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run validate:extension`
- Final release manually verified in Microsoft Edge against a real logged-in WhatsApp Web session: profile photos, GIFs, stickers, messages, names, previews, dynamic media, live toggles and reveal behaviour

**Browser note:** Firefox has not been tested. No Firefox support is claimed.
