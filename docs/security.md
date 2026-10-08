# Security — What's Not Up

## Scope

What's Not Up is a browser extension that applies visual effects to WhatsApp Web and Instagram. Its attack surface is deliberately small:

- It runs only on `https://web.whatsapp.com` and `https://www.instagram.com`
- It does not handle credentials, payment data, or sensitive user information
- It makes no network requests of its own
- Settings are stored locally in `chrome.storage.local`

---

## Security posture

### Minimal permissions

```json
"permissions": ["storage", "tabs"],
"host_permissions": [
  "https://web.whatsapp.com/*",
  "https://www.instagram.com/*"
]
```

| Permission | Justification |
|---|---|
| `storage` | Persist settings locally |
| `tabs` | Popup detects the active tab's site and sends control messages |
| host permissions | Content script is injected on exactly two origins |

Explicitly **not** requested: `webRequest`, `declarativeNetRequest`, `scripting`, `cookies`, `history`, `downloads`, `nativeMessaging`, `<all_urls>`.

### No backend

There is no server component. The extension cannot exfiltrate data because there is no destination and no code path that performs network I/O on page content.

### No telemetry or analytics

No tracking SDK, no crash reporter, no usage metrics, no remote config.

### No credential access

The content script never reads form inputs, never touches login flows, and never inspects `document.cookie` or storage belonging to the sites.

### No network interception

Without `webRequest`/`declarativeNetRequest` the extension cannot observe, modify, or block requests. It is structurally incapable of traffic interception.

### Local DOM processing

Detection and classification run synchronously in the content script and are expressed as `data-wnu-*` attributes plus one injected `<style>` element. Page content is never serialised, persisted, or sent anywhere.

---

## Threat model

### Assets

| Asset | Location |
|---|---|
| WhatsApp/Instagram page content | The site's own page memory — never touched by us beyond reading tags/attributes |
| Your settings | `chrome.storage.local`, browser profile only |
| Session credentials | Held by the sites — out of reach (no `cookies`, no form access) |

### Adversaries and mitigations

| Adversary | Risk | Mitigation |
|---|---|---|
| A malicious page trying to drive the extension | Page sends crafted DOM hoping to trigger unintended behaviour | The extension only *reads* the DOM and writes its own `data-wnu-*` attributes. It has no message handler that executes page-supplied code. Unknown hosts get a no-op adapter — no styles, no observer, no listeners. |
| A malicious extension page (popup/options) | Cross-context messages | All messages are a typed union in `src/shared/types.ts`; handlers are a closed `switch` with no dynamic evaluation. |
| A third-party page reading settings | Settings leak | `chrome.storage.local` is inaccessible to ordinary web pages. |
| Supply-chain dependency | Malicious package | Exactly two runtime dependencies: `react`, `react-dom`. Everything else is dev-only. |
| Accidental data exposure by the user | Sharing diagnostics | The diagnostic script prints tags, attributes and media origins only — never text nodes, never full URLs. |
| Over-broad blur | Blurring UI the user needs | Detection fails safe: low confidence yields **no blur**, never a wrong blur. Hard exclusions rule out pickers, dialogs and page chrome before any positive signal. |

### Residual risks / limitations

- The extension runs with the page's privileges on two origins; a compromise of the extension would have those privileges. This is inherent to content-script extensions.
- Blur is a visual effect, not encryption. It does not prevent OS-level screenshots or screen recording.
- The extension cannot prevent the sites themselves from collecting data about you.
- CSS blur reduces shoulder-surfing risk but is not a cryptographic guarantee against an attacker with access to your machine.

---

## Reporting a vulnerability

If you find a security issue — for example, a way for a malicious web page to affect the extension's behaviour, a permissions issue, or an unintended data exposure — please report it by opening a GitHub issue with the label `security`.

For issues involving user data or anything sensitive, you can also contact the repository owner directly through their GitHub profile.

Please include:

- A description of the issue
- Steps to reproduce
- The browser and extension version
- What impact you believe it has

## What is in scope

- XSS or script injection via the extension's own UI pages (popup, options, onboarding)
- Privilege escalation through the content script or service worker
- Unintended data access beyond `web.whatsapp.com` and `www.instagram.com`
- Settings being readable or writable by a third-party page
- Any path that transmits page content off the machine

## What is out of scope

- WhatsApp Web's and Instagram's own security (not our code)
- The user's operating system or browser security
- Social engineering
- Physical shoulder-surfing (the extension mitigates this but cannot prevent determined physical observation)
- The fact that WhatsApp Web requires an active phone connection (not our code)

## Supported versions

Only the latest version published to the repository is maintained. There are no backport patches.
