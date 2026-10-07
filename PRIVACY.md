# Privacy Policy — What's Not Up

**What's Not Up is a local privacy tool. It does not collect, transmit, or store any message content.**

---

## What the extension does

What's Not Up applies CSS-based visual blur and hide effects to the WhatsApp Web page you are already viewing. It is a filter on your screen, not an interceptor of your data.

## Data collected

**None.**

The extension does not:
- read the content of your messages
- record contact names, phone numbers, or group names
- access your WhatsApp account credentials
- intercept or inspect WhatsApp's network traffic
- store any WhatsApp data of any kind

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

No message content, contact data, or any WhatsApp information is ever stored.

## Permissions used

| Permission | Why |
|---|---|
| `storage` | To save your settings locally |
| `tabs` | So the popup can detect if you're on WhatsApp Web and send control messages to the content script |
| `https://web.whatsapp.com/*` | To run the content script on WhatsApp Web only |

No other permissions are requested. The extension does not have access to any other websites.

## What the extension cannot do (by design)

- It cannot read your encrypted messages — WhatsApp's end-to-end encryption is unaffected
- It cannot access messages on WhatsApp's servers
- It cannot operate outside of `web.whatsapp.com`
- It cannot take screenshots of your screen (that is an OS-level capability this extension does not have)

## How privacy mode works technically

When privacy mode is enabled, the extension:
1. Injects a `<style>` tag that applies `filter: blur(Xpx)` to elements matching WhatsApp's DOM structure
2. Attaches mouse/click event listeners to those elements for the reveal feature
3. Uses a `MutationObserver` to catch newly-loaded content (new messages, chat switches)

When privacy mode is disabled, all CSS attributes are removed and all event listeners are cleaned up. The page returns to its normal state.

## Third-party code

The extension bundles React (for the popup, settings, and onboarding UI) and no other third-party libraries with network access. React runs entirely locally.

## Contact

If you find a security issue, see [SECURITY.md](SECURITY.md).
