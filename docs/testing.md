# Testing

## Running the tests

```bash
npm test            # single run
npm run test:watch  # watch mode
npm run test:coverage  # with coverage report
```

Tests use Vitest in a jsdom environment. There is no dependency on a real browser or live WhatsApp session.

---

## What is tested

### `tests/types.test.ts` — 9 tests

Verifies `DEFAULT_SETTINGS` has the expected values: privacy disabled by default, all protection toggles on, hover reveal mode, sensible intensity and duration, focus-loss blur off, onboarding incomplete, system theme.

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

### `tests/selectors.test.ts` — 8 tests

- `queryAll`: finds elements, falls through to second selector, returns empty array on no match, skips malformed selectors silently, scopes to a subtree
- `queryOne`: finds first element, returns null on no match, skips malformed selectors

### `tests/overlay.test.ts` — 9 tests

- `showOverlay`: creates element, idempotent, has correct ARIA role and label, contains "PRIVATE MODE" text
- `hideOverlay`: removes element, safe when not present
- `isOverlayVisible`: correct state in all three cases

---

## What is NOT tested (and why)

**Live WhatsApp selectors**: WhatsApp uses auto-generated class names and a complex SPA. The selectors in `src/content/selectors.ts` are tested against a static fake DOM, but actual selector validity against live WhatsApp can only be verified manually in a real browser session. WhatsApp can and does change its DOM without notice.

**React popup/options components**: The popup and options page UI are React components. They are not unit tested here. Manual verification against the loaded extension is required for:
- Toggle state reflecting storage
- Settings persisting across popup open/close
- Messages reaching the content script
- Options page sections rendering correctly
- Theme switching

**Browser extension APIs at runtime**: `chrome.tabs.sendMessage`, `chrome.runtime.openOptionsPage`, and similar calls are mocked in tests. Real cross-context message passing only works in a loaded extension.

**MutationObserver in practice**: The observer test (`processNewNodes`) simulates new node injection but does not test the full observer loop that runs in the content script. The real test is opening a WhatsApp chat and seeing new messages get blurred.

**Firefox**: Not tested at all. MV3 support in Firefox is improving but may require manifest adjustments for compatibility.

---

## Manual verification checklist

These require loading the extension in a real browser with an active WhatsApp Web session:

- [ ] Privacy mode toggles on and off
- [ ] Messages blur when privacy is on
- [ ] Contact names blur when privacy is on
- [ ] Profile photos blur
- [ ] Chat list previews blur
- [ ] Online status disappears
- [ ] Typing indicator disappears
- [ ] Hover reveal works
- [ ] Click reveal works
- [ ] Timed reveal works and re-blurs after the configured duration
- [ ] Blur intensity slider changes the visible blur level
- [ ] New messages arriving while privacy is on get blurred immediately
- [ ] Switching chats re-applies protections to the new chat
- [ ] Ctrl+Shift+P shows the overlay
- [ ] Clicking the overlay dismisses it
- [ ] Ctrl+Shift+P again dismisses it
- [ ] Quick Lock button shows the overlay
- [ ] Max Privacy enables all toggles
- [ ] Settings persist across browser restarts
- [ ] Disabling privacy removes all blurs
- [ ] The extension does nothing on non-WhatsApp pages
