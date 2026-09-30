/**
 * YouTube Gamepad TV - HUD Module (hud.js)
 * Manages on-screen toasts, TV volume bar, and controller mapping legend modal.
 */

(function () {
  'use strict';

  class GamepadHUD {
    constructor() {
      this.toastContainer = null;
      this.volumeHud = null;
      this.volumeHideTimer = null;
      this.legendOverlay = null;
      this.isLegendVisible = false;
      this.settings = {
        showToasts: true,
        autoSkipAds: true,
        deadzone: 0.25,
        enabled: true
      };

      this.init();
    }

    init() {
      // Ensure body exists before appending containers
      if (document.body) {
        this.setupDOM();
      } else {
        document.addEventListener('DOMContentLoaded', () => this.setupDOM());
      }
    }

    setupDOM() {
      if (!this.toastContainer && !document.getElementById('yt-gamepad-toast-container')) {
        this.toastContainer = document.createElement('div');
        this.toastContainer.id = 'yt-gamepad-toast-container';
        document.body.appendChild(this.toastContainer);
      } else {
        this.toastContainer = document.getElementById('yt-gamepad-toast-container');
      }

      this.createVolumeHud();
      this.createLegendModal();
    }

    updateSettings(newSettings) {
      this.settings = Object.assign(this.settings, newSettings);
    }

    // ------------------------------------------------------------------------
    // Toast Notification System
    // ------------------------------------------------------------------------
    showToast(title, message, icon = '🎮', duration = 3500) {
      if (!this.settings.showToasts) return;
      if (!this.toastContainer) this.setupDOM();
      if (!this.toastContainer) return;

      // Single-Toast Engine: remove any active toast with the same title to prevent stacked duplicates
      const existingToasts = this.toastContainer.querySelectorAll('.yt-gamepad-toast');
      existingToasts.forEach((t) => {
        const titleEl = t.querySelector('.yt-gamepad-toast-title');
        if (titleEl && titleEl.textContent === title) {
          t.remove();
        }
      });

      const toast = document.createElement('div');
      toast.className = 'yt-gamepad-toast';
      toast.innerHTML = `
        <div class="yt-gamepad-toast-icon">${icon}</div>
        <div class="yt-gamepad-toast-content">
          <div class="yt-gamepad-toast-title">${this.escapeHTML(title)}</div>
          <div class="yt-gamepad-toast-message">${this.escapeHTML(message)}</div>
        </div>
      `;

      this.toastContainer.appendChild(toast);

      // Force layout calculation for transition trigger
      void toast.offsetWidth;
      toast.classList.add('yt-gamepad-toast-show');

      setTimeout(() => {
        toast.classList.remove('yt-gamepad-toast-show');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 320);
      }, duration);
    }

    // ------------------------------------------------------------------------
    // TV Volume Indicator
    // ------------------------------------------------------------------------
    createVolumeHud() {
      if (document.getElementById('yt-gamepad-volume-hud')) {
        this.volumeHud = document.getElementById('yt-gamepad-volume-hud');
        return;
      }

      const hud = document.createElement('div');
      hud.id = 'yt-gamepad-volume-hud';
      hud.innerHTML = `
        <div class="yt-gamepad-volume-icon" id="yt-gamepad-volume-icon">🔊</div>
        <div class="yt-gamepad-volume-track">
          <div class="yt-gamepad-volume-fill" id="yt-gamepad-volume-fill"></div>
        </div>
        <div class="yt-gamepad-volume-text" id="yt-gamepad-volume-text">100%</div>
      `;
      document.body.appendChild(hud);
      this.volumeHud = hud;
    }

    showVolume(volumePercent, isMuted) {
      if (!this.volumeHud) this.createVolumeHud();
      if (!this.volumeHud) return;

      const iconEl = document.getElementById('yt-gamepad-volume-icon');
      const fillEl = document.getElementById('yt-gamepad-volume-fill');
      const textEl = document.getElementById('yt-gamepad-volume-text');

      const percent = Math.round(Math.max(0, Math.min(100, volumePercent)));

      if (isMuted || percent === 0) {
        if (iconEl) iconEl.textContent = '🔇';
        if (textEl) textEl.textContent = 'MUTE';
        if (fillEl) fillEl.style.width = '0%';
      } else {
        if (iconEl) iconEl.textContent = percent > 50 ? '🔊' : '🔉';
        if (textEl) textEl.textContent = `${percent}%`;
        if (fillEl) fillEl.style.width = `${percent}%`;
      }

      this.volumeHud.classList.add('yt-gamepad-volume-show');

      if (this.volumeHideTimer) {
        clearTimeout(this.volumeHideTimer);
      }

      this.volumeHideTimer = setTimeout(() => {
        if (this.volumeHud) {
          this.volumeHud.classList.remove('yt-gamepad-volume-show');
        }
      }, 1500);
    }

    // ------------------------------------------------------------------------
    // Controller Mapping Legend Modal
    // ------------------------------------------------------------------------
    createLegendModal() {
      if (document.getElementById('yt-gamepad-legend-overlay')) {
        this.legendOverlay = document.getElementById('yt-gamepad-legend-overlay');
        return;
      }

      const overlay = document.createElement('div');
      overlay.id = 'yt-gamepad-legend-overlay';
      overlay.innerHTML = `
        <div class="yt-gamepad-legend-modal" role="dialog" aria-modal="true" aria-label="Controller Mapping Reference">
          <div class="yt-gamepad-legend-header">
            <div class="yt-gamepad-legend-brand">
              <div class="yt-gamepad-legend-brand-icon">▶</div>
              <div>
                <h2 class="yt-gamepad-legend-title">YouTube Gamepad TV</h2>
                <p class="yt-gamepad-legend-subtitle">Console Controller Mapping Guide</p>
              </div>
            </div>
            <button class="yt-gamepad-legend-close-btn" id="yt-gamepad-legend-close" aria-label="Close legend">&times;</button>
          </div>
          
          <div class="yt-gamepad-legend-body">
            <!-- Navigation -->
            <div class="yt-gamepad-legend-section">
              <div class="yt-gamepad-legend-section-title">Navigation & Selection</div>
              <div class="yt-gamepad-legend-list">
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-gray">D-PAD</span>
                    <span class="yt-gamepad-badge yt-badge-gray">L-STICK</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Grid Navigation / Seek</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-green">A</span>
                    <span class="yt-gamepad-badge yt-badge-blue">✕</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Select / Click / Play-Pause</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-red">B</span>
                    <span class="yt-gamepad-badge yt-badge-red">○</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Back / Exit / Close</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-yellow">Y</span>
                    <span class="yt-gamepad-badge yt-badge-green">△</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Jump To Header (Search Teleport)</span>
                </div>
              </div>
            </div>

            <!-- Video Player Controls -->
            <div class="yt-gamepad-legend-section">
              <div class="yt-gamepad-legend-section-title">Video Playback</div>
              <div class="yt-gamepad-legend-list">
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-blue">X</span>
                    <span class="yt-gamepad-badge yt-badge-purple">□</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Toggle Fullscreen</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-gray">LB</span>
                    <span class="yt-gamepad-badge yt-badge-gray">L1</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Skip 10s Back (J)</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-gray">RB</span>
                    <span class="yt-gamepad-badge yt-badge-gray">R1</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Skip 10s Forward (L)</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-gray">LT / RT</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Volume Down / Up</span>
                </div>
              </div>
            </div>

            <!-- System & Shortcuts -->
            <div class="yt-gamepad-legend-section" style="grid-column: span 2;">
              <div class="yt-gamepad-legend-section-title">Shortcuts & Overrides</div>
              <div class="yt-gamepad-legend-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-gray">START</span>
                    <span class="yt-gamepad-badge yt-badge-gray">OPTIONS</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Mute / Unmute (M)</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-gray">SELECT</span>
                    <span class="yt-gamepad-badge yt-badge-gray">VIEW</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Toggle This Guide</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-purple">R3</span>
                    <span class="yt-gamepad-badge yt-badge-gray">STICK CLICK</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Manual Ad Skip</span>
                </div>
                <div class="yt-gamepad-legend-row">
                  <span class="yt-gamepad-legend-key">
                    <span class="yt-gamepad-badge yt-badge-purple">L3</span>
                    <span class="yt-gamepad-badge yt-badge-gray">STICK CLICK</span>
                  </span>
                  <span class="yt-gamepad-legend-desc">Reset Focus To Top</span>
                </div>
              </div>
            </div>
          </div>

          <div class="yt-gamepad-legend-footer">
            <div class="yt-gamepad-legend-footer-tip">
              <span>💡</span>
              <span>Universal D-Pad navigates Header ↔ Left Sidebar ↔ Feed ↔ Watch Controls ↔ Comments ↔ Sidebar.</span>
            </div>
            <div>Press <strong style="color:#ff5555;">[B]</strong> or <strong style="color:#ffffff;">[SELECT]</strong> to close</div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.legendOverlay = overlay;

      const closeBtn = document.getElementById('yt-gamepad-legend-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hideLegend());
      }

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hideLegend();
        }
      });
    }

    toggleLegend() {
      if (this.isLegendVisible) {
        this.hideLegend();
      } else {
        this.showLegend();
      }
    }

    showLegend() {
      if (!this.legendOverlay) this.createLegendModal();
      if (!this.legendOverlay) return;

      this.legendOverlay.classList.add('yt-gamepad-legend-open');
      this.isLegendVisible = true;
    }

    hideLegend() {
      if (!this.legendOverlay) return;
      this.legendOverlay.classList.remove('yt-gamepad-legend-open');
      this.isLegendVisible = false;
    }

    isLegendOpen() {
      return this.isLegendVisible;
    }

    escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Attach to window namespace
  window.YTGamepadHUD = new GamepadHUD();
})();

