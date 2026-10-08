# Browser Support

---

## Microsoft Edge

**Status: Verified. v1.0.0 was manually tested in Edge against a real, logged-in WhatsApp Web session.**

Edge is Chromium-based and supports the Manifest V3 extension API. The release verification covered profile photos, GIFs, stickers, messages, contact/group names, chat-list previews, images and videos, dynamically arriving content, live toggle changes without a reload, and reveal behaviour.

---

## Google Chrome

**Status: Supported codebase, not separately verified for v1.0.0.**

Chrome is the reference platform for Manifest V3; the extension uses only standard MV3 APIs (`storage`, `tabs`, `content_scripts`, service worker background, `chrome.runtime` messaging). Chrome and Edge run identical code, so behaviour is expected to be the same — but this release was verified in Edge, and no separate Chrome session test is claimed.

Chrome 120+ is required for full MV3 feature support.

---

## Brave

**Status: Expected to work (untested).**

Brave is Chromium-based and supports standard Chrome extensions, including unpacked loading. It ships its own privacy features, which have not been checked for interaction with this extension. Not verified.

---

## Firefox

**Status: Not tested. Not claimed as supported.**

Firefox 109+ has Manifest V3 support, but there are differences:

- Firefox does not support `"service_worker"` in the `"background"` section; it requires `"scripts"` instead
- Some Chrome-specific APIs may not be available

The extension has not been tested on Firefox at all. No Firefox support is claimed, and no Firefox installation steps are documented.

To attempt Firefox compatibility, the manifest's background section would need to conditionally use `"scripts": ["background.js"]` and the build would need a Firefox-specific output.

---

## Safari

**Status: Not supported.**

Safari uses the Web Extensions API which is broadly compatible, but requires code signing and distribution through the App Store or as a Safari Web Extension. This has not been implemented. Safari is not claimed as supported.

---

## Summary

| Browser | Claimed support | Notes |
|---|---|---|
| Microsoft Edge | ✅ Verified | v1.0.0 manually tested with a logged-in WhatsApp Web session |
| Google Chrome | Supported codebase | Same MV3 APIs, not separately session-tested for v1.0.0 |
| Brave | Likely but untested | Chromium-based |
| Firefox | ❌ Not tested | Would need manifest changes; no support claimed |
| Safari | ❌ Not supported | Would need packaging changes |
