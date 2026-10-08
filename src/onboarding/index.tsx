import React from 'react';
import { createRoot } from 'react-dom/client';
import { patchSettings } from '../shared/storage';
import './onboarding.css';

function Onboarding() {
  const finish = async () => {
    await patchSettings({ onboardingComplete: true, privacyEnabled: true });
    window.location.href = 'https://web.whatsapp.com';
  };

  const skip = async () => {
    await patchSettings({ onboardingComplete: true });
    window.close();
  };

  return (
    <div className="card">
      <div className="hero">
        <div className="hero-icon">👻</div>
        <div className="hero-title">What's Not Up</div>
        <div className="hero-subtitle">A local privacy layer for WhatsApp & Instagram</div>
      </div>
      <div className="body">
        <ul className="features">
          <li className="feature">
            <span className="feature-icon">🔒</span>
            <div className="feature-text">
              <strong>Blurs your content locally</strong>
              <span>Messages, names, photos, and media are blurred in your browser. Nothing is uploaded or shared.</span>
            </div>
          </li>
          <li className="feature">
            <span className="feature-icon">👁️</span>
            <div className="feature-text">
              <strong>Hover or click to reveal</strong>
              <span>You can see any protected element by hovering or clicking it. Privacy mode never locks you out.</span>
            </div>
          </li>
          <li className="feature">
            <span className="feature-icon">⌨️</span>
            <div className="feature-text">
              <strong>Emergency shortcut</strong>
              <span>Press Ctrl+Shift+P (Cmd+Shift+P on Mac) to instantly cover the screen with a privacy overlay.</span>
            </div>
          </li>
          <li className="feature">
            <span className="feature-icon">⚙️</span>
            <div className="feature-text">
              <strong>Fully configurable</strong>
              <span>Choose exactly which content types to protect, how blur-heavy it is, and how reveals work.</span>
            </div>
          </li>
        </ul>

        <div className="privacy-note">
          🛡️ <strong>Your content never leaves your browser.</strong> The extension does not collect, store, or transmit content — privacy transformations are applied locally to content already rendered by the website.
        </div>

        <div className="actions">
          <button className="btn-primary" onClick={finish}>
            Enable and open WhatsApp Web
          </button>
          <button className="btn-secondary" onClick={skip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root not found');

createRoot(root).render(
  <React.StrictMode>
    <Onboarding />
  </React.StrictMode>
);
