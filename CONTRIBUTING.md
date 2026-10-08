# Contributing to What's Not Up

Thanks for your interest. This is a personal portfolio project but contributions are welcome.

## Getting started

```bash
git clone https://github.com/skandachandrashekhar335-wq/whatsapp-privacy-enhacer.git
cd whatsapp-privacy-enhacer
npm install
npm run dev   # webpack in watch mode → dist/
```

Load `dist/` as an unpacked extension in Chrome/Edge/Brave (Developer mode → Load unpacked).

## Before submitting a PR

Run the full validation suite:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

All four must pass without warnings being silenced or errors being ignored.

## Code structure

The important design rule: the privacy engine (`src/content/privacy-engine.ts`) must have zero knowledge of WhatsApp. It receives DOM elements and applies CSS transforms. If you're changing how WhatsApp's DOM is found, that goes in `src/content/selectors.ts` and `src/content/dom-processor.ts` only.

## Updating selectors

WhatsApp Web changes its DOM periodically. If you find a selector has broken:

1. Open `src/content/selectors.ts`
2. Add the new selector at the top of the relevant array (they are tried in order)
3. Keep the old selector as a fallback
4. Add a comment noting the date if the old one is likely dead

Do not remove working fallbacks — multiple selectors coexisting is intentional.

## Tests

Tests live in `tests/`. Add a test for any new feature or bug fix. The test environment is jsdom; chrome APIs are mocked in `tests/setup.ts`.

If you're adding a new selector, add a test in `tests/selectors.test.ts` that builds a fake DOM element and confirms it's found.

## Commits

Use conventional commit prefixes:
- `feat:` — new feature
- `fix:` — bug fix
- `test:` — test changes
- `docs:` — documentation only
- `chore:` — build/tooling/config changes
- `refactor:` — code change with no behaviour change

Keep commits focused. One logical change per commit.

## What not to do

- Do not add permissions to `manifest.json` without a strong justification
- Do not add new npm dependencies without checking they are actively maintained and small
- Do not read, store, or transmit any message content — this is a hard requirement
- Do not add features that require WhatsApp credentials or network interception
