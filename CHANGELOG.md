# Changelog

## [1.0.0] — 2026-10-07

Initial release.

### Added

**Privacy engine**
- Global privacy mode on/off
- Blur: messages, contact/group names, profile photos, images, videos, GIFs/stickers, document previews, link previews, chat-list previews, chat header
- Visual hiding: online status, typing indicator, last-seen
- CSS-based transforms only; no content is read or stored
- MutationObserver for dynamically loaded content

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
- WhatsApp selectors isolated in a single file for easy maintenance
- 74 automated tests (jsdom + Vitest)
- Minimal permissions: `storage`, `tabs`, `https://web.whatsapp.com/*`
