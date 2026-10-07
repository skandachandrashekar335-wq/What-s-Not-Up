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
    index.ts              Content script entry point
    privacy-engine.ts     Generic CSS blur/hide engine
    dom-processor.ts      WhatsApp DOM → engine bridge
    selectors.ts          All WhatsApp selectors
    overlay.ts            Emergency overlay
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
tests/
  setup.ts                Chrome API mock
  storage.test.ts
  privacy-engine.test.ts
  dom-processor.test.ts
  selectors.test.ts
  overlay.test.ts
docs/
dist/                     Build output (gitignored)
```

## Adding a new protection type

1. Add a selector array to `src/content/selectors.ts`
2. Add a new boolean field to `PrivacySettings` in `src/shared/types.ts` and set a default in `DEFAULT_SETTINGS`
3. Wire it up in `src/content/dom-processor.ts` — both in `applyProtections` and `applyProtectionsInSubtree`
4. Add a toggle to the popup (`src/popup/App.tsx`) and options page (`src/options/Options.tsx`)
5. Add a test in `tests/dom-processor.test.ts`

## Updating a selector that broke

Open `src/content/selectors.ts`. Find the array for the element type. Prepend the new selector — it is tried first. Keep the old one as a fallback.

## TypeScript strict mode

The project uses `strict: true` with `noUnusedLocals` and `noUnusedParameters`. This is intentional. Don't use `any` or `// @ts-ignore` to work around it.
