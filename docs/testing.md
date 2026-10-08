# Testing

## Running the tests

```bash
npm test            # single run
npm run test:watch  # watch mode
npm run test:coverage  # with coverage report
```

Tests use Vitest in a jsdom environment. There is no dependency on a real browser or a live WhatsApp/Instagram session. 259 tests across 14 files.

---

## What is tested

### `tests/types.test.ts` — 9 tests

Verifies `DEFAULT_SETTINGS` has the expected values: privacy disabled by default, all protection toggles on (including captions and comments), hover reveal mode, sensible intensity and duration, focus-loss blur off, onboarding incomplete, system theme.

### `tests/storage.test.ts` — 9 tests

- `loadSettings`: returns defaults on empty storage, merges stored values over defaults, handles missing new fields (schema migration), handles `chrome.runtime.lastError` gracefully
- `saveSettings`: persists and reads back correctly, rejects on storage write error
- `patchSettings`: merges a partial update without losing other fields
- `resetSettings`: restores defaults after changes

### `tests/privacy-engine.test.ts` — 23 tests

- Style injection: creates `<style>` tag, correct blur value, clamping (min 1, max 40), idempotency, removal
- Element protection: sets `data-wnu-protected`, idempotency, correct mode/duration attributes
- Element unprotection: removes all wnu attributes
- `unprotectAll`: clears all protected and hidden elements
- Hide/unhide: sets/removes `data-wnu-hidden`
- Reveal interactions:
  - Hover mode: reveals on mouseenter, re-hides on mouseleave
  - Click mode: toggles on each click
  - Temporary mode: reveals on click, auto-hides after configurable duration (using fake timers)
- `updateRevealMode`: updates mode attribute on already-protected elements
- `clearAllTimers`: safe to call with no active timers

### `tests/dom-processor.test.ts` — 16 tests

Uses a fake WhatsApp-like DOM. Verifies:
- Privacy off → no elements protected
- Messages, names, previews, profile photos are protected when their toggles are on
- Online status and typing indicators are hidden
- Toggles off → element type skipped
- Type attributes set correctly
- Idempotency (calling applyProtections twice doesn't stack attributes)
- `removeProtections` clears all protections and un-hides status elements
- `processNewNodes` protects newly injected elements
- `processNewNodes` respects privacy disabled
- `unprotectByType` removes only the specified type, leaves others intact

### `tests/logical-groups.test.ts` — 12 tests

Regression tests for the nested-blur bug:
- One logical region gets exactly one owning privacy element (nested selector matches are deduplicated to the outermost owner)
- A protected parent contains no protected children (no stacked CSS filters)
- Hovering a group root reveals every protected owner in the group together, and re-blurring restores all of them
- Reveal state survives newly added protected elements inside a revealed group
- Disconnecting a group root prunes its listeners

### `tests/settings-sync.test.ts` — 16 tests

Regression tests for the settings-require-reload bug:
- `chrome.storage.onChanged` re-applies protections on the live DOM with no reload
- Other storage keys and other storage areas are ignored
- Enabling/disabling a category immediately affects already-rendered elements
- Disabling privacy mode removes everything; stale reveal state is dropped
- MutationObserver uses the latest settings for newly inserted nodes
- The storage listener is registered exactly once across repeated updates
- Identical updates coalesce into a single re-apply; the popup message path deduplicates against the storage event
- Rapid different updates apply the latest one

### `tests/site-detection.test.ts` — 17 tests

- Hostname → adapter: `web.whatsapp.com` → WhatsApp, `www.instagram.com` → Instagram
- Unsupported hosts get a no-op adapter (no DOM processing)
- `init()` guards: no duplicate MutationObserver/storage listeners on repeated calls

### `tests/profile-photos.test.ts` — 22 tests

WhatsApp profile photos against a modern chat-list / conversation-header / group-info fixture:
- Chat-list avatars, header avatar, group-info avatars are protected per their toggle
- False positives rejected: message media, previews, status/nav icons, emoji, search and attach icons, WhatsApp logo, extension UI
- Ownership: a header avatar covered by the header owner is not double-blurred; one owner per region
- Category independence: turning photos off never disables messages/names; turning messages off never disables photos
- Live settings: toggle off/on updates already-rendered avatars with no reload
- Dynamic avatars: inserted after the first scan, `src` changed after insertion

### `tests/whatsapp-photos.test.ts` — 33 tests

Layered avatar detection (the profile-photo release fix):
- Each detection layer independently (hint attribute, CDN URL, circular clipping, chat-list row, square + avatar-sized)
- Multiple selectors and the resolver agree; the resolver returns the `<img>`, never a wrapper
- Lazy/absent `src` and `src` populated after rendering
- False positives rejected across every non-avatar surface
- Ownership/reveal: single blur owner, the whole header/row reveals together, no nested protection
- Category independence and live settings re-apply
- A guard test asserting no unscoped generic `img` selector is used by the photo target

### `tests/whatsapp-media.test.ts` — 43 tests

GIF/sticker classification (the GIF/sticker release fix):
- Detection across real representations: stable testid, renamed testid (no exact selector matches), CDN-only `src`, wrapper label, canvas sticker, looping control-less video, marker attribute, aria label
- Each category claims only its own kind (image vs video vs GIF vs sticker vs nothing)
- False positives rejected: real videos, photo messages, inline emoji, GIF/sticker picker tiles, chat-list art, profile photos, names, message text
- Category independence in both directions (GIFs off + messages on, GIFs on + messages off, images/photos off)
- Ownership/reveal: wrapper + image collapsed to one owner, the whole message bubble reveals text and GIF together, neighbours stay hidden, idempotent
- Live settings re-apply and dynamic insertion

### `tests/mutation-observer.test.ts` — 14 tests

The real observer started by `init()`, not a direct call to `processNewNodes`:
- Late-inserted message, GIF, sticker and chat-list avatar are protected
- `src` populated after insertion re-evaluates the element
- Late content uses the current settings
- Scoped processing: unrelated classification bookkeeping and in-flight reveal state survive a mutation (no document-wide teardown), and mutations never trigger a settings re-apply
- Termination: no DOM churn after the batch settles, no duplicated protection when the same subtree is re-reported, exactly one observer across repeated `init()` calls, no protection while privacy mode is off

### `tests/instagram.test.ts` — 21 tests

Runs the real Instagram adapter against a fixture shaped like a logged-out public profile and post permalink page:
- Profile photos, grid/post images, videos/reels are protected per their toggles
- Captions protected exactly (not header/timestamp); comments protected as whole rows
- Structural resolvers: return expected items, return empty on a media-only grid, tolerate a detached root
- Never protects navigation, buttons, inputs, generic `div/span/img`, or extension UI
- Never creates nested blur layers
- Reveal: a comment row reveals as one unit and re-blurs; rows stay separate groups

### `tests/selectors.test.ts` — 8 tests

- `queryAll`: finds elements, falls through to second selector, returns empty array on no match, skips malformed selectors silently, scopes to a subtree
- `queryOne`: finds first element, returns null on no match, skips malformed selectors

### `tests/overlay.test.ts` — 16 tests

- `showOverlay`: creates element, idempotent, has correct ARIA role and label, contains "PRIVATE MODE" text, is a modal dialog (`aria-modal`, `tabindex="-1"`), moves focus into the overlay, states the keyboard dismissal path
- `hideOverlay`: removes element, safe when not present, dismisses on Escape, ignores other keys, returns focus to the previously focused element, stops listening for Escape once hidden
- `isOverlayVisible`: correct state in all three cases

---

## What is NOT tested (and why)

**Live WhatsApp selectors**: WhatsApp uses auto-generated class names and a complex SPA. There is no automated test against the live site — the selectors in `src/content/selectors.ts` are tested against fixtures modelled on the current markup. The v1.0.0 release was **manually verified in Microsoft Edge against a real logged-in session** (see below), but WhatsApp can and does change its DOM without notice, so that verification is point-in-time.

**Instagram live selectors and resolvers**: Instagram selectors were checked against the *logged-out* Instagram DOM in a browser during development (profile and post permalink pages), but there is no automated test against the live site. Comment/caption structural resolvers are verified in tests against a fixture derived from that live structure; if Instagram changes its markup, the resolvers fail safe (no blur) rather than blurring the wrong thing. Logged-out feed, DMs, stories viewer and reels viewer redirect to login, are **not implemented**, and were **not** verified.

**React popup/options components**: The popup and options page UI are React components. They are not unit tested here. Manual verification against the loaded extension is required for:
- Toggle state reflecting storage
- Site-aware popup (WhatsApp toggles vs Instagram toggles)
- Settings persisting across popup open/close
- Messages reaching the content script
- Options page sections rendering correctly
- Theme switching

**Browser extension APIs at runtime**: `chrome.tabs.sendMessage`, `chrome.runtime.openOptionsPage`, `chrome.storage.onChanged`, and similar calls are mocked in tests. Real cross-context message passing only works in a loaded extension.

**MutationObserver in practice**: `tests/mutation-observer.test.ts` exercises the real observer started by `init()` (insertion, `src` attribute change, batching, termination) against jsdom. jsdom has no layout and no real network, so it cannot prove that WhatsApp's *actual* rendered markup matches the fixtures. The real test is opening a chat/thread and seeing new content get blurred.

**Firefox**: Not tested at all. MV3 support in Firefox is improving but may require manifest adjustments for compatibility.

---

## Verification performed for v1.0.0

| Check | Result |
|---|---|
| `npm ci` | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass — 259/259 across 14 files |
| `npm run build` | Pass |
| `npm run validate:extension` | Pass |
| Manual session test | **Pass — Microsoft Edge, real logged-in WhatsApp Web** |

Manually confirmed in Edge: profile photos (chat list, conversation header, group info), GIFs, stickers, messages, contact/group names, chat-list previews, images and videos, dynamic content arriving after load, toggles applying live without a reload, and reveal behaviour.

Not verified: Firefox (not tested at all), Instagram DMs/Stories/Reels viewers (not implemented).

---

## Manual verification checklist — WhatsApp Web

Requires loading `dist/` as an unpacked extension and opening `https://web.whatsapp.com` with an active session:

- [ ] Privacy mode toggles on and off
- [ ] Messages blur when privacy is on
- [ ] Contact names blur when privacy is on
- [ ] Profile photos blur
- [ ] Profile photos blur in the **chat list**, in the **conversation header**, and in the **group info drawer**
- [ ] A profile photo that loads late (scroll the chat list, or switch chats) is still blurred
- [ ] GIFs blur inside message bubbles, including a GIF WhatsApp renders as a looping, control-less video
- [ ] Stickers blur, including an animated sticker rendered on a `<canvas>`
- [ ] The **GIF picker, sticker picker and emoji picker tiles stay visible** (they must never blur)
- [ ] Real videos and photo messages still blur as videos/images (they must not be re-classified as GIFs/stickers)
- [ ] Chat list previews blur
- [ ] Online status disappears
- [ ] Typing indicator disappears
- [ ] Hover reveal works
- [ ] Click reveal works
- [ ] Timed reveal works and re-blurs after the configured duration
- [ ] Blur intensity slider changes the visible blur level
- [ ] New messages arriving while privacy is on get blurred immediately
- [ ] Switching chats re-applies protections to the new chat
- [ ] **Nested reveal**: hovering a message reveals its nested content (reply preview, quoted text, reactions) together, with no darker "double blur" patch anywhere
- [ ] **Settings without reload**: with WhatsApp open, flip a toggle in the popup → effect applies immediately on the already-open page (no F5)
- [ ] **Settings without reload**: the same applies from the options page
- [ ] **Settings without reload — profile photos**: turn `Profile photos` OFF → already-rendered avatars become visible; turn it back ON → they blur again, all without F5
- [ ] **Settings without reload — GIFs/stickers**: turn `GIFs & stickers` OFF → already-rendered GIFs/stickers become visible; turn it back ON → they blur again, all without F5
- [ ] **Category independence**: turning `Messages` OFF does not un-blur profile photos or stickers; turning `Profile photos` OFF does not un-blur messages
- [ ] **New media**: send yourself a GIF/sticker from your phone → it is blurred as soon as it renders
- [ ] **Auto-blur**: enabling focus-loss blur works without reloading the page
- [ ] Ctrl+Shift+P shows the overlay
- [ ] Clicking the overlay dismisses it
- [ ] Ctrl+Shift+P again dismisses it
- [ ] Quick Lock button shows the overlay
- [ ] Max Privacy enables all toggles
- [ ] Settings persist across browser restarts
- [ ] Disabling privacy removes all blurs
- [ ] The extension does nothing on non-supported pages

## Manual verification checklist — Instagram

Requires loading `dist/` and opening `https://www.instagram.com`. Logged-out public profile and post/permalink pages are enough; DMs/stories/reels viewers are not implemented:

- [ ] Popup detects Instagram and shows only the Instagram toggles (no WhatsApp-only sections)
- [ ] Profile photos blur (public profile page, post page, comment avatars)
- [ ] Photos blur (grid thumbnails, post images, story/highlight covers)
- [ ] Videos & reels blur
- [ ] Captions blur — the post header, username and timestamp stay readable
- [ ] Comments blur as whole rows; hovering one comment reveals author, time and text together and re-blurs on leave
- [ ] Hovering one comment does **not** reveal a neighbouring comment
- [ ] Navigation bar, search, buttons, and the extension's own UI are never blurred
- [ ] Turning a toggle off removes that blur immediately on the open page (no reload)
- [ ] Turning privacy mode off removes all blurs immediately (no reload)
- [ ] Scrolling a long comments thread blurs newly loaded comments
- [ ] Nothing is blurred on a non-Instagram, non-WhatsApp page
- [ ] Story highlight covers on a public profile blur (viewer itself is not implemented)
