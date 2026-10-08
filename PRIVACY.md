# Privacy Policy — What's Not Up

**What's Not Up is a local privacy tool. The extension does not collect, store, or transmit content. Privacy transformations are applied locally to content already rendered by the website.**

---

## What the extension does

What's Not Up applies CSS-based visual blur and hide effects to the WhatsApp Web and Instagram pages you are already viewing. To do this, it inspects DOM elements that the website has already rendered in your browser in order to identify which elements to apply transformations to. It does not collect, store, or transmit those elements or their content — it only applies visual CSS effects to them locally.

The extension is a filter on your screen, not an interceptor of your data.

## Data collected

**None.**

The extension does not:
- collect, store, or transmit content from the pages it transforms
- record contact names, phone numbers, or group names
- access your WhatsApp or Instagram account credentials
- intercept or inspect the websites' network traffic
- store any page data of any kind

## Data stored

The extension stores **only your own settings** using the browser's built-in `chrome.storage.local` API. This storage is:
- local to your browser profile
- never synced to any server (we use `local`, not `sync`)
- never transmitted anywhere
- entirely within your control

The stored object looks like:

```json
{
  "wnu_settings": {
    "privacyEnabled": false,
    "blurMessages": true,
    "blurIntensity": 8,
    "revealMode": "hover",
    ...
  }
}
```

No page content, contact data, or any site information is ever stored.

## Permissions used

| Permission | Why |
|---|---|
| `storage` | To save your settings locally |
| `tabs` | So the popup can detect which supported site you're on and send control messages to the content script |
| `https://web.whatsapp.com/*` | To run the content script on WhatsApp Web only |
| `https://www.instagram.com/*` | To run the content script on Instagram only |

No other permissions are requested. The extension does not have access to any other websites.

## What the extension cannot do (by design)

- It does not collect, store, or transmit content — privacy transformations are applied locally to content already rendered by the website
- It does not access anything on WhatsApp's or Instagram's servers
- It does not operate outside of `web.whatsapp.com` and `www.instagram.com`
- It cannot take screenshots of your screen (that is an OS-level capability this extension does not have)

## How privacy mode works technically

When privacy mode is enabled, the extension:
1. Injects a `<style>` tag that applies `filter: blur(Xpx)` to elements identified by the current site's adapter (WhatsApp Web or Instagram)
2. Attaches mouse/click event listeners to those elements for the reveal feature
3. Uses a `MutationObserver` to catch newly-loaded content (new messages, chat switches, scrolled-in posts and comments)
4. Re-applies protections automatically when you change settings — no page reload

When privacy mode is disabled, all CSS attributes are removed and all event listeners are cleaned up. The page returns to its normal state.

## Third-party code

The extension bundles React (for the popup, settings, and onboarding UI) and no other third-party libraries with network access. React runs entirely locally.

## Contact

If you find a security issue, see [SECURITY.md](SECURITY.md).
