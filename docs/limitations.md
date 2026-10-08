# Known Limitations

---

## Browser and site compatibility

| Target | Status |
|---|---|
| WhatsApp Web (`web.whatsapp.com`) | Supported. Final v1.0.0 release manually verified in Microsoft Edge with a logged-in session. |
| Instagram — profile photos, grid/post media, video/reels, captions, comments | Supported on public/logged-out profile and post/permalink pages. |
| Instagram — direct messages | **Not implemented.** |
| Instagram — Stories viewer | **Not implemented.** |
| Instagram — Reels viewer | **Not implemented.** |
| Chrome / Edge / Brave (Chromium) | Same codebase; Edge is the verified browser. |
| Firefox | **Not tested.** MV3 support differs; no support is claimed. |
| WhatsApp desktop/mobile apps, WhatsApp Business | Out of scope — the extension only runs in a browser on the two supported origins. |

---

## Selector fragility

WhatsApp Web is a React-based SPA that uses auto-generated CSS class names. These change with every deployment. The extension uses `data-testid` attributes and ARIA patterns where available, but some selectors include class-based fallbacks that may break.

The selector file (`src/content/selectors.ts`) is designed to be updated independently of the rest of the code. Multiple fallback selectors are provided for each element type; if the first stops working after a WhatsApp update, later ones may still match.

There is no way to guarantee ongoing compatibility without testing against the live site after each WhatsApp update.

---

## Detection is layered, and fails safe

WhatsApp rotates auto-generated class names and `data-testid` values without notice, so no single selector is load-bearing. Detection runs in layers:

1. exact selector paths (`src/content/selectors.ts`)
2. hint attributes on the element or its wrapper (testid, class, alt, aria-label, media URL)
3. structural area (chat pane, conversation header, message bubble, participant/list row)
4. visual shape (circular clipping, square aspect, avatar-sized box)
5. media classification (is this image/video/GIF/sticker?)

Plus hard exclusions — the GIF picker, sticker picker, emoji picker, dialogs and the chat list are ruled out before any positive signal is considered.

When a layer cannot produce enough evidence (no `src`, no layout, an unknown structure, a malformed selector) it counts as **absent**. Absence can only *stop* an element from being claimed, never add one. The practical consequence is deliberate: **if detection confidence is low the content stays visible rather than the wrong content being blurred.** A WhatsApp markup change therefore shows up as unblurred profile photos/GIFs/stickers — the failure mode you can see and report — never as a message, icon or picker tile you did not ask to blur.

---

## Verification status (v1.0.0)

**Verified automatically** — `npm run typecheck`, `npm run lint`, `npm test` (259 tests), `npm run build` and `npm run validate:extension` all pass. The suites exercise the layered profile-photo resolver, the media classifier, ownership/reveal grouping, live settings propagation and the real MutationObserver against fixtures modelled on the current WhatsApp and Instagram markup.

**Manually verified in a real session** — the final release was tested in **Microsoft Edge against a logged-in WhatsApp Web session**, confirming profile photos, GIFs, stickers, messages, contact/group names, chat-list previews, images and videos, dynamically arriving content, live toggles applied without a reload, and reveal behaviour.

**Instagram** selectors and structural resolvers were checked against logged-out public profile and post/permalink pages during development. Logged-out feed, DMs, the stories viewer and the reels viewer redirect to login, are **not implemented**, and were not verified.

**Firefox** has not been tested.

Because WhatsApp changes its markup without notice, the Edge result is a point-in-time verification of this release — not a guarantee against future WhatsApp updates. If a surface stops blurring after a site update, `scripts/whatsapp-live-diagnostic.js` (read-only console script, see [development.md](development.md)) reports which stage failed: discovery, ownership, or CSS.

---

## Last-seen cannot be targeted separately

WhatsApp displays "online", "last seen...", and typing status in the same DOM area. Current selectors cannot reliably distinguish "online" from "last seen at 3pm" in all cases. Both are hidden together when online/typing status hiding is enabled.

---

## GIF autoplay

GIFs continue to load and play behind the blur. The blur prevents seeing them, but they are not paused. This is a CSS limitation — stopping GIF playback would require replacing the element, which is more invasive than the current approach.

---

## Document previews

Document previews use a `data-testid="document-thumb"` selector. This testid is not always present. In cases where WhatsApp renders documents without this attribute, the preview will not be caught.

---

## Screenshot protection

There is no way for a browser extension to prevent screenshots or screen recording at the OS level. Privacy mode protects against casual shoulder-surfing but cannot prevent a person or application taking a screenshot of your screen.

---

## Firefox

Firefox's implementation of Manifest V3 differs from Chrome's in a few areas. This extension has not been tested on Firefox. It may work, but the `service_worker` field in the manifest may need to be adjusted to use `background.scripts` for Firefox MV2 compatibility.

---

## Supported sites only

The extension runs exclusively on `https://web.whatsapp.com` and `https://www.instagram.com`. It has no effect on:
- The WhatsApp desktop app
- The WhatsApp mobile app
- WhatsApp Business Web
- The Instagram mobile app
- Any other website

## Instagram coverage

Instagram support covers only content that can be identified reliably: profile photos, grid/post/story-cover images, videos and reels, post captions, and comment rows. Direct messages, the stories viewer, and the in-app reels viewer are behind login and are **not implemented** — no protection is claimed there. See the README for the full list of Instagram limitations.

---

## Dynamic content timing

The MutationObserver uses `requestAnimationFrame` batching to avoid layout thrashing. In practice this means there is a brief frame (typically under 16ms) where newly-loaded content is visible before the blur is applied. On very slow machines this window may be slightly longer.

---

## Extension not running until page loads

The content script is injected after the page's initial load. If the site has already rendered content before the extension activates (rare on initial load, can happen on back-navigation), there may be a visible flash of unblurred content.

---

## `chrome.storage.local` quota

Chrome's `chrome.storage.local` has a 10MB quota. Settings are a small JSON object (well under 1KB). This is not a practical concern, but the error is handled gracefully: if a write fails, the extension logs a warning and the settings change is not persisted.
