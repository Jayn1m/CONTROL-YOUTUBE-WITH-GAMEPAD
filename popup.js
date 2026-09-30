/**
 * YouTube Gamepad TV - Popup Settings Script (popup.js)
 * Manages configuration persistence via chrome.storage.local and live controller status.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // DOM Elements
  const enabledToggle = document.getElementById('enabledToggle');
  const deadzoneSlider = document.getElementById('deadzoneSlider');
  const deadzoneDisplay = document.getElementById('deadzoneDisplay');
  const autoSkipAdsToggle = document.getElementById('autoSkipAdsToggle');
  const toastsToggle = document.getElementById('toastsToggle');
  const statusDot = document.getElementById('statusDot');
  const statusLabel = document.getElementById('statusLabel');

  // Default configuration
  const defaultSettings = {
    enabled: true,
    deadzone: 0.25,
    autoSkipAds: true,
    showToasts: true
  };

  // 1. Load saved settings from chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(defaultSettings, (items) => {
      enabledToggle.checked = Boolean(items.enabled);
      autoSkipAdsToggle.checked = Boolean(items.autoSkipAds);
      toastsToggle.checked = Boolean(items.showToasts);

      const dz = parseFloat(items.deadzone) || 0.25;
      deadzoneSlider.value = dz.toFixed(2);
      deadzoneDisplay.textContent = dz.toFixed(2);
    });
  }

  // 2. Save settings on change
  function saveSetting(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [key]: value });
    }
  }

  enabledToggle.addEventListener('change', (e) => {
    saveSetting('enabled', e.target.checked);
  });

  autoSkipAdsToggle.addEventListener('change', (e) => {
    saveSetting('autoSkipAds', e.target.checked);
  });

  toastsToggle.addEventListener('change', (e) => {
    saveSetting('showToasts', e.target.checked);
  });

  deadzoneSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value).toFixed(2);
    deadzoneDisplay.textContent = val;
    saveSetting('deadzone', parseFloat(val));
  });

  // 3. Live Gamepad Detection & Status Polling
  function updateGamepadStatus() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let connectedGamepad = null;

    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        connectedGamepad = gamepads[i];
        break;
      }
    }

    if (connectedGamepad) {
      statusDot.classList.add('connected');
      // Clean up controller name (remove vendor/product IDs in parentheses)
      const cleanName = connectedGamepad.id.replace(/\([^)]*\)/g, '').trim() || 'Standard Gamepad';
      statusLabel.textContent = `Connected: ${cleanName}`;
      statusLabel.title = connectedGamepad.id;
    } else {
      statusDot.classList.remove('connected');
      statusLabel.textContent = 'No Gamepad Detected (Press any button)';
      statusLabel.title = 'Connect a controller via USB/Bluetooth and press any button to wake the Gamepad API.';
    }
  }

  // Poll status while popup window is open
  updateGamepadStatus();
  const statusPollInterval = setInterval(updateGamepadStatus, 500);

  window.addEventListener('gamepadconnected', updateGamepadStatus);
  window.addEventListener('gamepaddisconnected', updateGamepadStatus);
  window.addEventListener('unload', () => clearInterval(statusPollInterval));
});

