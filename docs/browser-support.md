# Browser Support

---

## Chrome

**Status: Primary target. Build and architecture are designed for Chrome.**

The extension uses Manifest V3 with a service worker background script and content script injection via `content_scripts`. Tested via manual load of the unpacked `dist/` folder.

Chrome version 120+ is required for full MV3 feature support.

---

## Edge

**Status: Expected to work (untested).**

Microsoft Edge is Chromium-based and supports the same MV3 extension API as Chrome. The extension should load and behave identically. Manual testing has not been performed.

---

## Brave

**Status: Expected to work (untested).**

Brave is Chromium-based and ships its own privacy features, but it still supports standard Chrome extensions via the Chrome Web Store and unpacked loading. The extension should work normally.

---

## Firefox

**Status: Not tested. May require changes.**

Firefox 109+ has Manifest V3 support, but there are differences:

- Firefox does not support `"service_worker"` in the `"background"` section; it requires `"scripts"` instead
- Some Chrome-specific APIs may not be available

The extension has not been tested on Firefox. It is not claimed as supported.

To attempt Firefox compatibility, the manifest's background section would need to conditionally use `"scripts": ["background.js"]` and the build would need a Firefox-specific output.

---

## Safari

**Status: Not supported.**

Safari uses the Web Extensions API which is broadly compatible, but requires code signing and distribution through the App Store or as a Safari Web Extension. This has not been implemented. Safari is not claimed as supported.

---

## Summary

| Browser | Claimed support | Notes |
|---|---|---|
| Chrome 120+ | ✅ Yes | Primary target |
| Edge 120+ | Likely but untested | Chromium-based |
| Brave | Likely but untested | Chromium-based |
| Firefox 109+ | Not supported | Would need manifest changes |
| Safari | Not supported | Would need packaging changes |
