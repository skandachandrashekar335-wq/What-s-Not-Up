# Architecture

What's Not Up is a standard Manifest V3 Chromium extension. It has four entry points and a shared library layer.

---

## System overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser page (web.whatsapp.com / www.instagram.com)           │
│  DOM already rendered by the site                              │
└────────────────────────────┬────────────────────────────────────┘
                             │  read-only inspection
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Content script                                                 │
│                                                                 │
│   Site detection ──► Site adapter ──► Candidate detection        │
│                                          │                      │
│                                          ▼                      │
│                                   Category classification       │
│                                          │                      │
│                                          ▼                      │
│                              Ownership / group resolution       │
│                                          │                      │
│                                          ▼                      │
│                                Local privacy engine             │
│                                          │                      │
│                                          ▼                      │
│                              Blur / hide  ◄── Reveal controller │
└────────────────────────────┬────────────────────────────────────┘
                             │  chrome.storage.local
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Popup / Options / Service worker                               │
│  write settings ──► storage.onChanged ──► live re-apply         │
└─────────────────────────────────────────────────────────────────┘

No request ever leaves the browser. There is no backend.
```

---

## Entry points

### Content script (`src/content/index.ts`)

Injected into `https://web.whatsapp.com/*` and `https://www.instagram.com/*` pages.

**Lifecycle:**

```
page load
   │
   ▼
detectAdapter(hostname)          ── unknown host ⇒ no-op, nothing runs
   │
   ▼
loadSettings()                   ── chrome.storage.local, merged over defaults
   │
   ▼
applySettingsToDOM()             ── inject style, remove old, apply protections
   │
   ├──► startMutationObserver()  ── childList + subtree + src attribute changes
   ├──► attachKeyboardShortcut() ── Ctrl/Cmd+Shift+P
   ├──► attachFocusListeners()   ── blur / focus for focus-loss privacy
   └──► attachStorageListener()  ── chrome.storage.onChanged, registered once
   │
   ▼
steady state
   ├─ mutation batch ──► processNewNodes()   (scoped, no full rescan)
   └─ storage change ──► handleSettingsUpdate()
                              │  coalesced to one microtask
                              │  identical payloads deduplicated
                              ▼
                         full teardown + re-apply
```

Responsibilities:

- Detect the current site and load its adapter (`src/content/sites/detect.ts`)
- Load settings from storage on page load
- Apply initial protections via the DOM processor
- Start the MutationObserver to catch dynamically loaded content
- Listen to `chrome.storage.onChanged` so setting changes re-process the live DOM immediately, without a reload
- Handle the keyboard shortcut (Ctrl/Cmd+Shift+P)
- Listen for window focus/blur if auto-blur is enabled
- Receive messages from the popup and service worker (deduplicated against storage events)

The extension does not collect, store, or transmit content. Privacy transformations are applied locally to content already rendered by the website; the content script only manipulates DOM attributes.

### Service worker (`src/background/service-worker.ts`)

The MV3 background context. Responsibilities:

- Open the onboarding page on first install
- Handle the toolbar icon click (toggle privacy mode as a fallback when popup is not set)
- Relay the `OPEN_ONBOARDING` message from the content script

The service worker is event-driven and does not maintain state beyond what's in storage.

### Popup (`src/popup/`)

A React app loaded in the extension popup. Identifies the active tab's site (`siteIdForUrl`) and shows only the toggles that apply to it. Changes are written to `chrome.storage.local`; the content script picks them up through `chrome.storage.onChanged`. A `SETTINGS_UPDATED` message is also sent as a redundant path — the content script deduplicates identical updates, so the two paths cannot cause double work. No page reload is required.

### Options page (`src/options/`)

A full-page React settings UI. Opened via `chrome.runtime.openOptionsPage()`. Structured into sections: Privacy, Content Protection, Reveal Behaviour, Focus Behaviour, Appearance, Advanced, Reset. Uses the same storage layer as the popup.

---

## Settings and storage flow

```
        popup / options                      content script
              │                                     ▲
              │ patchSettings()                     │
              ▼                                     │
   chrome.storage.local ──── onChanged ────► handleSettingsUpdate()
                                                 │
                                    settingsEqual()? ── yes ─► ignore (dedupe)
                                                 │ no
                                                 ▼
                                        queueMicrotask (coalesce)
                                                 │
                                                 ▼
                                         flushSettingsApply()
                                                 │
                                    privacyEnabled off? ── yes ─► remove all
                                                 │ no
                                                 ▼
                              injectStyles → removeProtections → applyProtections
                                                 → updateRevealMode
```

Two properties matter here:

- **No reload, no polling.** A toggle is visible on the open page within the same tick.
- **One re-apply per tick.** Rapid toggles collapse into a single teardown/re-apply, and identical payloads are deduplicated so the redundant message path cannot double the work.

---

## Shared library

### `src/shared/types.ts`

All TypeScript types. The `PrivacySettings` interface is the single source of truth for the settings schema. `DEFAULT_SETTINGS` is the canonical default state.

### `src/shared/storage.ts`

Four functions: `loadSettings`, `saveSettings`, `patchSettings`, `resetSettings`. All use `chrome.storage.local`. Merges stored values over defaults on load so new fields added in future versions are always populated.

---

## Content script internals

### `src/content/sites/` — site adapters

Each supported site implements the `SiteAdapter` contract (`sites/types.ts`):

- `id` / `host` — site identity
- `groupRoots` — stable selectors for containers whose contents form one logical reveal group (WhatsApp message rows, conversation header)
- `targets[]` — privacy categories, each mapped to a settings toggle, a list of selectors, a `match: 'first' | 'union'` mode, an optional structural `resolve(root)` function for content with no stable selector, and an optional `exclude` list of hard-exclusion selectors
- `exclude` — site chrome that shares a token with real content (pickers, dialogs, the chat list). Applied by the DOM processor to **both** selector matches and resolver output, so neither path can leak past it

`detect.ts` maps a hostname to an adapter; unsupported hosts get a no-op adapter, so nothing is blurred.

Resolvers are fail-safe: when they cannot identify content they return nothing, which means no blur.

### `src/content/selectors.ts`

WhatsApp Web's selector table — arrays of CSS selectors per element type, tried in priority order. Used only by the WhatsApp adapter. Also exports `queryAll` and `queryOne` — both silently skip malformed selectors and return an empty result rather than throwing (generic helpers live in `src/content/query.ts`).

---

## WhatsApp detection pipeline

```
adapter target (selectors + resolver + exclusions)
      │
      ▼
┌─── L0  exact selectors ──────────────────────────────────────────┐
│     stable data-testid / ARIA / attribute paths                  │
└──────────────────────────────────────────────────────────────────┘
      │  (resolver also runs)
      ▼
┌─── L1  hard exclusions ──────────────────────────────────────────┐
│     message content, media cells, text runs, pickers, dialogs    │
│     applied to selector matches AND resolver output              │
└──────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─── L2  attribute hints ──────────────────────────────────────────┐
│     testid / class / alt / aria-label / media URL                │
│     on the element or a wrapper within 3 levels                  │
└──────────────────────────────────────────────────────────────────┘
      │  (if no hint)
      ▼
┌─── L3  structural context ───────────────────────────────────────┐
│     chat pane, conversation header, message bubble, list row,    │
│     info drawer — a shape signal alone is never sufficient       │
└──────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─── L4  visual shape / media characteristics ─────────────────────┐
│     circular clipping · chat-list row membership ·               │
│     square aspect · avatar-sized box · looping control-less      │
│     video · canvas · marker attributes                           │
└──────────────────────────────────────────────────────────────────┘
      │
      ▼
   claim  ──or──  reject (absence can only stop, never add)
```

| Module | Role |
|---|---|
| `sites/whatsapp/index.ts` | Target wiring: match modes, resolvers, exclusions |
| `sites/whatsapp/dom.ts` | Read-only signal helpers and zone/token constants |
| `sites/whatsapp/avatar-resolver.ts` | Layered profile-photo detection (L0–L4) |
| `sites/whatsapp/media-classifier.ts` | Pure classification: `image \| video \| gif \| sticker \| null` |
| `selectors.ts` | Stable exact selector paths |

**Media classification is a pure function of the element.** Because it runs before targeting, two categories can never claim the same node. That is the mechanism behind twelve independent toggles: a GIF is classified once, as a GIF, regardless of which target is evaluated first.

**Fail-safe rule.** When a signal cannot be determined — no `src`, no layout, unknown structure, malformed selector — it counts as *absent*. Absence can only stop a candidate from being produced. Low confidence means **no blur**, never a wrong blur.

---

## Ownership model

CSS `filter` stacks. A blurred parent cannot visually un-blur its child, so two nested protected elements would make reveal impossible for the inner one and produce a visibly darker "double blur" patch.

```
 message bubble (logical region)
 ┌──────────────────────────────────────────┐
 │  ┌────────────────────────────────────┐  │
 │  │ .selectable-text   candidate       │  │  candidates
 │  └────────────────────────────────────┘  │
 │  ┌────────────────────────────────────┐  │
 │  │ [data-testid=gif]   candidate      │  │  candidates
 │  │   └─ <img>          candidate      │  │  candidates
 │  └────────────────────────────────────┘  │
 │                                          │
 │  ⇒ outermost candidate owns the region   │
 │  ⇒ inner candidates keep data-wnu-type   │
 │    but NOT data-wnu-protected            │
 └──────────────────────────────────────────┘
```

Explicit rules, documented in `dom-processor.ts`:

1. **Single owner.** One logical region has exactly one element carrying `data-wnu-protected`.
2. **Outermost wins.** If an ancestor is also a candidate, it owns the region. Inner elements are still *classified* so their toggle has a bookkeeping anchor — they are blurred by living inside their owner, never independently.
3. **Cross-category absorption is intentional.** A photo inside a conversation header is absorbed by the header owner, which keeps the header one visual unit. A category that is toggled off never enters the candidate map, so it cannot absorb anything.
4. **Covered short-circuit.** An already-protected ancestor means the region is done; the element is skipped instead of re-protecting an ancestor.
5. **No cross-region absorption.** Siblings never absorb each other — a chat-list row's name, preview and avatar each keep their own owner and reveal group.

---

## Reveal model

```
reveal group root  (msg-container / conversation-header / comment row)
   │
   │  hover / click / timer
   ▼
root gets data-wnu-revealed
   │
   ├──► every protected owner in the group gets data-wnu-revealed
   │
   ▼
CSS: [data-wnu-revealed] .wnu-protected { filter: blur(0) }
   │
   │  pointer leaves / timer expires
   ▼
attribute removed ──► everything re-blurs together
```

Because reveal is registered on the **group root**, nested content reveals and re-blurs as a unit rather than element by element. Categories stay independent because a group is only registered from owners that were actually protected: with GIFs off, the GIF is neither an owner nor part of the group.

Reveal state is an attribute, not a re-render, so revealing is a style recalculation.

---

## MutationObserver

```
MutationObserver(document.documentElement,
                 { childList, subtree, attributes: ['src'] })
      │
      ▼
handleMutations()          ── privacy disabled? ⇒ return immediately
      │
      ├── collect added elements + src-change targets
      │
      ▼
scheduleFrame(batch)       ── requestAnimationFrame: rapid mutations
      │                        collapse into one frame
      ▼
processNewNodes(batch)     ── prune disconnected groups
      │
      ├── drop nodes nested inside another added node
      │     (their subtree is already covered)
      ▼
processScope(node)         ── scope = the added subtree ONLY
```

- **No document-wide rescan per mutation.** Processing is scoped to the added subtree.
- **No polling.** Everything is event-driven.
- **No observer loop.** The extension writes `data-wnu-*`, which is not in `attributeFilter`; only `src` is observed, and the extension never writes `src`.
- **`src` is observed** because WhatsApp lazy-loads avatars and populates media URLs after the element exists.

A full teardown/re-apply happens **only** on a settings change, never per mutation.

---

## Privacy engine

A generic CSS engine. Has no knowledge of any particular site. Takes DOM elements and:

- Sets/removes `data-wnu-protected` (triggers CSS blur)
- Sets/removes `data-wnu-hidden` (triggers `visibility: hidden`)
- Registers logical reveal groups: reveal listeners attach to the group root, and revealing sets `data-wnu-revealed` on the root and every protected owner in the group so nested content reveals and re-blurs together
- Attaches the appropriate reveal event listeners based on `revealMode`
- Manages timers for temporary reveal

The CSS is injected via a single `<style id="wnu-privacy-styles">` tag. Updating blur intensity rewrites that one tag — no per-element inline styles.

### `src/content/overlay.ts`

Creates and removes the emergency full-screen overlay div. It is a modal `role="dialog"` that takes focus on show, is dismissed by click, `Esc`, or the keyboard shortcut, and returns focus to the previously focused element. Self-contained; no external dependencies.

---

## Message protocol

Communication follows a typed union pattern. All messages are defined in `src/shared/types.ts` as `ExtensionMessage`. The content script handles:

| Message type | Effect |
|---|---|
| `PING` | Returns `PONG` (liveness check) |
| `GET_PRIVACY_STATE` | Returns current `privacyEnabled` |
| `SET_PRIVACY_ENABLED` | Toggles privacy without a full settings update |
| `SETTINGS_UPDATED` | Full settings replacement, re-applies protections |
| `QUICK_LOCK` | Shows the overlay |

Settings changes propagate primarily through `chrome.storage.onChanged`: a single listener is registered once, coalesces bursts of updates into one re-apply (microtask), and on a real change tears down and re-applies protections against the live DOM. `SETTINGS_UPDATED` is a redundant second path; identical payloads are deduplicated so nothing runs twice.

---

## Build

Webpack 5 with ts-loader. Five entry points: `background`, `content`, `popup`, `options`, `onboarding`. CSS is extracted via MiniCssExtractPlugin. HTML pages are generated by HtmlWebpackPlugin. Icons and the manifest are copied with CopyWebpackPlugin.

Output is in `dist/`. The dist folder is what gets loaded as the unpacked extension.

Because webpack builds only these explicit entries, `scripts/whatsapp-live-diagnostic.js` is never bundled and never ships.
