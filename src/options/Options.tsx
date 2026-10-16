import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PrivacySettings,
  ThemeMode,
  RevealMode,
  PrivacyProfile,
  ShortcutDescriptor,
  DEFAULT_LOCK_SHORTCUT,
  DEFAULT_UNLOCK_SHORTCUT,
} from '../shared/types';
import { loadSettings, patchSettings, resetSettings } from '../shared/storage';
import { SUPPORTED_HOST_PATTERNS } from '../content/sites/detect';
import {
  validateShortcut,
  shortcutLabel,
  shortcutsConflict,
} from '../content/panic-lock';

type Section = 'privacy' | 'profiles' | 'content' | 'panic-lock' | 'reveal' | 'focus' | 'appearance' | 'advanced';

const NAV: { id: Section; label: string }[] = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'profiles', label: 'Privacy Profiles' },
  { id: 'content', label: 'Content Protection' },
  { id: 'panic-lock', label: 'Panic Lock' },
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
        {section === 'profiles' && <ProfilesSection settings={settings} onUpdate={update} />}
        {section === 'content' && <ContentSection settings={settings} onUpdate={update} />}
        {section === 'panic-lock' && <PanicLockSection settings={settings} onUpdate={update} />}
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

// ─── Privacy Profiles ─────────────────────────────────────────────────────────

const PROFILE_PRESETS: Record<PrivacyProfile, Partial<PrivacySettings>> = {
  custom: {},
  normal: {
    blurMessages: true,
    blurContactNames: true,
    blurProfilePhotos: true,
    blurImages: false,
    blurVideos: false,
    blurGifsStickers: false,
    blurDocumentPreviews: false,
    blurLinkPreviews: false,
    blurChatListPreviews: true,
    blurChatHeader: false,
    hideOnlineStatus: false,
    hideTypingIndicator: false,
    blurCaptions: false,
    blurComments: false,
  },
  balanced: {
    blurMessages: true,
    blurContactNames: true,
    blurProfilePhotos: true,
    blurImages: true,
    blurVideos: true,
    blurGifsStickers: false,
    blurDocumentPreviews: false,
    blurLinkPreviews: true,
    blurChatListPreviews: true,
    blurChatHeader: true,
    hideOnlineStatus: true,
    hideTypingIndicator: false,
    blurCaptions: true,
    blurComments: false,
  },
  maximum: {
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
    blurCaptions: true,
    blurComments: true,
  },
};

const PROFILE_DESCRIPTIONS: Record<PrivacyProfile, string> = {
  custom: 'You have manually adjusted the toggles. No preset is active.',
  normal: 'Protects message text, names, and chat list previews. Media and status indicators remain visible.',
  balanced: 'Protects messages, names, previews, images, videos, link cards and online status. A practical default for most situations.',
  maximum: 'Protects the broadest supported set of visible content. Note: Panic Lock is a visual convenience only — it does not prevent screenshots or protect against other extensions.',
};

function ProfilesSection({ settings, onUpdate }: SectionProps) {
  const apply = (profile: PrivacyProfile) => {
    if (profile === 'custom') return; // custom is only set by manual toggle changes
    onUpdate({ ...PROFILE_PRESETS[profile], privacyProfile: profile });
  };

  return (
    <>
      <h1 className="page-title">Privacy Profiles</h1>
      <p className="page-desc">
        Presets that configure multiple toggles at once. After selecting a preset you
        can still fine-tune individual toggles — that switches the profile to&nbsp;Custom.
      </p>

      {(['normal', 'balanced', 'maximum'] as PrivacyProfile[]).map((profile) => {
        const active = settings.privacyProfile === profile;
        return (
          <div
            key={profile}
            className={`card${active ? ' card-active' : ''}`}
            style={{ cursor: 'pointer', outline: active ? '2px solid var(--color-accent)' : 'none' }}
            onClick={() => apply(profile)}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') apply(profile); }}
          >
            <div className="card-title" style={{ textTransform: 'capitalize' }}>
              {profile === 'normal' ? '🔵' : profile === 'balanced' ? '🟡' : '🔴'} {profile.charAt(0).toUpperCase() + profile.slice(1)}
              {active && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-accent)' }}>Active</span>}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {PROFILE_DESCRIPTIONS[profile]}
            </p>
          </div>
        );
      })}

      {settings.privacyProfile === 'custom' && (
        <div className="card" style={{ padding: '12px 18px', fontSize: 13, color: 'var(--color-text-muted)' }}>
          ✏️ <strong>Custom</strong> — {PROFILE_DESCRIPTIONS.custom}
        </div>
      )}
    </>
  );
}

// ─── Panic Lock ───────────────────────────────────────────────────────────────

function ShortcutRecorder({
  value,
  onChange,
  id,
}: {
  value: ShortcutDescriptor;
  onChange: (s: ShortcutDescriptor) => void;
  id: string;
}) {
  const [recording, setRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Ignore lone modifier keys — wait for a printable key.
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;
    const next: ShortcutDescriptor = {
      key: e.key,
      ctrlKey: e.ctrlKey || e.metaKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
    };
    onChange(next);
    setRecording(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <kbd
        id={id}
        tabIndex={0}
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          background: recording ? 'var(--color-accent)' : 'var(--color-surface-2, #333)',
          color: recording ? '#fff' : 'var(--color-text)',
          borderRadius: 4,
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          fontSize: 13,
          minWidth: 120,
          textAlign: 'center',
          outline: recording ? '2px solid var(--color-accent)' : 'none',
        }}
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={recording ? handleKeyDown : undefined}
        aria-label={recording ? 'Press desired key combination' : `Current shortcut: ${shortcutLabel(value)}`}
      >
        {recording ? 'Press keys…' : shortcutLabel(value)}
      </kbd>
      {recording && (
        <button
          style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          onClick={() => setRecording(false)}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function PanicLockSection({ settings, onUpdate }: SectionProps) {
  const lockValidation = validateShortcut(settings.lockShortcut);
  const unlockValidation = validateShortcut(settings.unlockShortcut);
  const conflict =
    !settings.sameShortcutToggle &&
    shortcutsConflict(settings.lockShortcut, settings.unlockShortcut);

  const resetShortcuts = () => {
    onUpdate({
      lockShortcut: { ...DEFAULT_LOCK_SHORTCUT },
      unlockShortcut: { ...DEFAULT_UNLOCK_SHORTCUT },
      sameShortcutToggle: false,
    });
  };

  return (
    <>
      <h1 className="page-title">Panic Lock</h1>
      <p className="page-desc">
        Instantly force-protect all enabled categories with a keyboard shortcut. The popup
        always shows an <strong>Unlock</strong> button as a guaranteed recovery path.
      </p>

      <div className="card">
        <SettingRow
          label="Enable Panic Lock"
          desc="Allow the Panic Lock shortcuts and the popup Panic Lock button."
          control={
            <Toggle
              id="s-panic-enabled"
              checked={settings.panicLockEnabled}
              onChange={(v) => onUpdate({ panicLockEnabled: v })}
            />
          }
        />
      </div>

      <div className="card" style={{ opacity: settings.panicLockEnabled ? 1 : 0.5, pointerEvents: settings.panicLockEnabled ? 'auto' : 'none' }}>
        <div className="card-title">Shortcuts</div>

        <SettingRow
          label="Use the same shortcut to lock and unlock"
          desc="When on, pressing the lock shortcut again unlocks. When off, separate shortcuts are used."
          control={
            <Toggle
              id="s-same-shortcut"
              checked={settings.sameShortcutToggle}
              onChange={(v) => onUpdate({ sameShortcutToggle: v })}
            />
          }
        />

        <SettingRow
          label="Lock shortcut"
          desc={!lockValidation.valid ? `⚠️ ${lockValidation.reason}` : 'Click the shortcut to change it, then press the desired key combination.'}
          control={
            <ShortcutRecorder
              id="lock-shortcut"
              value={settings.lockShortcut}
              onChange={(s) => onUpdate({ lockShortcut: s })}
            />
          }
        />

        {!settings.sameShortcutToggle && (
          <SettingRow
            label="Unlock shortcut"
            desc={
              conflict
                ? '⚠️ Lock and unlock shortcuts are identical — set a different combination.'
                : !unlockValidation.valid
                ? `⚠️ ${unlockValidation.reason}`
                : 'Shortcut used to leave the locked state.'
            }
            control={
              <ShortcutRecorder
                id="unlock-shortcut"
                value={settings.unlockShortcut}
                onChange={(s) => onUpdate({ unlockShortcut: s })}
              />
            }
          />
        )}

        <div style={{ padding: '10px 18px' }}>
          <button
            className="btn-danger"
            style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}
            onClick={resetShortcuts}
          >
            Restore default shortcuts
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 18px', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        <p><strong>Browser limitations</strong></p>
        <ul style={{ marginTop: 6, paddingLeft: 18 }}>
          <li>Shortcuts only fire when the WhatsApp or Instagram tab is focused.</li>
          <li>Some combinations are reserved by the browser (e.g. Ctrl+T, Ctrl+W) and cannot be used.</li>
          <li>Global shortcuts across all apps require OS-level tools — extensions cannot register those.</li>
          <li>The <strong>Unlock</strong> button in the popup always works as a fallback regardless of shortcut availability.</li>
        </ul>
        <p style={{ marginTop: 10 }}><strong>Privacy note:</strong> Panic Lock is a visual convenience, not encryption. It does not prevent screenshots, browser DevTools, or access by someone who already has physical access to your unlocked device.</p>
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
