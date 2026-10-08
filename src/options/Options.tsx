import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PrivacySettings, ThemeMode, RevealMode } from '../shared/types';
import { loadSettings, patchSettings, resetSettings } from '../shared/storage';
import { SUPPORTED_HOST_PATTERNS } from '../content/sites/detect';

type Section = 'privacy' | 'content' | 'reveal' | 'focus' | 'appearance' | 'advanced';

const NAV: { id: Section; label: string }[] = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'content', label: 'Content Protection' },
  { id: 'reveal', label: 'Reveal Behaviour' },
  { id: 'focus', label: 'Focus / Window' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'advanced', label: 'Advanced' },
];

export default function Options() {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [section, setSection] = useState<Section>('privacy');
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const update = useCallback(async (patch: Partial<PrivacySettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await patchSettings(patch);

    // Notify any open supported-site tabs. The content script also reacts to
    // chrome.storage.onChanged; identical payloads are deduplicated there.
    const tabs = await chrome.tabs.query({ url: [...SUPPORTED_HOST_PATTERNS] });
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: updated,
        }).catch(() => {});
      }
    });

    // Show "Saved" toast
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(true);
    saveTimer.current = setTimeout(() => setSaved(false), 1800);
  }, [settings]);

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    const defaults = await resetSettings();
    setSettings(defaults);

    const tabs = await chrome.tabs.query({ url: [...SUPPORTED_HOST_PATTERNS] });
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: defaults,
        }).catch(() => {});
      }
    });
  };

  if (!settings) {
    return <div style={{ padding: 32, color: 'var(--color-text-muted)' }}>Loading…</div>;
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <nav className="sidebar" aria-label="Settings navigation">
        <div className="sidebar-brand">
          <span className="sidebar-logo">👻</span>
          <span className="sidebar-title">What's Not Up</span>
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item${section === item.id ? ' active' : ''}`}
            onClick={() => setSection(item.id)}
            aria-current={section === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="main">
        {section === 'privacy' && <PrivacySection settings={settings} onUpdate={update} />}
        {section === 'content' && <ContentSection settings={settings} onUpdate={update} />}
        {section === 'reveal' && <RevealSection settings={settings} onUpdate={update} />}
        {section === 'focus' && <FocusSection settings={settings} onUpdate={update} />}
        {section === 'appearance' && <AppearanceSection settings={settings} onUpdate={update} />}
        {section === 'advanced' && <AdvancedSection settings={settings} onUpdate={update} onReset={handleReset} />}
      </main>

      <div className={`save-indicator${saved ? ' visible' : ''}`} role="status" aria-live="polite">
        ✓ Settings saved
      </div>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

interface SectionProps {
  settings: PrivacySettings;
  onUpdate: (patch: Partial<PrivacySettings>) => void;
}

function PrivacySection({ settings, onUpdate }: SectionProps) {
  return (
    <>
      <h1 className="page-title">Privacy</h1>
      <p className="page-desc">Master privacy controls.</p>

      <div className="card">
        <SettingRow
          label="Privacy Mode"
          desc="Enable all active protections on supported sites (WhatsApp Web, Instagram)."
          control={
            <Toggle id="s-privacy" checked={settings.privacyEnabled} onChange={(v) => onUpdate({ privacyEnabled: v })} />
          }
        />
      </div>

      <div className="card">
        <SettingRow
          label="Chat header protection"
          desc="Blur the current contact or group name at the top of the chat."
          control={
            <Toggle id="s-chat-header" checked={settings.blurChatHeader} onChange={(v) => onUpdate({ blurChatHeader: v })} />
          }
        />
        <SettingRow
          label="Hide online / last-seen status"
          desc="Visually hides online and last-seen text. Does not affect what WhatsApp reports to others."
          control={
            <Toggle id="s-online" checked={settings.hideOnlineStatus} onChange={(v) => onUpdate({ hideOnlineStatus: v })} />
          }
        />
        <SettingRow
          label="Hide typing indicator"
          desc="Hides the typing/recording status in the chat header."
          control={
            <Toggle id="s-typing" checked={settings.hideTypingIndicator} onChange={(v) => onUpdate({ hideTypingIndicator: v })} />
          }
        />
      </div>
    </>
  );
}

function ContentSection({ settings, onUpdate }: SectionProps) {
  return (
    <>
      <h1 className="page-title">Content Protection</h1>
      <p className="page-desc">Choose which content types to blur when privacy mode is active.</p>

      <div className="card">
        <div className="card-title">Shared & WhatsApp</div>
        <SettingRow label="Messages" desc="Blur message text in WhatsApp conversations." control={<Toggle id="s-msg" checked={settings.blurMessages} onChange={(v) => onUpdate({ blurMessages: v })} />} />
        <SettingRow label="Contact & group names" desc="Blur names in the chat list and header." control={<Toggle id="s-names" checked={settings.blurContactNames} onChange={(v) => onUpdate({ blurContactNames: v })} />} />
        <SettingRow label="Profile photos" desc="Blur avatar thumbnails (applies on both sites)." control={<Toggle id="s-photos" checked={settings.blurProfilePhotos} onChange={(v) => onUpdate({ blurProfilePhotos: v })} />} />
        <SettingRow label="Images" desc="Blur image attachments and feed photos (applies on both sites)." control={<Toggle id="s-img" checked={settings.blurImages} onChange={(v) => onUpdate({ blurImages: v })} />} />
        <SettingRow label="Videos" desc="Blur video thumbnails, players and reels (applies on both sites)." control={<Toggle id="s-vid" checked={settings.blurVideos} onChange={(v) => onUpdate({ blurVideos: v })} />} />
        <SettingRow label="GIFs & stickers" desc="Blur animated GIFs and stickers where detectable." control={<Toggle id="s-gif" checked={settings.blurGifsStickers} onChange={(v) => onUpdate({ blurGifsStickers: v })} />} />
        <SettingRow label="Document previews" desc="Blur document thumbnail previews." control={<Toggle id="s-doc" checked={settings.blurDocumentPreviews} onChange={(v) => onUpdate({ blurDocumentPreviews: v })} />} />
        <SettingRow label="Link previews" desc="Blur URL preview cards in messages." control={<Toggle id="s-link" checked={settings.blurLinkPreviews} onChange={(v) => onUpdate({ blurLinkPreviews: v })} />} />
        <SettingRow label="Chat list previews" desc="Blur message preview text in the contact list." control={<Toggle id="s-preview" checked={settings.blurChatListPreviews} onChange={(v) => onUpdate({ blurChatListPreviews: v })} />} />
      </div>

      <div className="card">
        <div className="card-title">Instagram</div>
        <SettingRow label="Captions" desc="Blur post captions on profiles and in the feed." control={<Toggle id="s-cap" checked={settings.blurCaptions} onChange={(v) => onUpdate({ blurCaptions: v })} />} />
        <SettingRow label="Comments & comment authors" desc="Blur whole comment rows — author, avatar, timestamp and text reveal together." control={<Toggle id="s-comments" checked={settings.blurComments} onChange={(v) => onUpdate({ blurComments: v })} />} />
        <SettingRow label="Note" desc="Profile photos, images, videos & reels use the shared toggles above. Direct messages and the stories/reels viewers are not yet supported — see Limitations in the docs." control={null} />
      </div>
    </>
  );
}

function RevealSection({ settings, onUpdate }: SectionProps) {
  return (
    <>
      <h1 className="page-title">Reveal Behaviour</h1>
      <p className="page-desc">How protected content is temporarily shown.</p>

      <div className="card">
        <div className="card-title">Reveal mode</div>
        <SettingRow
          label="Hover to reveal"
          desc="Content becomes visible while you hover over it."
          control={
            <input type="radio" name="reveal-mode" value="hover" checked={settings.revealMode === 'hover'} onChange={() => onUpdate({ revealMode: 'hover' as RevealMode })} aria-label="Hover" />
          }
        />
        <SettingRow
          label="Click to reveal"
          desc="Click protected content to toggle its visibility."
          control={
            <input type="radio" name="reveal-mode" value="click" checked={settings.revealMode === 'click'} onChange={() => onUpdate({ revealMode: 'click' as RevealMode })} aria-label="Click" />
          }
        />
        <SettingRow
          label="Temporary reveal"
          desc="Content is shown for a set duration after clicking, then hides again."
          control={
            <input type="radio" name="reveal-mode" value="temporary" checked={settings.revealMode === 'temporary'} onChange={() => onUpdate({ revealMode: 'temporary' as RevealMode })} aria-label="Temporary" />
          }
        />
        {settings.revealMode === 'temporary' && (
          <SettingRow
            label="Reveal duration"
            desc="How long content stays visible after a temporary reveal."
            control={
              <div className="range-container">
                <input
                  type="range"
                  className="range-input"
                  min={500}
                  max={10000}
                  step={500}
                  value={settings.temporaryRevealDurationMs}
                  onChange={(e) => onUpdate({ temporaryRevealDurationMs: Number(e.target.value) })}
                  aria-label="Reveal duration"
                />
                <span className="range-value">{(settings.temporaryRevealDurationMs / 1000).toFixed(1)}s</span>
              </div>
            }
          />
        )}
      </div>

      <div className="card">
        <div className="card-title">Blur intensity</div>
        <SettingRow
          label="Blur strength"
          desc="Higher values make content harder to read through the blur."
          control={
            <div className="range-container">
              <input
                type="range"
                className="range-input"
                min={2}
                max={20}
                value={settings.blurIntensity}
                onChange={(e) => onUpdate({ blurIntensity: Number(e.target.value) })}
                aria-label="Blur intensity"
              />
              <span className="range-value">{settings.blurIntensity}px</span>
            </div>
          }
        />
      </div>
    </>
  );
}

function FocusSection({ settings, onUpdate }: SectionProps) {
  return (
    <>
      <h1 className="page-title">Focus / Window Behaviour</h1>
      <p className="page-desc">Control privacy when the supported site loses focus.</p>

      <div className="card">
        <SettingRow
          label="Show overlay when window loses focus"
          desc="Covers the page with the privacy overlay whenever you switch to another app or tab."
          control={
            <Toggle id="s-focus" checked={settings.blurOnFocusLoss} onChange={(v) => onUpdate({ blurOnFocusLoss: v })} />
          }
        />
      </div>

      <div className="card" style={{ padding: '14px 18px', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        <p><strong>Keyboard shortcut</strong></p>
        <p style={{ marginTop: 6 }}>Press <kbd>Ctrl+Shift+P</kbd> (or <kbd>Cmd+Shift+P</kbd> on Mac) at any time on a supported site to toggle the privacy overlay.</p>
      </div>
    </>
  );
}

function AppearanceSection({ settings, onUpdate }: SectionProps) {
  return (
    <>
      <h1 className="page-title">Appearance</h1>
      <p className="page-desc">Extension UI theme preference.</p>

      <div className="card">
        <SettingRow
          label="Theme"
          desc="Controls the extension popup and settings page appearance."
          control={
            <select
              className="select"
              value={settings.theme}
              onChange={(e) => onUpdate({ theme: e.target.value as ThemeMode })}
              aria-label="Theme"
            >
              <option value="system">System default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          }
        />
      </div>
    </>
  );
}

interface AdvancedSectionProps extends SectionProps {
  onReset: () => void;
}

function AdvancedSection({ settings, onUpdate, onReset }: AdvancedSectionProps) {
  return (
    <>
      <h1 className="page-title">Advanced</h1>
      <p className="page-desc">Debug and reset options.</p>

      <div className="card">
        <SettingRow
          label="Re-show onboarding"
          desc="Open the first-use guide again."
          control={
            <button
              className="btn-danger"
              style={{ background: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}
              onClick={() => {
                onUpdate({ onboardingComplete: false });
                chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
              }}
            >
              Open onboarding
            </button>
          }
        />
        <SettingRow
          label="Current settings"
          desc="Inspect the raw stored settings for debugging."
          control={null}
        />
        <div style={{ padding: '0 18px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)', overflowX: 'auto' }}>
          <pre>{JSON.stringify(settings, null, 2)}</pre>
        </div>
      </div>

      <div className={`card danger-zone`}>
        <div className="card-title" style={{ color: 'var(--color-danger)', paddingTop: 14 }}>Danger Zone</div>
        <SettingRow
          label="Reset all settings"
          desc="Revert every setting to its default value. This cannot be undone."
          control={
            <button className="btn-danger" onClick={onReset}>Reset settings</button>
          }
        />
      </div>
    </>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

interface SettingRowProps {
  label: string;
  desc?: string;
  control: React.ReactNode;
}

function SettingRow({ label, desc, control }: SettingRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-info">
        <div className="setting-label">{label}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      {control !== null && <div>{control}</div>}
    </div>
  );
}

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ id, checked, onChange }: ToggleProps) {
  return (
    <label className="toggle" htmlFor={id}>
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
