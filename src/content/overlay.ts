/**
 * Privacy Overlay
 *
 * Optional full-screen cover: "PRIVATE MODE / WhatsApp content hidden"
 * Activated by Quick Lock or the emergency keyboard shortcut.
 */

const OVERLAY_ID = 'wnu-overlay';

/**
 * Focus restoration + keyboard dismissal.
 *
 * The overlay is an opaque, full-screen `role="dialog"`. Without focus
 * management a screen-reader or keyboard user would keep navigating content
 * that is visually hidden behind it, and with no Escape binding the overlay
 * could only be dismissed by mouse or by remembering the shortcut.
 */
let escapeHandler: ((e: KeyboardEvent) => void) | null = null;
let previouslyFocused: Element | null = null;

export function showOverlay(): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Privacy overlay active');
  overlay.setAttribute('aria-live', 'polite');
  overlay.tabIndex = -1;

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #1a1a2e;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer;
    user-select: none;
  `;

  const icon = document.createElement('div');
  icon.textContent = '🔒';
  icon.style.cssText = 'font-size: 48px; line-height: 1;';

  const title = document.createElement('div');
  title.textContent = 'PRIVATE MODE';
  title.style.cssText = `
    color: #e8eaf6;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  `;

  const subtitle = document.createElement('div');
  subtitle.textContent = 'Protected content hidden';
  subtitle.style.cssText = `
    color: #9fa8da;
    font-size: 14px;
    font-weight: 400;
  `;

  const hint = document.createElement('div');
  hint.textContent = 'Click anywhere, press Esc, or press Ctrl+Shift+P to restore';
  hint.style.cssText = `
    color: #5c6bc0;
    font-size: 12px;
    margin-top: 16px;
  `;

  overlay.appendChild(icon);
  overlay.appendChild(title);
  overlay.appendChild(subtitle);
  overlay.appendChild(hint);

  overlay.addEventListener('click', hideOverlay, { once: true });

  document.documentElement.appendChild(overlay);

  // Move focus into the dialog — assistive tech must not keep navigating the
  // page that is now hidden behind an opaque cover — and remember where to
  // return focus once the overlay is dismissed.
  previouslyFocused = document.activeElement instanceof Element ? document.activeElement : null;
  try {
    overlay.focus({ preventScroll: true });
  } catch {
    overlay.focus();
  }

  escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hideOverlay();
  };
  document.addEventListener('keydown', escapeHandler);
}

export function hideOverlay(): void {
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
  document.getElementById(OVERLAY_ID)?.remove();

  const target = previouslyFocused;
  previouslyFocused = null;
  if (target && target.isConnected) {
    try {
      (target as HTMLElement).focus({ preventScroll: true });
    } catch {
      // element cannot take focus — leaving focus where it is is acceptable
    }
  }
}

export function isOverlayVisible(): boolean {
  return !!document.getElementById(OVERLAY_ID);
}
