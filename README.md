# What's Not Up

**A privacy layer for WhatsApp Web and Instagram.**

![version](https://img.shields.io/badge/version-1.0.0-0F1117)
![tests](https://img.shields.io/badge/tests-259%20passing-4c1)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-0F1117)
![license](https://img.shields.io/badge/license-Apache--2.0-blue)

---

## Overview

What's Not Up is a browser extension that adds a local privacy layer to web messaging and social-media interfaces. It visually protects sensitive content already rendered in the browser without replacing the underlying service or transmitting message content to a backend.

> **WhatsApp remains WhatsApp.** What's Not Up only changes how sensitive content is displayed in your browser.

Put simply: it puts a blur in front of your messages, names, profile photos and media until you choose to reveal them. It runs on your computer, inside your browser.

- Runs entirely locally in your browser
- No backend, no telemetry, no analytics
- Does not store messages
- Does not transmit message content
- Does not use WhatsApp or Instagram APIs
- Does not intercept network traffic
- Does not automate WhatsApp in any way
- Does not collect credentials

Plain-language privacy details: [Is my WhatsApp data sent anywhere?](#is-my-whatsapp-data-sent-anywhere)

---

## Quick Start

No coding needed. Download, extract, load, done.

| # | Do this |
|---|---|
| 1 | Download the ZIP from the [Releases page](https://github.com/skandachandrashekar335-wq/What-s-Not-Up/releases) |
| 2 | Extract the ZIP |
| 3 | Open `chrome://extensions`, `edge://extensions` or `brave://extensions` |
| 4 | Turn **Developer mode** ON |
| 5 | Click **Load unpacked** |
| 6 | Select the extracted `whats-not-up` folder (the one with `manifest.json` inside) |
| 7 | Open [web.whatsapp.com](https://web.whatsapp.com/) |
| 8 | Click the extension icon to turn protection on and adjust it |

New to this? Follow the full step-by-step guide below — it's the same thing, explained slowly.

---

## Install What's Not Up

**You do not need to know programming, Git, Node.js, or npm to install the extension.**

This project is currently distributed as an unpacked browser extension — that means you install it directly from a folder you downloaded, rather than from an extension store. The steps below take about two minutes.

### Step 1 — Download the project

Go to the **[Releases page](https://github.com/skandachandrashekar335-wq/What-s-Not-Up/releases)**.

Open the latest release (**What's Not Up v1.0.0**) and under **Assets** download:

```
whats-not-up-v1.0.0.zip
```

Save it somewhere easy to find, such as your Downloads folder.

> **Note:** Do not use the green **Code → Download ZIP** button on the main page. That button gives you the project's *source code*, which is not a ready-to-install extension. Always use the **Releases** page.

### Step 2 — Extract the ZIP

**Windows:** right-click the ZIP file → **Extract All** → **Extract**.
**macOS:** double-click the ZIP file.
**Linux:** right-click → **Extract Here**.

You should now have a normal folder called `whats-not-up`.

> **Remember where this folder is.** You will need to point your browser at it in Step 5, and the browser will ask again after every browser update.

### Step 3 — Open your browser's extensions page

What's Not Up works in Chromium-based browsers. Pick yours:

| Browser | Type this in the address bar |
|---|---|
| Google Chrome | `chrome://extensions` |
| Microsoft Edge | `edge://extensions` |
| Brave | `brave://extensions` |

> **Firefox is not supported.** This project has not been tested in Firefox.

### Step 4 — Turn on Developer mode

On the extensions page, look for a switch labelled **Developer mode** and turn it **ON**.

You will usually find it in the top-right corner of the page, but the exact position varies between browsers. If you cannot see it, look along the top or bottom edge of the page.

**Why do I need Developer mode?**

Developer mode is required because this project is currently distributed as an unpacked browser extension rather than through the Chrome Web Store or another official extension store.

In short: **you are installing the extension from the project files you downloaded rather than from a browser extension store.** Developer mode simply allows a browser to load a local extension folder. It does not change how the extension behaves.

### Step 5 — Load the extension

With Developer mode ON, new buttons appear. Click **Load unpacked**.

A file picker will open. Navigate to where you extracted the download in Step 2, and select the **`whats-not-up`** folder.

**How to recognise the correct folder:** the folder you select must contain a file named `manifest.json`.

```
whats-not-up/
├── manifest.json   ← your browser needs THIS folder selected
├── background.js
├── content.js
├── popup.html
├── options.html
└── icons/
```

> **Do not select the ZIP file itself.** Extract it first, then select the extracted folder.

If you picked the right folder, the extension appears in your browser toolbar and the extensions page shows **What's Not Up v1.0.0** with no errors.

### Step 6 — Open WhatsApp Web

Go to [https://web.whatsapp.com/](https://web.whatsapp.com/) and log in normally, exactly as you usually would.

The extension starts protecting supported content according to the default privacy settings.

### Step 7 — Test it

1. Open a WhatsApp chat.
2. Look at a message, a contact name, or a profile photo.
3. If protection is on, it will appear blurred.
4. Click the **What's Not Up** icon in your toolbar to open the popup and change settings.

### What the controls do

| Control | What it does |
|---|---|
| **Privacy Mode** | The master switch. Turn it off and everything goes back to normal. |
| **Messages** | Blurs message text. |
| **Contact names** | Hides contact and group names. |
| **Profile photos** | Protects profile pictures. |
| **Images / videos / GIFs / stickers** | Protects shared media. |
| **Hover reveal** | Rest your mouse on blurred content to see it; move away and it blurs again. |
| **Click reveal** | Click blurred content to reveal it, click again to hide it. |
| **Temporary reveal** | Reveals content for a few seconds, then re-blurs it automatically. |
| **Blur intensity** | A slider that controls how strong the blur is (from light to heavy). |
| **Quick Lock** | Covers the whole screen with a privacy overlay, instantly. |
| **Max Privacy** | Turns every protection on at once. |
| **Emergency shortcut** | `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac) toggles privacy on and off. |
| **Blur on focus loss** | Optionally re-blurs when you switch to another window. |

Every control is independent. Turning off messages does not turn off profile photos, and so on.

---

## Uninstall

1. Open your browser's extensions page (`chrome://extensions`, `edge://extensions` or `brave://extensions`).
2. Find **What's Not Up**.
3. Click **Remove**.
4. Confirm the removal.

Removing the extension only removes the extension itself. It does not delete your WhatsApp messages, your WhatsApp account, or anything you have sent or received.

---

## Troubleshooting

### "Load unpacked" doesn't accept my folder

Your browser only accepts a folder that contains a valid `manifest.json`. Make sure:

- You **extracted** the ZIP first — you cannot select the ZIP file itself.
- You selected the extracted `whats-not-up` folder, not something nested inside it.
- The folder really contains `manifest.json` (check the file exists).

If your browser shows "Manifest file is missing or unreadable", you have selected the wrong folder.

### The extension appears but nothing is blurred

1. Make sure the extension is **enabled** (the toggle on the extensions page is on).
2. **Refresh** the WhatsApp Web tab.
3. Make sure you are using a supported Chromium browser — Chrome, Edge or Brave. Firefox is not supported.
4. Click the extension icon and check that **Privacy Mode** is on and that the specific categories you expect are switched on.

### Changes don't appear immediately

Settings are designed to update on a page that is already running — you normally do not need to refresh.

If something looks stuck, refreshing WhatsApp Web is a safe troubleshooting step, especially after WhatsApp has changed its page.

### WhatsApp looks different from what's described here

WhatsApp Web changes its page frequently. Some visual details in this guide may not match exactly what you see.

If a particular item is not protected, that is the extension failing safe: when it cannot confidently identify something, it leaves it visible rather than blurring the wrong thing.

---

## Is my WhatsApp data sent anywhere?

No. Here is exactly how it works, in plain terms:

- What's Not Up is a browser extension. It runs inside your browser, on your computer.
- Protection happens **locally in your browser**. The extension looks at the page WhatsApp has already drawn on your screen and adds a blur to it.
- It does **not** use a project backend to store or transmit WhatsApp messages. There is no server behind this project.
- It does **not** replace WhatsApp. You keep using WhatsApp Web exactly as normal — same account, same chats, same app.
- The extension **visually protects content already rendered by the webpage**. It changes what is drawn on your screen, not what is stored or sent.

What it does **not** claim:

- It does not encrypt anything, and it is not a security product.
- It cannot stop someone looking over your shoulder while you have content revealed.
- It cannot prevent screenshots or screen recording of your screen.
- It cannot stop WhatsApp or Meta from collecting data about you — that is WhatsApp's own behaviour, not something this extension controls.

Blur is a visual privacy aid for shared screens and shoulder surfing. It is not encryption.

Full detail: [`docs/privacy.md`](docs/privacy.md)

---

## Features

### Privacy controls

| Control | WhatsApp Web | Instagram |
|---|:---:|:---:|
| Privacy Mode (master switch) | ✓ | ✓ |
| Message protection | ✓ | — |
| Contact / group name protection | ✓ | — |
| Profile photo protection | ✓ | ✓ |
| Image protection | ✓ | ✓ |
| Video protection | ✓ | ✓ |
| GIF / sticker protection | ✓ | — |
| Document preview protection | ✓ | — |
| Link preview protection | ✓ | — |
| Chat-list preview protection | ✓ | — |
| Chat header protection | ✓ | — |
| Online status / typing / last-seen visibility | ✓ | — |
| Caption protection | — | ✓ |
| Comment protection | — | ✓ |

Every toggle is independent. Turning one category off never disables another, and a category that is off never absorbs one that is on.

### Reveal system

| Behaviour | Detail |
|---|---|
| Hover reveal | Move the pointer over blurred content to see it; leaving re-blurs it |
| Click reveal | Click to reveal, click again to hide |
| Temporary reveal | Reveals for a configurable duration, then re-blurs automatically |
| Emergency shortcut | `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) |
| Quick Lock | One-click full-screen privacy overlay |
| Max Privacy | Enables every protection at once |
| Focus-loss privacy | Optional blur when the window loses focus |
| Emergency overlay | Full-screen, modal, dismissible by click, `Esc`, or the shortcut |

Reveal operates on a **logical group**: hovering a message reveals its text, media, reply preview and reactions together, and re-blurs them together.

### Product

| Feature | Detail |
|---|---|
| Popup controls | Primary toggles, reveal mode, blur intensity, Quick Lock, Max Privacy |
| Options page | Full settings across seven sections |
| Onboarding | First-run explanation of what the extension does and does not do |
| Themes | Light / dark / system |
| Local persistence | Settings stored in `chrome.storage.local` only |
| Live settings updates | Toggle changes apply to the open page immediately — no reload, no polling |
| Dynamic content | `MutationObserver` catches messages, avatars and media as they render |

---

## How it works

```
Browser page
      ↓
Content Script
      ↓
Site Adapter
      ↓
Candidate Detection
      ↓
Category Classification
      ↓
Ownership / Group Resolution
      ↓
Local Privacy Engine
      ↓
Blur / Hide
      ↓
Reveal Controller
```

**Site adapters.** All site-specific knowledge lives in `src/content/sites/`. The privacy engine and DOM processor are site-agnostic; they receive a list of elements and never inspect a selector themselves. Adding support for a new site means adding an adapter, not editing the engine.

**Layered detection.** A target supplies exact selectors, an optional structural resolver, and an optional exclusion list. The resolver survives renamed markup because it does not depend on any single attribute.

**Category classification.** Every element is assigned exactly one privacy category (`message`, `name`, `photo`, `image`, `video`, `gif-sticker`, …). Classification is a pure function of the element, so two categories cannot claim the same node — which is what keeps the toggles independent.

**Ownership and groups.** A logical region (a message bubble, a chat header, a chat-list row) may contain many classified elements. The processor resolves exactly one **owner** per region and attaches a reveal group to it, so CSS `filter: blur()` is never applied twice to nested elements — stacked filters are visually irreversible and would make reveal impossible.

**MutationObserver.** New nodes and `src` attribute changes are batched and processed against the *current* settings. There is no full-document rescan per mutation and no polling.

**Local privacy engine.** Protection is a single injected `<style>` tag plus `data-wnu-*` attributes. Reveal state is an attribute too, so revealing is a style recalculation rather than a re-render.

---

## Architecture

### WhatsApp-specific detection

| Module | Responsibility |
|---|---|
| `src/content/sites/whatsapp/index.ts` | Target wiring: match modes, resolvers, exclusions |
| `src/content/sites/whatsapp/dom.ts` | Read-only DOM signal helpers and zone/token constants |
| `src/content/sites/whatsapp/avatar-resolver.ts` | Layered profile-photo detection |
| `src/content/sites/whatsapp/media-classifier.ts` | image / video / GIF / sticker classification |
| `src/content/selectors.ts` | Stable exact selector paths |

Detection relies on **structural context**, **conservative heuristics**, and **hard exclusions** — the GIF picker, sticker picker, emoji picker, dialogs and the chat list are ruled out before any positive signal is considered.

### Why layered detection?

WhatsApp Web's DOM is not a stable public API. It is auto-generated, it changes without notice, and `data-testid` values are routinely renamed. A selector table alone is therefore a single point of failure: if one testid moves, the element is not mis-detected, it is simply *never found* — and never blurred.

That was a real failure mode for this project. Profile photos, GIFs and stickers could be missed entirely while messages kept working, because a single stale selector silently disabled a whole category.

Detection is therefore layered, and each layer is independent positive evidence:

1. **Exact selectors** — stable `data-testid`/ARIA/attribute paths
2. **Attribute hints** — testid, class, `alt`, `aria-label`, media URL, on the element or a wrapping container
3. **Structural context** — chat pane, conversation header, message bubble, participant/list row
4. **Media characteristics** — circular clipping, square aspect, avatar-sized box, looping control-less video, canvas
5. **Category classification** — one pure function decides image vs video vs GIF vs sticker
6. **Conservative heuristics** — a rule only fires on positive evidence; anything ambiguous is rejected
7. **Hard exclusions** — picker tiles, dialogs and page chrome are removed before evaluation

When a layer cannot produce enough evidence — no `src`, no layout, an unknown structure, a malformed selector — it counts as **absent**. Absence can only stop an element from being claimed; it can never add one.

The consequence is deliberate: **low confidence means no blur, never a wrong blur.** A markup change shows up as visibly unblurred content you can report, rather than a WhatsApp logo, icon, or picker tile you did not ask to hide.

### Tech stack

| Technology | Role |
|---|---|
| TypeScript | `strict` mode throughout, `noUnusedLocals` / `noUnusedParameters` |
| React | Popup, options page, onboarding UI |
| Webpack | Bundling and production build |
| Manifest V3 | Extension manifest and service worker |
| Chrome/Edge extension APIs | `storage`, `tabs`, content scripts, runtime messaging |
| Vitest + jsdom | Automated test suite |
| CSS | Blur and hide effects via injected stylesheet |
| MutationObserver | Dynamic content detection |
| Chrome Storage API | Local settings persistence |

Runtime dependencies: `react`, `react-dom`. Nothing else.

### Engineering highlights

**Resilient DOM detection.** Detection is layered rather than selector-bound — exact selectors → attribute hints → structural context → shape → classification, with hard exclusions applied before any positive signal. This is the difference between a stale selector disabling a category silently and a redesign degrading gracefully.

**Media classification.** One pure function decides whether an element is an image, video, GIF or sticker. Because classification happens *before* targeting, categories are mutually exclusive by construction — which is what makes twelve independent toggles safe on a DOM where a GIF, a video and a photo can share identical structure.

**Profile-avatar detection.** Avatars are identified by context plus shape (circular clipping, chat-list row membership, avatar-sized box), never by blanket-matching every image. A shape signal alone is never sufficient.

**Nested DOM ownership.** CSS `filter` stacks, so a blurred parent cannot visually un-blur its child. The processor resolves exactly one owner per logical region and records explicit ownership rules, eliminating nested blur while keeping every category independently toggleable.

**Mutation-aware processing.** Insertions and `src` changes are batched and processed against current settings, scoped to the added subtree — no document-wide rescan per mutation, no polling, no observer loop.

**Live settings propagation.** `chrome.storage.onChanged` re-applies protection to the already-open page. Updates are coalesced per tick and identical payloads deduplicated, so a rapid toggle sequence produces exactly one re-apply.

**Category isolation.** Toggling one category off removes exactly that category's protection and never un-blurs another, including in the ownership map.

**Reveal grouping.** Reveal is registered on the logical group root, so nested content reveals and re-blurs as a unit.

**Minimal permissions.** `storage` and `tabs`, plus host access limited to the two supported origins. No `webRequest`, no `activeTab` broadening, no `<all_urls>`.

**Local-first architecture.** There is no backend to trust. Privacy transformations are applied to the local DOM only.

**Automated regression testing.** 259 tests across 14 files cover the engine, both site adapters, ownership, mutation handling, settings propagation, reveal behaviour and the overlay — with zero tests deleted or weakened.

---

## Privacy & security model

| | |
|---|---|
| Backend | None — the extension has no server |
| Telemetry | None |
| Analytics | None |
| Message database | None |
| Credential collection | None — it never touches a login form |
| Network interception | None — no `webRequest` permission |
| WhatsApp/Instagram API | None — it does not use them |
| Message transmission | None — no code path sends page content anywhere |

The extension operates only on content already rendered in the browser. It stores a small settings object in `chrome.storage.local` and nothing else.

- Privacy model: [`docs/privacy.md`](docs/privacy.md)
- Security and threat model: [`docs/security.md`](docs/security.md)
- Permissions: `storage`, `tabs`, `https://web.whatsapp.com/*`, `https://www.instagram.com/*`

---

## Supported browsers

| Browser | Status | Notes |
|---|---|---|
| Microsoft Edge | Verified | v1.0.0 manually tested with a logged-in WhatsApp Web session |
| Google Chrome | Same codebase | Standard MV3 APIs; not separately session-tested for v1.0.0 |
| Brave | Untested | Chromium-based |
| Firefox | **Not tested** | Not supported; would need manifest changes |
| Safari | Not supported | Would need packaging changes |

### Verification

The v1.0.0 release was **manually tested in Microsoft Edge with a real, logged-in WhatsApp Web session**, confirming:

- Profile photos blur (chat list, conversation header, group info)
- GIFs and stickers blur
- Messages, contact and group names blur
- Chat-list previews blur
- Images and videos blur
- Dynamic content arriving after load is protected
- Toggles apply live without a page reload
- Reveal behaviour works

Automated checks also pass: 259/259 tests, TypeScript, ESLint, production build, extension validation.

Notes on individual browsers: [`docs/browser-support.md`](docs/browser-support.md)

---

## For Developers

This section is for people who want to inspect, build or contribute to the project. **If you just want to use the extension, you do not need any of this** — see [Install What's Not Up](#install-whats-not-up) above.

### Requirements

- Node.js 18+
- npm 8+

### Clone and build

```bash
git clone https://github.com/skandachandrashekar335-wq/What-s-Not-Up.git
cd What-s-Not-Up
npm ci
npm run build
```

The built extension is written to **`dist/`**, which contains `manifest.json`, `content.js`, `background.js` and the popup/options/onboarding pages.

Load it in your browser from `edge://extensions` or `chrome://extensions` → **Developer mode** → **Load unpacked** → select the `dist` folder. After a rebuild, click the reload button on the extension card; you do not need to re-add it.

### Commands

Every command below exists in `package.json`.

| Command | What it does |
|---|---|
| `npm ci` | Clean install from `package-lock.json` |
| `npm run dev` | webpack watch mode, rebuilds on save |
| `npm run build` | Production build → `dist/`, then validates the extension |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint over `src` |
| `npm test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run validate:extension` | Manifest, icon, permission and bundle validation |

### Pre-commit validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:extension
```

All five must pass. Do not suppress a lint rule, relax `strict`, or skip a test to get a green result — fix the underlying problem.

### Project layout

```
src/
  manifest.json              MV3 manifest (source)
  shared/
    types.ts                 Shared types and DEFAULT_SETTINGS
    storage.ts               chrome.storage.local read/write/patch/reset
  content/
    index.ts                 Entry point: site detection, observer, storage listener
    dom-processor.ts         Adapter → engine bridge, ownership and reveal groups
    privacy-engine.ts        Site-agnostic CSS blur/hide engine
    query.ts                 Malformed-selector-safe query helpers
    selectors.ts             WhatsApp selector table
    overlay.ts               Emergency full-screen overlay
    sites/
      types.ts               SiteAdapter contract
      detect.ts              Hostname → adapter
      whatsapp/              WhatsApp adapter (dom, avatar-resolver, media-classifier)
      instagram/             Instagram adapter (selectors, structural resolvers)
  background/
    service-worker.ts        MV3 service worker
  popup/                     Popup UI (React)
  options/                   Settings page (React)
  onboarding/                Onboarding UI (React)
  icons/                     SVG + generated PNG icons
scripts/
  validate-extension.mjs     Manifest/icon/permission/bundle validation
  whatsapp-live-diagnostic.js  Read-only console diagnostic (dev tool, never bundled)
tests/                       14 test files
docs/                        Architecture, development, privacy, security, limitations
```

| Directory | Purpose |
|---|---|
| `src/content` | Everything injected into the page: detection, ownership, protection, reveal |
| `src/content/sites/whatsapp` | WhatsApp-specific detection — resolvers, classifiers, DOM signals |
| `src/content/sites/instagram` | Instagram-specific selectors and structural resolvers |
| `src/popup` | Quick-access controls |
| `src/options` | Full settings page |
| `src/background` | Service worker: install handling, action click, message relay |
| `src/content/overlay.ts` | Emergency full-screen privacy overlay |
| `tests` | Automated regression suite |
| `docs` | Architecture, development, privacy, security, limitations |

More detail: [`docs/development.md`](docs/development.md)

---

## Testing

**259 tests across 14 test files.** Zero tests deleted or weakened.

| Area | File | Tests |
|---|---|---:|
| WhatsApp media classification | `whatsapp-media.test.ts` | 43 |
| WhatsApp avatar detection | `whatsapp-photos.test.ts` | 33 |
| Privacy engine | `privacy-engine.test.ts` | 23 |
| Profile photos | `profile-photos.test.ts` | 22 |
| Instagram adapter | `instagram.test.ts` | 21 |
| Site detection | `site-detection.test.ts` | 17 |
| Overlay | `overlay.test.ts` | 16 |
| DOM ownership | `dom-processor.test.ts` | 16 |
| Settings propagation | `settings-sync.test.ts` | 16 |
| Mutation handling | `mutation-observer.test.ts` | 14 |
| Logical reveal groups | `logical-groups.test.ts` | 12 |
| Storage | `storage.test.ts` | 9 |
| Types and defaults | `types.test.ts` | 9 |
| Selector helpers | `selectors.test.ts` | 8 |

### Validation

All commands currently pass:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:extension
```

`npm run validate:extension` checks the manifest, icon integrity, required permissions, absence of broad host access, and the built bundle in `dist/`.

Tests run in jsdom against fixtures modelled on the current site markup. They do not require a live WhatsApp or Instagram session. See [`docs/testing.md`](docs/testing.md).

---

## Limitations

- WhatsApp and Instagram change their DOM without notice. Site support depends on what can be safely identified in that DOM, and adapter updates may be required after a redesign.
- If a structure cannot be identified with confidence, content is left visible rather than wrongly blurred.
- Instagram **direct messages are not implemented**.
- Instagram **Stories viewer is not implemented**.
- Instagram **Reels viewer is not implemented**.
- Logged-out Instagram feed pages redirect to login and were not verified.
- Firefox has not been tested.
- The extension cannot prevent OS-level screenshots or screen recording.
- GIFs continue to load behind the blur; CSS cannot pause them.

Full list: [`docs/limitations.md`](docs/limitations.md)

---

## Roadmap

Possible future directions, not commitments:

- Stronger DOM resilience as sites evolve
- Broader browser verification
- Improved site adapters
- More automated browser-level integration tests
- Additional privacy controls

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Extension architecture, content script lifecycle, detection pipeline, ownership and reveal models |
| [`docs/development.md`](docs/development.md) | Setup, commands, build, debugging, diagnostic script |
| [`docs/privacy.md`](docs/privacy.md) | Privacy model in precise technical terms |
| [`docs/security.md`](docs/security.md) | Permissions, threat model, limitations |
| [`docs/limitations.md`](docs/limitations.md) | Known limitations and site compatibility |
| [`docs/testing.md`](docs/testing.md) | Test coverage and manual verification checklists |
| [`docs/browser-support.md`](docs/browser-support.md) | Browser support notes |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |

---

## License

Licensed under the [Apache License 2.0](LICENSE).
