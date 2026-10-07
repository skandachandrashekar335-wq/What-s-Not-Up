import { useState, useEffect, useCallback } from 'react';
import { PrivacySettings, ExtensionMessage, RevealMode } from '../shared/types';
import { loadSettings, patchSettings } from '../shared/storage';

interface Tab {
  id?: number;
  url?: string;
}

export default function App() {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(true);

  const isOnWhatsApp = activeTab?.url?.startsWith('https://web.whatsapp.com') ?? false;

  useEffect(() => {
    async function init() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      setActiveTab(tab ?? null);
      const s = await loadSettings();
      setSettings(s);
      setLoading(false);
    }
    init();
  }, []);

  const update = useCallback(async (patch: Partial<PrivacySettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await patchSettings(patch);

    // Notify content script
    if (activeTab?.id && isOnWhatsApp) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'SETTINGS_UPDATED',
        settings: updated,
      } satisfies ExtensionMessage).catch(() => {});
    }
  }, [settings, activeTab, isOnWhatsApp]);

  const handlePrivacyToggle = (enabled: boolean) => update({ privacyEnabled: enabled });
  const handleQuickLock = () => {
    if (activeTab?.id && isOnWhatsApp) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'QUICK_LOCK' } satisfies ExtensionMessage).catch(() => {});
    }
    window.close();
  };

  const handleMaxPrivacy = () => update({
    privacyEnabled: true,
    blurMessages: true,
    blurContactNames: true,
    blurProfilePhotos: true,
    blurImages: true,
    blurVideos: true,
    blurGifsStickers: true,
    blurDocumentPreviews: true,
    blurLinkPreviews: true,
    blurChatListPreviews: true,
    blurChatHeader: true,
    hideOnlineStatus: true,
    hideTypingIndicator: true,
    hideLastSeen: true,
  });

  const openSettings = () => chrome.runtime.openOptionsPage();

  if (loading || !settings) {
    return (
      <div className="header" style={{ padding: '24px', justifyContent: 'center' }}>
        <span style={{ color: '#fff', opacity: 0.7 }}>Loading…</span>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="header-logo" aria-hidden="true">👻</span>
          <div>
            <div className="header-title">What's Not Up</div>
            <div className="header-subtitle">Privacy layer for WhatsApp Web</div>
          </div>
        </div>
        <button
          className="settings-btn"
          onClick={openSettings}
          aria-label="Open settings"
          title="Settings"
        >
          ⚙️
        </button>
      </header>

      {!isOnWhatsApp ? (
        <NotOnWhatsApp />
      ) : (
        <>
          {/* Privacy master toggle */}
          <section className="privacy-toggle-section">
            <div className="privacy-master">
              <span className="privacy-master-label">Privacy Mode</span>
              <Toggle
                id="privacy-master"
                checked={settings.privacyEnabled}
                onChange={handlePrivacyToggle}
                aria-label="Enable privacy mode"
              />
            </div>
            <div className={`privacy-status ${settings.privacyEnabled ? 'active' : ''}`}>
              {settings.privacyEnabled ? '🔒 Content is protected' : '🔓 Content is visible'}
            </div>
          </section>

          {/* Quick actions */}
          <section className="quick-actions">
            <button
              className="btn btn-danger"
              onClick={handleQuickLock}
              title="Show overlay and hide content now"
            >
              🔒 Quick Lock
            </button>
            <button
              className="btn"
              onClick={handleMaxPrivacy}
              title="Enable all protections"
            >
              🛡️ Max Privacy
            </button>
          </section>

          {/* Protection toggles */}
          <section className="section">
            <div className="section-title">Content Protection</div>
            <ToggleRow
              label="Messages"
              checked={settings.blurMessages}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurMessages: v })}
            />
            <ToggleRow
              label="Contact & group names"
              checked={settings.blurContactNames}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurContactNames: v })}
            />
            <ToggleRow
              label="Profile photos"
              checked={settings.blurProfilePhotos}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurProfilePhotos: v })}
            />
            <ToggleRow
              label="Images"
              checked={settings.blurImages}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurImages: v })}
            />
            <ToggleRow
              label="Videos"
              checked={settings.blurVideos}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurVideos: v })}
            />
            <ToggleRow
              label="GIFs & stickers"
              checked={settings.blurGifsStickers}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurGifsStickers: v })}
            />
            <ToggleRow
              label="Link previews"
              checked={settings.blurLinkPreviews}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurLinkPreviews: v })}
            />
            <ToggleRow
              label="Chat list previews"
              checked={settings.blurChatListPreviews}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ blurChatListPreviews: v })}
            />
          </section>

          {/* Status toggles */}
          <section className="section">
            <div className="section-title">Status Visibility</div>
            <ToggleRow
              label="Hide online status"
              checked={settings.hideOnlineStatus}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ hideOnlineStatus: v })}
            />
            <ToggleRow
              label="Hide typing indicator"
              checked={settings.hideTypingIndicator}
              disabled={!settings.privacyEnabled}
              onChange={(v) => update({ hideTypingIndicator: v })}
            />
          </section>

          {/* Reveal mode */}
          <section className="reveal-section">
            <div className="reveal-label">Reveal on</div>
            <div className="reveal-options" role="group" aria-label="Reveal mode">
              {(['hover', 'click', 'temporary'] as RevealMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`reveal-option${settings.revealMode === mode ? ' active' : ''}`}
                  onClick={() => update({ revealMode: mode })}
                  aria-pressed={settings.revealMode === mode}
                  disabled={!settings.privacyEnabled}
                >
                  {mode === 'hover' ? 'Hover' : mode === 'click' ? 'Click' : 'Timed'}
                </button>
              ))}
            </div>
          </section>

          {/* Blur intensity */}
          <section className="blur-section">
            <div className="blur-header">
              <span className="blur-label">Blur intensity</span>
              <span className="blur-value">{settings.blurIntensity}px</span>
            </div>
            <input
              type="range"
              className="blur-slider"
              min={2}
              max={20}
              value={settings.blurIntensity}
              onChange={(e) => update({ blurIntensity: Number(e.target.value) })}
              disabled={!settings.privacyEnabled}
              aria-label="Blur intensity"
            />
          </section>

          <footer className="footer">
            <a href="#" onClick={(e) => { e.preventDefault(); openSettings(); }}>
              Full settings
            </a>
            {' · '}
            <span>Ctrl+Shift+P to lock</span>
          </footer>
        </>
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NotOnWhatsApp() {
  return (
    <div className="not-on-wa">
      <div className="not-on-wa-icon">💬</div>
      <div className="not-on-wa-title">Open WhatsApp Web first</div>
      <div className="not-on-wa-desc">
        What's Not Up works on <strong>web.whatsapp.com</strong>.<br />
        Navigate there to use the extension.
      </div>
      <a
        className="not-on-wa-link"
        href="https://web.whatsapp.com"
        target="_blank"
        rel="noreferrer"
      >
        Open WhatsApp Web
      </a>
    </div>
  );
}

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  'aria-label'?: string;
}

function Toggle({ id, checked, onChange, 'aria-label': ariaLabel }: ToggleProps) {
  return (
    <label className="toggle" htmlFor={id} aria-label={ariaLabel}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        role="switch"
        aria-checked={checked}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, checked, disabled = false, onChange }: ToggleRowProps) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="toggle-row">
      <label htmlFor={id} className={`toggle-row-label${disabled ? ' disabled' : ''}`}>
        {label}
      </label>
      <label className="toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          role="switch"
          aria-checked={checked}
        />
        <span className="toggle-track" aria-hidden="true" />
      </label>
    </div>
  );
}
