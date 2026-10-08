/**
 * WhatsApp Live DOM Diagnostic — READ-ONLY
 * =========================================
 *
 * Purpose: capture the REAL structure of WhatsApp Web avatars / GIFs /
 * stickers from your logged-in Edge session, and report which stage of the
 * extension pipeline is failing.
 *
 * HOW TO RUN
 * ----------
 * 1. Open your logged-in https://web.whatsapp.com in Edge.
 * 2. Press F12 → Console tab (make sure "Paste" is allowed).
 * 3. Copy THIS ENTIRE FILE and paste it, then press Enter.
 * 4. Read the printed sections, and copy the whole console output back.
 * 5. Optionally run:  __WNU_INSPECT_ELEMENT()   (see SECTION 5)
 *    then:            __WNU_INSPECT_CANCEL()
 *
 * This script is NOT part of the extension. Webpack only bundles the
 * explicit entries (background/content/popup/options/onboarding), so this
 * file is never shipped, never injected, and never executes on its own.
 *
 * WHAT IT DOES
 * ------------
 *  - Reads the DOM and prints STRUCTURE ONLY.
 *  - Reads already-written extension attributes (data-wnu-*) and the
 *    injected style tag, so we can tell selector-discovery vs ownership
 *    vs CSS failures apart.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 *  - Does not add, remove, move or edit any node, class, style or attribute.
 *  - Does not blur anything, does not change settings, does not reload.
 *  - Does not read message text, captions, link URLs, passwords or cookies.
 *    Output is tags, attributes and media ORIGINS only — never text nodes and
 *    never full URLs, so a pasted report cannot leak chat content.
 *  - Does not use fetch/XHR/WebSocket/storage — output goes to the console
 *    only, and stays on your machine.
 */

(() => {
  const OUT = (label, css_) => console.log(`%c${label}`, css_ || 'background:#111;color:#0f0;font-weight:bold;font-size:12px');
  const SUB = (label) => console.log(`%c${label}`, 'background:#333;color:#9cf;font-weight:bold');
  const WARN = (label) => console.log(`%c${label}`, 'background:#800;color:#fff;font-weight:bold');

  /**
   * Origin only (scheme + host) — enough to recognise WhatsApp's CDN tokens
   * (`pps.whatsapp.net`, `static.whatsapp.net`) without emitting a URL that
   * identifies a specific message's media.
   */
  const originOf = (url) => {
    try {
      return new URL(url, location.href).origin;
    } catch {
      return '';
    }
  };

  /** Attributes safe to print: structure markers, never free-form content. */
  const SAFE_ATTRS = new Set([
    'data-testid', 'role', 'aria-label', 'class', 'alt', 'title',
    'width', 'height', 'loop', 'controls', 'autoplay', 'muted',
    'data-animated', 'data-autoplay', 'style',
  ]);

  // ─── helpers (all read-only) ───────────────────────────────────────────────

  const count = (sel) => {
    try {
      return document.querySelectorAll(sel).length;
    } catch {
      return 'INVALID';
    }
  };

  const first = (sel) => {
    try {
      return document.querySelector(sel);
    } catch {
      return null;
    }
  };

  const computed = (el) => {
    const s = getComputedStyle(el);
    return {
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity,
      filter: s.filter,
      backgroundImage: s.backgroundImage === 'none' ? 'none' : s.backgroundImage.slice(0, 160),
      size: `${el.clientWidth}x${el.clientHeight}`,
    };
  };

  const attrs = (el) => {
    const out = {};
    for (const a of el.attributes) {
      const n = a.name;
      if (n === 'src' || n === 'srcset' || n === 'href') {
        out[n] = originOf(a.value) || '(relative)';
        continue;
      }
      if (n.startsWith('data-') || SAFE_ATTRS.has(n)) {
        out[n] = n === 'class' ? a.value.slice(0, 120) : a.value.slice(0, 200);
      }
    }
    return out;
  };

  /**
   * Tag/attribute outline of a subtree. Deliberately walks `children` only —
   * text nodes are never read, so no message body can reach the console.
   */
  const structure = (el, depth = 0, maxDepth = 3) => {
    const a = Object.entries(attrs(el))
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    const line = `${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${a}>`;
    if (depth >= maxDepth) return line;
    const kids = [...el.children]
      .slice(0, 6)
      .map((c) => structure(c, depth + 1, maxDepth))
      .join('\n');
    return kids ? `${line}\n${kids}` : line;
  };

  const chain = (el, depth = 8) => {
    const rows = [];
    let n = el;
    for (let i = 0; n && i < depth; i++, n = n.parentElement) {
      rows.push({
        i,
        tag: n.tagName.toLowerCase(),
        testid: n.getAttribute('data-testid') || '',
        role: n.getAttribute('role') || '',
        cls: (typeof n.className === 'string' ? n.className : '').slice(0, 70),
        wnu: n.getAttribute('data-wnu-protected') !== null ? 'PROTECTED' : '',
        wnuType: n.getAttribute('data-wnu-type') || '',
      });
    }
    return rows;
  };

  const nearestMsg = (el) => {
    const m = el.closest('[data-testid="msg-container"], [role="row"], .message-in, .message-out');
    if (!m) return 'none';
    return {
      testid: m.getAttribute('data-testid') || '(class-based)',
      protected: m.hasAttribute('data-wnu-protected'),
      type: m.getAttribute('data-wnu-type') || '',
      cls: (typeof m.className === 'string' ? m.className : '').slice(0, 70),
    };
  };

  const mediaKids = (el) => {
    const out = [];
    el.querySelectorAll('img, video, canvas, picture, svg, source').forEach((k, i) => {
      if (i > 7) return;
      out.push({
        tag: k.tagName.toLowerCase(),
        srcOrigin: originOf(k.getAttribute('src') || k.getAttribute('srcset') || ''),
        alt: (k.getAttribute('alt') || '').slice(0, 60),
        testid: k.getAttribute('data-testid') || '',
        wnu: k.hasAttribute('data-wnu-protected'),
      });
    });
    return out;
  };

  /** Is this element the target of extension protection right now? */
  const wnuState = (el) => ({
    type: el.getAttribute('data-wnu-type') || '(not classified)',
    protected_: el.hasAttribute('data-wnu-protected') ? 'YES' : 'NO',
    revealed: el.hasAttribute('data-wnu-revealed') ? 'YES' : 'NO',
    computedFilter: getComputedStyle(el).filter,
  });

  const report = (el, label) => {
    if (!el) {
      WARN(`  ${label}: NOT FOUND`);
      return;
    }
    SUB(`  ${label}`);
    console.log('    tag:', el.tagName.toLowerCase());
    console.log('    attrs:', attrs(el));
    console.log('    computed:', computed(el));
    console.log('    extension state:', wnuState(el));
    console.log('    nearest message container:', nearestMsg(el));
    const kids = mediaKids(el);
    if (kids.length) console.log('    child media:', kids);
    console.log('    parent chain:');
    console.table(chain(el));
    console.log('    structure (tags + attributes only — no text nodes):');
    console.log(structure(el));
  };

  // ═════════════════════════════════════════════════════════════════════════
  OUT('SECTION 1 — EXTENSION PIPELINE STATE  (decisive 3-way diagnosis)');

  const styleTag = document.getElementById('wnu-privacy-styles');
  console.log('  injected style tag #wnu-privacy-styles:', styleTag ? 'PRESENT' : 'MISSING');
  if (styleTag) {
    console.log('  blur rule:', (styleTag.textContent.match(/blur\(([^)]+)\)/) || [])[1] || '?');
  }

  const allTyped = [...document.querySelectorAll('[data-wnu-type]')];
  const byType = {};
  allTyped.forEach((el) => {
    const t = el.getAttribute('data-wnu-type');
    byType[t] = byType[t] || { classified: 0, protected: 0, filtered: 0 };
    byType[t].classified++;
    if (el.hasAttribute('data-wnu-protected')) {
      byType[t].protected++;
      if (getComputedStyle(el).filter !== 'none') byType[t].filtered++;
    }
  });

  SUB('  data-wnu-type breakdown  (classified → protected → actually filtered)');
  if (!allTyped.length) WARN('  NO data-wnu-type ELEMENTS AT ALL — extension did not classify anything.');
  console.table(byType);

  WARN(
    '  HOW TO READ THIS:\n' +
    '   • classified = 0 for photo/gif-sticker  → SELECTOR DISCOVERY failure (selectors match nothing)\n' +
    '   • classified > 0 but protected = 0      → OWNERSHIP failure (resolveOwner() absorbed it into an ancestor)\n' +
    '   • protected > 0 but filtered = 0        → CSS failure (attribute set, blur not applying)'
  );

  // ═════════════════════════════════════════════════════════════════════════
  OUT('SECTION 2 — CURRENT PRODUCTION SELECTORS: LIVE MATCH COUNTS');

  // Mirrors src/content/selectors.ts exactly. "CONTROL" rows are categories
  // you confirmed are WORKING, so we can tell "extension broken" apart from
  // "these particular selectors are stale".
  const GROUPS = [
    ['CONTROL  messageText (WORKING)', 'first', [
      'span.selectable-text',
      '[data-testid="msg-container"] span.copyable-text',
      '.copyable-text',
    ]],
    ['CONTROL  chatListPreview (WORKING)', 'first', [
      '[data-testid="last-msg"]',
      '[data-testid="cell-frame-secondary"]',
    ]],
    ['TARGET   profilePhoto (BROKEN)', 'union', [
      '[data-testid="default-user"]',
      '[data-testid="avatar"]',
      'img[src*="pps.whatsapp.net"]',
      'img[src*="static.whatsapp.net"]',
      'img[alt="Profile photo"]',
      '[data-testid="chatlist-avatar"] img',
      '[data-testid="conversation-header-avatar"] img',
    ]],
    ['TARGET   mediaGifSticker (BROKEN)', 'first', [
      '[data-testid="gif"]',
      '[data-testid="sticker"]',
      '[data-animated="true"]',
    ]],
    ['REF      mediaImage', 'first', [
      '[data-testid="media-url-provider"] img',
      '[data-testid="image-thumb"]',
      '[data-testid="media-image"]',
    ]],
    ['REF      mediaVideo', 'first', [
      '[data-testid="video-thumb"]',
      '[data-testid="media-video"]',
      '[data-testid="media-url-provider"] video',
    ]],
  ];

  const rows = [];
  GROUPS.forEach(([name, mode, sels]) => {
    let effective = null;
    sels.forEach((sel, i) => {
      const n = count(sel);
      // emulate match:'first' so the report shows what production actually does
      if (mode === 'first' && effective === null && typeof n === 'number' && n > 0) effective = i;
      rows.push({
        group: name,
        match: mode,
        selector: sel,
        matches: n,
        usedByProd: mode === 'union' ? (n === 0 ? '' : 'yes') : '',
      });
    });
    if (mode === 'first') {
      rows.filter((r) => r.group === name).forEach((r, i) => {
        r.usedByProd = i === effective ? 'YES ← only this one runs' : (effective === null ? '' : 'skipped');
      });
    }
  });
  console.table(rows);

  // ═════════════════════════════════════════════════════════════════════════
  OUT('SECTION 3 — AUTO-PROBES: A/B/C/D');

  const pick = (selectors) => {
    for (const s of selectors) {
      const el = first(s);
      if (el) return { el, via: s };
    }
    return null;
  };

  SUB('A) CHAT-LIST PROFILE PHOTO (contact / group)');
  const a = pick([
    '#pane-side img[src*="pps.whatsapp.net"]',
    '[data-testid="chat-list"] img',
    '#pane-side [data-testid="avatar"] img',
    '#pane-side [data-testid="avatar"]',
    '[data-testid="cell-frame-container"] img',
    '#pane-side [role="listitem"] img',
    '#pane-side img',
  ]);
  if (a) { console.log('    matched via:', a.via); report(a.el, 'chat-list avatar'); }
  else WARN('  A) no chat-list image found with any probe');

  SUB('B) CONVERSATION-HEADER PROFILE PHOTO');
  const b = pick([
    '[data-testid="conversation-header"] img',
    'header img',
    '[data-testid="conversation-info-header"] img',
  ]);
  if (b) { console.log('    matched via:', b.via); report(b.el, 'header avatar'); }
  else WARN('  B) no header image found — is a chat open?');

  SUB('C) GIF INSIDE A MESSAGE');
  const c = pick([
    '[data-testid="gif"]',
    '[data-testid="msg-container"] [data-animated="true"]',
    '[data-testid="msg-container"] img[src*=".gif"]',
    '[data-testid="msg-container"] picture',
    '[data-testid="msg-container"] video',
    '[data-testid="media-gif"]',
  ]);
  if (c) { console.log('    matched via:', c.via); report(c.el, 'GIF'); }
  else WARN('  C) no GIF found — open a chat that contains a GIF, then re-run');

  SUB('D) STICKER INSIDE A MESSAGE');
  const d = pick([
    '[data-testid="sticker"]',
    '[data-testid="msg-container"] canvas',
    '[data-testid="msg-container"] img[src*="sticker"]',
    '[data-testid="sticker-container"]',
    '[data-testid="msg-container"] [data-animated="true"]',
  ]);
  if (d) { console.log('    matched via:', d.via); report(d.el, 'sticker'); }
  else WARN('  D) no sticker found — open a chat that contains a sticker, then re-run');

  // ═════════════════════════════════════════════════════════════════════════
  OUT('SECTION 4 — RELEVANT data-testid INVENTORY (names only, no content)');
  const interesting = /avatar|gif|sticker|media|image|thumb|photo|profile|cell-frame|msg|conversation|animated/i;
  const ids = [...new Set(
    [...document.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .filter((v) => v && interesting.test(v))
  )].sort();
  console.log('  count:', ids.length);
  console.log(ids.join('\n'));
  if (!ids.length) WARN('  No matching data-testid values found — WhatsApp may have dropped testids entirely.');

  SUB('  Full testid inventory (all, names only)');
  console.log([...new Set([...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')))].sort().join(', '));

  SUB('  Media-ish elements summary (tag counts)');
  const tally = {};
  document.querySelectorAll('img, video, canvas, picture').forEach((e) => { tally[e.tagName.toLowerCase()] = (tally[e.tagName.toLowerCase()] || 0) + 1; });
  console.table(tally);

  SUB('  Sample of distinct image src origins (first 15)');
  const srcs = new Set();
  document.querySelectorAll('img').forEach((i) => {
    const s = originOf(i.currentSrc || i.src || '');
    if (s && srcs.size < 15) srcs.add(s);
  });
  console.log([...srcs].join('\n'));

  // ═════════════════════════════════════════════════════════════════════════
  OUT('SECTION 5 — ELEMENT PICKER (diagnostic only)');

  let hoverTarget = null;
  let listening = false;

  const onMove = (e) => { hoverTarget = e.target; };
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = hoverTarget && hoverTarget.nodeType === 1 ? hoverTarget : e.target;
    console.log('%c>>> PICKED ELEMENT <<<', 'background:#f0f;color:#fff;font-weight:bold');
    report(el, 'picked element');
    console.log('%cRun __WNU_INSPECT_CANCEL() when finished.', 'color:#ff0');
  };

  window.__WNU_INSPECT_ELEMENT = () => {
    if (listening) { console.log('Picker already active — click an element.'); return; }
    listening = true;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    console.log('%cPicker ACTIVE: click any element in the page.', 'background:#0a0;color:#fff;font-weight:bold;font-size:13px');
    console.log('  The click will be blocked (prevented) so WhatsApp does nothing.');
    console.log('  Finish with __WNU_INSPECT_CANCEL()');
  };

  window.__WNU_INSPECT_CANCEL = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    listening = false;
    hoverTarget = null;
    console.log('Picker cancelled and fully removed. No DOM was modified.');
  };

  OUT('DONE — copy everything above and paste it back.', 'background:#00f;color:#fff;font-weight:bold;font-size:13px');
  console.log('Reminder: this run touched no DOM, sent no data, and changed no settings.');
})();
