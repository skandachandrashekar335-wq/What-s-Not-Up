/**
 * Privacy Overlay
 *
 * Optional full-screen cover: "PRIVATE MODE / WhatsApp content hidden"
 * Activated by Quick Lock or the emergency keyboard shortcut.
 */

const OVERLAY_ID = 'wnu-overlay';

export function showOverlay(): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Privacy overlay active');
  overlay.setAttribute('aria-live', 'polite');

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
  subtitle.textContent = 'WhatsApp content hidden';
  subtitle.style.cssText = `
    color: #9fa8da;
    font-size: 14px;
    font-weight: 400;
  `;

  const hint = document.createElement('div');
  hint.textContent = 'Click anywhere or press Ctrl+Shift+P to restore';
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
}

export function hideOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

export function isOverlayVisible(): boolean {
  return !!document.getElementById(OVERLAY_ID);
}
