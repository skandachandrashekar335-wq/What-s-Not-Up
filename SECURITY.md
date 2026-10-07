# Security Policy — What's Not Up

## Scope

What's Not Up is a browser extension that applies visual effects to WhatsApp Web. Its attack surface is limited:

- The extension runs only on `https://web.whatsapp.com`
- It does not handle credentials, payment data, or sensitive user information
- It does not make any network requests of its own
- Settings are stored locally in `chrome.storage.local`

## Reporting a vulnerability

If you find a security issue — for example, a way for a malicious web page to affect the extension's behaviour, a permissions issue, or an unintended data exposure — please report it by opening a GitHub issue with the label `security`.

For issues involving user data or anything sensitive, you can also email the repository owner directly (contact details in the GitHub profile).

Please include:
- A description of the issue
- Steps to reproduce
- The browser and extension version
- What impact you believe it has

## What is in scope

- XSS or script injection via the extension's own UI pages (popup, options, onboarding)
- Privilege escalation through the content script or service worker
- Unintended data access beyond `web.whatsapp.com`
- Settings being readable or writable by a third-party page

## What is out of scope

- WhatsApp Web's own security (not our code)
- The user's operating system or browser security
- Social engineering
- Physical shoulder-surfing (the extension mitigates this but cannot prevent determined physical observation)
- The fact that WhatsApp Web requires an active phone connection (not our code)

## Supported versions

Only the latest version published to the repository is maintained. There are no backport patches.
