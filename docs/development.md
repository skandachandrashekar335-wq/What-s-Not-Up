# Development Guide

## Prerequisites

- Node.js 18+
- npm 8+
- Chrome, Edge, or Brave for manual testing

## Setup

```bash
git clone https://github.com/skandachandrashekhar335-wq/whatsapp-privacy-enhacer.git
cd whatsapp-privacy-enhacer
npm install
```

## Daily workflow

```bash
npm run dev     # webpack watch mode — rebuilds on save
```

In Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

After rebuilding, click the reload button on the extension card. You do not need to re-add it.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | webpack watch mode, development output |
| `npm run build` | production build → `dist/` |
| `npm run typecheck` | TypeScript type check (no output) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage report in `coverage/` |
| `npm run clean` | Remove `dist/` |

## Project layout

```
src/
  manifest.json           Extension manifest (MV3)
  shared/
    types.ts              Types and DEFAULT_SETTINGS
    storage.ts            Storage layer
  content/
    index.ts              Content script entry point (site detection, observer, storage listener)
    privacy-engine.ts     Generic CSS blur/hide engine
    dom-processor.ts      Site adapter → engine bridge (ownership, reveal groups)
    query.ts              Subtree / union / malformed-selector-safe query helpers
    selectors.ts          WhatsApp selector table
    overlay.ts            Emergency overlay
    sites/
      types.ts            SiteAdapter contract
      detect.ts           Hostname → adapter
      whatsapp/           WhatsApp adapter (index, dom, avatar-resolver, media-classifier)
      instagram/          Instagram adapter (index, selectors)
  background/
    service-worker.ts     Service worker
  popup/
    App.tsx               Popup UI (React)
    popup.css
    popup.html
    index.tsx
  options/
    Options.tsx           Settings page (React)
    options.css
    options.html
    index.tsx
  onboarding/
    index.tsx             Onboarding (React)
    onboarding.css
    onboarding.html
  icons/                  SVG + PNG icons
scripts/
  validate-extension.mjs  Manifest / icon / permission / bundle validation
  whatsapp-live-diagnostic.js   Read-only console diagnostic (dev tool, never bundled)
tests/
  setup.ts                Chrome API mock
  *.test.ts               14 test files (see docs/testing.md)
docs/
dist/                     Build output (gitignored)
```

## Adding a new protection type

1. Add a selector array to `src/content/selectors.ts`
2. Add a new boolean field to `PrivacySettings` in `src/shared/types.ts` and set a default in `DEFAULT_SETTINGS`
3. Add a target in the site adapter (`src/content/sites/whatsapp/index.ts` or `sites/instagram/index.ts`) with `type`, `setting` and `selectors` — set `match: 'union'` for additive selector sets and `match: 'first'` for overlapping fallback chains. The DOM processor applies it generically; there is nothing to wire in `dom-processor.ts`
4. Add a toggle to the popup (`src/popup/App.tsx`) and options page (`src/options/Options.tsx`)
5. Add a test in `tests/`

## Updating a selector that broke

Open `src/content/selectors.ts`. Find the array for the element type. Prepend the new selector — it is tried first. Keep the old one as a fallback.

For WhatsApp, prefer adding a *layer* over adding another selector: put rename-safe structural detection in `src/content/sites/whatsapp/avatar-resolver.ts` (profile photos) or `media-classifier.ts` (GIFs/stickers), and add a fixture to `tests/whatsapp-photos.test.ts` / `tests/whatsapp-media.test.ts` that reproduces the shape you saw.

## Live diagnostic (`scripts/whatsapp-live-diagnostic.js`)

A read-only console script for inspecting a **real, logged-in** WhatsApp Web session when a fixture and the live DOM disagree.

- It is **never bundled**: webpack builds only the explicit entries (`background`, `content`, `popup`, `options`, `onboarding`), `tsconfig.json` only includes `src/**/*`, and ESLint only lints `src`. Nothing imports it.
- It never adds, removes, moves or edits any node, class, style or attribute; it does not blur anything and does not change settings.
- It never reads message text, captions, link URLs, credentials or cookies, and never uses `fetch`/XHR/WebSocket/`storage`. Output is tags, attributes and media **origins** only, printed to the console on your machine.

To use it: open `https://web.whatsapp.com` in your browser, press F12 → Console, paste the file, and read the printed sections. Section 1 separates selector-discovery failure (nothing classified) from ownership failure (classified but not protected) from CSS failure (protected but not filtered).

## TypeScript strict mode

The project uses `strict: true` with `noUnusedLocals` and `noUnusedParameters`. This is intentional. Don't use `any` or `// @ts-ignore` to work around it.
