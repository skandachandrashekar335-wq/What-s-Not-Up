# Privacy Model — What's Not Up

**What's Not Up is a local privacy tool. The extension does not collect, store, or transmit content. Privacy transformations are applied locally to content already rendered by the website.**

---

## Summary

| Question | Answer |
|---|---|
| Is there a backend? | No. The extension has no server. |
| Is there telemetry? | No. |
| Is there analytics? | No. |
| Are messages stored? | No. |
| Is message content transmitted? | No. |
| Are credentials accessed? | No. |
| Is network traffic intercepted? | No. |
| Are WhatsApp/Instagram APIs used? | No. |
| What is stored? | Your settings object only, in `chrome.storage.local`. |

---

## What the extension actually does

What's Not Up applies CSS-based visual blur and hide effects to WhatsApp Web and Instagram pages you are already viewing.

To decide *where* to apply those effects it inspects DOM elements the website has already rendered in your browser. It reads element tags, attributes and computed geometry. It does not collect, store, or transmit those elements or their content — it applies visual CSS effects to them locally and then forgets them.

The extension is a filter on your screen, not an interceptor of your data.

### What "local processing" means concretely

All detection runs synchronously inside the content script in the page's own process:

```
site renders DOM
      │
      ▼
content script inspects tags / attributes / computed shape
      │
      ▼
classification + ownership resolution   (in memory, per pass)
      │
      ▼
data-wnu-* attributes written           (in memory)
      │
      ▼
injected <style> matches those attributes ──► blur appears
```

There is no step in this pipeline that serialises page content, and no step with network access.

---

## Data collected

**None.**

The extension does not:

- collect, store, or transmit content from the pages it transforms
- record contact names, phone numbers, or group names
- access your WhatsApp or Instagram account credentials
- intercept or inspect the websites' network traffic
- store any page data of any kind
- run analytics, crash reporting, or usage tracking of any kind

---

## Data stored

The extension stores **only your own settings** using `chrome.storage.local`.

This storage is:

- local to your browser profile
- never synced (the extension uses `local`, not `sync`)
- never transmitted anywhere
- entirely within your control

The stored object looks like:

```json
{
  "wnu_settings": {
    "privacyEnabled": false,
    "blurMessages": true,
    "blurIntensity": 8,
    "revealMode": "hover"
  }
}
```

No page content, contact data, or any site information is ever stored.

---

## Permissions used

| Permission | Why it is required |
|---|---|
| `storage` | Save your settings locally |
| `tabs` | Let the popup detect which supported site is active and send control messages to the content script |
| `https://web.whatsapp.com/*` | Run the content script on WhatsApp Web only |
| `https://www.instagram.com/*` | Run the content script on Instagram only |

No other permissions are requested. There is no `webRequest`, no `<all_urls>`, no `activeTab` broadening, no `scripting`, no `cookies`, no `history`.

Notably absent:

- **No `webRequest` / `declarativeNetRequest`** — the extension cannot observe, modify, or block network traffic.
- **No `cookies`** — it cannot read session tokens.
- **No `history`** — it cannot see browsing activity.

---

## What the extension cannot do (by design)

- It does not collect, store, or transmit content
- It does not access anything on WhatsApp's or Instagram's servers
- It does not operate outside of `web.whatsapp.com` and `www.instagram.com`
- It cannot take screenshots of your screen (OS-level capability this extension does not have)

---

## How privacy mode works technically

When privacy mode is enabled, the extension:

1. Injects a `<style>` tag that applies `filter: blur(Xpx)` to elements identified by the current site's adapter
2. Attaches mouse/click event listeners to those elements for the reveal feature
3. Uses a `MutationObserver` to catch newly-loaded content (new messages, chat switches, scrolled-in posts and comments)
4. Re-applies protections automatically when you change settings — no page reload

When privacy mode is disabled, all CSS attributes are removed and all event listeners are cleaned up. The page returns to its normal state.

---

## Dev tooling

`scripts/whatsapp-live-diagnostic.js` is an optional, read-only console script for inspecting a real session when a fixture and the live DOM disagree.

- It is **never bundled**: webpack builds only the explicit entries, `tsconfig.json` includes only `src/**/*`, and ESLint lints only `src`.
- It never adds, removes, moves or edits any node, class, style or attribute.
- It never reads message text, captions, link URLs, credentials or cookies, and never uses `fetch`, XHR, WebSocket or `storage`.
- Output is tags, attributes and media **origins only**, printed to the console on your machine.

See [`development.md`](development.md).

---

## Third-party code

The extension bundles React (for the popup, settings, and onboarding UI) and no other third-party libraries with network access. React runs entirely locally.

There are no fonts, CDNs, analytics scripts, or remote resources of any kind. All icons are bundled with the extension.

---

## Contact

If you find a security issue, see [`security.md`](security.md).
