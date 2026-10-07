# Known Limitations

---

## Selector fragility

WhatsApp Web is a React-based SPA that uses auto-generated CSS class names. These change with every deployment. The extension uses `data-testid` attributes and ARIA patterns where available, but some selectors include class-based fallbacks that may break.

The selector file (`src/content/selectors.ts`) is designed to be updated independently of the rest of the code. Multiple fallback selectors are provided for each element type; if the first stops working after a WhatsApp update, later ones may still match.

There is no way to guarantee ongoing compatibility without testing against the live site after each WhatsApp update.

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

## WhatsApp Web only

The extension runs exclusively on `https://web.whatsapp.com`. It has no effect on:
- The WhatsApp desktop app
- The WhatsApp mobile app
- WhatsApp Business Web

---

## Dynamic content timing

The MutationObserver uses `requestAnimationFrame` batching to avoid layout thrashing. In practice this means there is a brief frame (typically under 16ms) where newly-loaded content is visible before the blur is applied. On very slow machines this window may be slightly longer.

---

## Extension not running until page loads

The content script is injected after the page's initial load. If WhatsApp Web has already rendered content before the extension activates (rare on initial load, can happen on back-navigation), there may be a visible flash of unblurred content.

---

## `chrome.storage.local` quota

Chrome's `chrome.storage.local` has a 10MB quota. Settings are a small JSON object (well under 1KB). This is not a practical concern, but the error is handled gracefully: if a write fails, the extension logs a warning and the settings change is not persisted.
