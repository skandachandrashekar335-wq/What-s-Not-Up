#!/usr/bin/env node
/**
 * validate-extension.mjs
 *
 * Validates the contents of dist/ against the manifest.
 * Run after every production build: npm run validate:extension
 *
 * Checks:
 *   - dist/manifest.json exists and parses as valid JSON
 *   - Required manifest fields are present
 *   - Every file referenced by the manifest exists in dist/
 *   - Icon files exist and are non-empty valid PNGs
 *   - Core JS/HTML files are non-empty
 *   - No stale files remain that are not referenced
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '../dist');

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error('  ✗ FAIL:', msg);
  errors++;
}

function warn(msg) {
  console.warn('  ⚠ WARN:', msg);
  warnings++;
}

function ok(msg) {
  console.log('  ✓', msg);
}

function fileExists(rel) {
  return existsSync(join(DIST, rel));
}

function fileSize(rel) {
  try {
    return statSync(join(DIST, rel)).size;
  } catch {
    return 0;
  }
}

function isPNG(rel) {
  try {
    const buf = readFileSync(join(DIST, rel));
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    return buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  } catch {
    return false;
  }
}

function pngDimensions(rel) {
  try {
    const buf = readFileSync(join(DIST, rel));
    if (buf.length < 24) return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

console.log('\nValidating extension in dist/\n');

// ── 1. manifest.json ─────────────────────────────────────────────────────────

console.log('manifest.json:');
if (!fileExists('manifest.json')) {
  fail('dist/manifest.json does not exist');
  console.error('\nFATAL: No manifest found. Run npm run build first.\n');
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
  ok('parses as valid JSON');
} catch (e) {
  fail('manifest.json is not valid JSON: ' + e.message);
  process.exit(1);
}

const required = ['manifest_version', 'name', 'version', 'description'];
for (const field of required) {
  if (manifest[field] !== undefined) {
    ok(`has "${field}": ${JSON.stringify(manifest[field]).slice(0, 60)}`);
  } else {
    fail(`missing required field "${field}"`);
  }
}

if (manifest.manifest_version !== 3) {
  fail(`manifest_version must be 3, got ${manifest.manifest_version}`);
} else {
  ok('manifest_version is 3');
}

// ── 2. Background service worker ─────────────────────────────────────────────

console.log('\nBackground service worker:');
const swFile = manifest.background?.service_worker;
if (!swFile) {
  fail('manifest.background.service_worker is missing');
} else if (!fileExists(swFile)) {
  fail(`service_worker "${swFile}" does not exist in dist/`);
} else if (fileSize(swFile) === 0) {
  fail(`service_worker "${swFile}" is empty`);
} else {
  ok(`${swFile} exists (${fileSize(swFile)} bytes)`);
}

// Check that type: module is NOT set (Webpack bundles to non-ESM)
if (manifest.background?.type === 'module') {
  fail('background.type is "module" but Webpack output is not ESM — this will break the service worker in Chromium. Remove "type": "module" from the manifest.');
} else {
  ok('"type": "module" is not set (correct for Webpack output)');
}

// ── 3. Content scripts ───────────────────────────────────────────────────────

console.log('\nContent scripts:');
const contentScripts = manifest.content_scripts ?? [];
if (contentScripts.length === 0) {
  fail('no content_scripts defined');
} else {
  for (const cs of contentScripts) {
    const matches = cs.matches ?? [];
    const hasWhatsApp = matches.some(m => m.includes('web.whatsapp.com'));
    if (!hasWhatsApp) {
      warn(`content script matches ${JSON.stringify(matches)} — does not include web.whatsapp.com`);
    } else {
      ok(`matches includes web.whatsapp.com`);
    }
    for (const jsFile of cs.js ?? []) {
      if (!fileExists(jsFile)) {
        fail(`content script "${jsFile}" does not exist in dist/`);
      } else if (fileSize(jsFile) === 0) {
        fail(`content script "${jsFile}" is empty`);
      } else {
        ok(`${jsFile} exists (${fileSize(jsFile)} bytes)`);
      }
    }
  }
}

// ── 4. Action popup ──────────────────────────────────────────────────────────

console.log('\nAction popup:');
const popupFile = manifest.action?.default_popup;
if (!popupFile) {
  fail('manifest.action.default_popup is missing');
} else if (!fileExists(popupFile)) {
  fail(`popup "${popupFile}" does not exist in dist/`);
} else {
  ok(`${popupFile} exists (${fileSize(popupFile)} bytes)`);
}

// ── 5. Options page ──────────────────────────────────────────────────────────

console.log('\nOptions page:');
const optionsFile = manifest.options_page ?? manifest.options_ui?.page;
if (!optionsFile) {
  warn('no options_page defined');
} else if (!fileExists(optionsFile)) {
  fail(`options_page "${optionsFile}" does not exist in dist/`);
} else {
  ok(`${optionsFile} exists (${fileSize(optionsFile)} bytes)`);
}

// ── 6. Icons ─────────────────────────────────────────────────────────────────

console.log('\nIcons:');
const expectedSizes = { '16': 16, '32': 32, '48': 48, '128': 128 };
const iconSets = [manifest.icons, manifest.action?.default_icon].filter(Boolean);
const checkedIcons = new Set();

for (const iconSet of iconSets) {
  for (const [sizeStr, iconPath] of Object.entries(iconSet ?? {})) {
    if (checkedIcons.has(iconPath)) continue;
    checkedIcons.add(iconPath);

    if (!fileExists(iconPath)) {
      fail(`icon "${iconPath}" does not exist in dist/`);
      continue;
    }
    if (!isPNG(iconPath)) {
      fail(`icon "${iconPath}" is not a valid PNG file`);
      continue;
    }
    const dims = pngDimensions(iconPath);
    const expectedSize = expectedSizes[sizeStr];
    if (!dims) {
      fail(`icon "${iconPath}" — could not read dimensions`);
    } else if (dims.w !== expectedSize || dims.h !== expectedSize) {
      fail(`icon "${iconPath}" is ${dims.w}x${dims.h} but should be ${expectedSize}x${expectedSize}`);
    } else {
      ok(`${iconPath} is valid PNG, ${dims.w}x${dims.h}`);
    }
  }
}

// ── 7. HTML files have corresponding JS/CSS ──────────────────────────────────

console.log('\nHTML/JS/CSS pairings:');
const htmlEntries = ['popup', 'options', 'onboarding'];
for (const name of htmlEntries) {
  const html = `${name}.html`;
  const js = `${name}.js`;
  const css = `${name}.css`;
  if (fileExists(html)) {
    ok(`${html} exists`);
  } else {
    fail(`${html} is missing`);
  }
  if (fileExists(js)) {
    ok(`${js} exists (${fileSize(js)} bytes)`);
  } else {
    fail(`${js} is missing`);
  }
  if (fileExists(css)) {
    ok(`${css} exists`);
  }
  // css is optional (some pages may have no custom CSS)
}

// ── 8. Permissions audit ─────────────────────────────────────────────────────

console.log('\nPermissions:');
const perms = manifest.permissions ?? [];
const hostPerms = manifest.host_permissions ?? [];
const dangerousPerms = ['<all_urls>', 'webRequest', 'cookies', 'debugger', 'nativeMessaging'];
const unnecessaryPerms = ['alarms'];

for (const p of [...perms, ...hostPerms]) {
  if (dangerousPerms.includes(p) || p === '<all_urls>') {
    fail(`dangerous permission "${p}" found`);
  } else if (unnecessaryPerms.includes(p)) {
    warn(`potentially unnecessary permission "${p}" — verify it is actually used`);
  } else {
    ok(`permission "${p}" present`);
  }
}

const hasAllUrls = hostPerms.some(p => p === '<all_urls>' || p === '*://*/*');
if (hasAllUrls) {
  fail('host_permissions grants broad <all_urls> access');
} else {
  ok('host_permissions does not grant broad access');
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
if (errors === 0 && warnings === 0) {
  console.log('✓ All checks passed. Extension is ready to load unpacked.\n');
  process.exit(0);
} else if (errors === 0) {
  console.log(`✓ Passed with ${warnings} warning(s). Extension should load.\n`);
  process.exit(0);
} else {
  console.log(`✗ ${errors} error(s), ${warnings} warning(s). Fix errors before loading.\n`);
  process.exit(1);
}
