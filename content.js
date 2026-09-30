/**
 * YouTube Gamepad TV - Core Input Poller & Action Router (content.js)
 * Implements Gamepad API polling loop, debouncing, auto-repeat, shortcut teleport, and debounced single-toast ad-skipper.
 */

(function () {
  'use strict';

  class GamepadController {
    constructor() {
      this.activeGamepadIndex = null;
      this.isPolling = false;
      this.animationFrameId = null;

      // Configuration settings
      this.settings = {
        enabled: true,
        deadzone: 0.25,
        autoSkipAds: true,
        showToasts: true
      };

      // Button state tracking for one-shot debouncing
      this.prevButtons = {};

      // Directional input auto-repeat states: 300ms initial hold delay, 100ms repeat
      this.directionState = {
        up: { active: false, startTime: 0, lastRepeatTime: 0 },
        down: { active: false, startTime: 0, lastRepeatTime: 0 },
        left: { active: false, startTime: 0, lastRepeatTime: 0 },
        right: { active: false, startTime: 0, lastRepeatTime: 0 }
      };

      // Debounced Ad-Skipper State Lock & Cooldown Timer
      this.isAdSkipToastOnCooldown = false;
      this.adObserver = null;
      this.adPollInterval = null;

      this.init();
    }

    init() {
      this.loadSettings();
      this.bindStorageListener();
      this.bindGamepadEvents();
      this.startAutomaticAdSkipper();

      // Check if gamepad is already active on page load
      this.detectInitialGamepad();
    }

    // ------------------------------------------------------------------------
    // Settings Management
    // ------------------------------------------------------------------------
    loadSettings() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          {
            enabled: true,
            deadzone: 0.25,
            autoSkipAds: true,
            showToasts: true
          },
          (items) => {
            this.settings = Object.assign(this.settings, items);
            if (window.YTGamepadHUD) {
              window.YTGamepadHUD.updateSettings(this.settings);
            }
          }
        );
      }
    }

    bindStorageListener() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace !== 'local') return;

          for (const [key, change] of Object.entries(changes)) {
            this.settings[key] = change.newValue;
          }

          if (window.YTGamepadHUD) {
            window.YTGamepadHUD.updateSettings(this.settings);
          }

          if (!this.settings.enabled && window.YTGamepadSpatialNav) {
            window.YTGamepadSpatialNav.clearFocus();
          }
        });
      }
    }

    // ------------------------------------------------------------------------
    // Gamepad Connection Listeners
    // ------------------------------------------------------------------------
    bindGamepadEvents() {
      window.addEventListener('gamepadconnected', (e) => {
        this.activeGamepadIndex = e.gamepad.index;
        if (window.YTGamepadHUD) {
          window.YTGamepadHUD.showToast('Controller Connected', e.gamepad.id.split('(')[0].trim() || 'Gamepad');
        }
        this.startLoop();
      });

      window.addEventListener('gamepaddisconnected', (e) => {
        if (this.activeGamepadIndex === e.gamepad.index) {
          this.activeGamepadIndex = null;
        }
        if (window.YTGamepadHUD) {
          window.YTGamepadHUD.showToast('Controller Disconnected', 'Disconnected');
        }
        this.resetDirectionStates();
      });
    }

    detectInitialGamepad() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && gp.connected) {
          this.activeGamepadIndex = gp.index;
          if (window.YTGamepadHUD) {
            window.YTGamepadHUD.showToast('Controller Active', gp.id.split('(')[0].trim() || 'Gamepad');
          }
          this.startLoop();
          break;
        }
      }
    }

    // ------------------------------------------------------------------------
    // Gamepad Polling Loop (requestAnimationFrame)
    // ------------------------------------------------------------------------
    startLoop() {
      if (this.isPolling) return;
      this.isPolling = true;

      const loop = (timestamp) => {
        if (!this.isPolling) return;
        this.pollGamepads(timestamp);
        this.animationFrameId = requestAnimationFrame(loop);
      };

      this.animationFrameId = requestAnimationFrame(loop);
    }

    stopLoop() {
      this.isPolling = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    getActiveGamepad() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]) {
        return gamepads[this.activeGamepadIndex];
      }
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          this.activeGamepadIndex = gamepads[i].index;
          return gamepads[i];
        }
      }
      return null;
    }

    pollGamepads(now) {
      if (!this.settings.enabled) return;

      const gp = this.getActiveGamepad();
      if (!gp) return;

      const deadzone = Math.max(0.1, Math.min(0.5, this.settings.deadzone || 0.25));

      // 1. Process Analog Stick & D-Pad Directions
      const axisX = gp.axes.length > 0 ? gp.axes[0] : 0;
      const axisY = gp.axes.length > 1 ? gp.axes[1] : 0;

      const dpadUp = gp.buttons[12] && gp.buttons[12].pressed;
      const dpadDown = gp.buttons[13] && gp.buttons[13].pressed;
      const dpadLeft = gp.buttons[14] && gp.buttons[14].pressed;
      const dpadRight = gp.buttons[15] && gp.buttons[15].pressed;

      const stickUp = axisY < -deadzone;
      const stickDown = axisY > deadzone;
      const stickLeft = axisX < -deadzone;
      const stickRight = axisX > deadzone;

      const directions = {
        up: Boolean(dpadUp || stickUp),
        down: Boolean(dpadDown || stickDown),
        left: Boolean(dpadLeft || stickLeft),
        right: Boolean(dpadRight || stickRight)
      };

      this.processDirectionalAutoRepeat(directions, now);

      // 2. Process Action Buttons (single trigger on press down)
      const buttonCount = Math.min(gp.buttons.length, 16);
      for (let i = 0; i < buttonCount; i++) {
        // Skip D-Pad directions (handled above)
        if (i >= 12 && i <= 15) continue;

        const btn = gp.buttons[i];
        const isPressed = Boolean(btn && (btn.pressed || btn.value > 0.5));
        const wasPressed = Boolean(this.prevButtons[i]);

        if (isPressed && !wasPressed) {
          this.routeButtonAction(i);
        }

        this.prevButtons[i] = isPressed;
      }
    }

    // ------------------------------------------------------------------------
    // Directional Auto-Repeat Engine (300ms initial hold delay, 100ms repeat)
    // ------------------------------------------------------------------------
    processDirectionalAutoRepeat(directions, now) {
      const keys = ['up', 'down', 'left', 'right'];

      for (let i = 0; i < keys.length; i++) {
        const dir = keys[i];
        const isHeld = directions[dir];
        const state = this.directionState[dir];

        if (isHeld) {
          if (!state.active) {
            state.active = true;
            state.startTime = now;
            state.lastRepeatTime = now;
            this.handleDirectionInput(dir);
          } else {
            const heldDuration = now - state.startTime;
            if (heldDuration >= 300) {
              if (now - state.lastRepeatTime >= 100) {
                state.lastRepeatTime = now;
                this.handleDirectionInput(dir);
              }
            }
          }
        } else {
          state.active = false;
        }
      }
    }

    resetDirectionStates() {
      this.directionState.up.active = false;
      this.directionState.down.active = false;
      this.directionState.left.active = false;
      this.directionState.right.active = false;
      this.prevButtons = {};
    }

    // ------------------------------------------------------------------------
    // Controller Mappings & Action Router
    // ------------------------------------------------------------------------
    routeButtonAction(buttonIndex) {
      switch (buttonIndex) {
        // A / Cross (0): Select / Click focused element / Play-Pause (K)
        case 0:
          this.handleButtonA();
          break;

        // B / Circle (1): Back / Exit Fullscreen (Escape)
        case 1:
          this.handleButtonB();
          break;

        // X / Square (2): Toggle Fullscreen (F)
        case 2:
          this.toggleFullscreen();
          break;

        // Y / Triangle (3): JUMP TO HEADER SHORTCUT (Search Teleport)
        case 3:
          this.jumpToHeaderSearch();
          break;

        // LB / L1 (4): Skip 10s Backward (J)
        case 4:
          this.skipVideoTime(-10);
          break;

        // RB / R1 (5): Skip 10s Forward (L)
        case 5:
          this.skipVideoTime(10);
          break;

        // LT / L2 (6): Decrease Volume
        case 6:
          this.adjustVolume(-0.05);
          break;

        // RT / R2 (7): Increase Volume
        case 7:
          this.adjustVolume(0.05);
          break;

        // Select / View (8): Toggle HUD controller legend modal
        case 8:
          if (window.YTGamepadHUD) {
            window.YTGamepadHUD.toggleLegend();
          }
          break;

        // Start / Menu (9): Toggle Mute (M)
        case 9:
          this.toggleMute();
          break;

        // L3 / Left Stick Click (10): Reset Focus to default top
        case 10:
          if (window.YTGamepadSpatialNav) {
            window.YTGamepadSpatialNav.setDefaultRouteFocus();
          }
          break;

        // R3 / Right Stick Click (11): Quick Manual Ad Skip
        case 11:
          this.handleAutoAdSkip(true);
          break;

        default:
          break;
      }
    }

    // ------------------------------------------------------------------------
    // Directional Spatial Navigation
    // ------------------------------------------------------------------------
    handleDirectionInput(direction) {
      // Dismiss HUD legend if open
      if (window.YTGamepadHUD && window.YTGamepadHUD.isLegendOpen()) {
        window.YTGamepadHUD.hideLegend();
        return;
      }

      const isFullscreen = window.YTGamepadSpatialNav ? window.YTGamepadSpatialNav.isFullscreen() : false;

      // In Fullscreen mode, Left/Right seeks 5s, Up/Down controls volume
      if (isFullscreen) {
        if (direction === 'left') {
          this.skipVideoTime(-5);
        } else if (direction === 'right') {
          this.skipVideoTime(5);
        } else if (direction === 'up') {
          this.adjustVolume(0.05);
        } else if (direction === 'down') {
          this.adjustVolume(-0.05);
        }
        return;
      }

      // Universal 2D Spatial Grid Navigation across Header <-> Left Sidebar <-> Feed Thumbnails <-> Watch Controls <-> Comments <-> Recommendations
      if (window.YTGamepadSpatialNav) {
        window.YTGamepadSpatialNav.move(direction);
      }
    }

    // ------------------------------------------------------------------------
    // Action Implementations
    // ------------------------------------------------------------------------
    handleButtonA() {
      if (window.YTGamepadHUD && window.YTGamepadHUD.isLegendOpen()) {
        window.YTGamepadHUD.hideLegend();
        return;
      }

      if (window.YTGamepadSpatialNav) {
        const activated = window.YTGamepadSpatialNav.activateCurrentFocus();
        if (!activated) {
          this.togglePlayPause();
        }
      } else {
        this.togglePlayPause();
      }
    }

    handleButtonB() {
      // 1. Close Legend overlay if open
      if (window.YTGamepadHUD && window.YTGamepadHUD.isLegendOpen()) {
        window.YTGamepadHUD.hideLegend();
        return;
      }

      // 2. Unfocus search input if active
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.blur();
        if (window.YTGamepadSpatialNav) {
          window.YTGamepadSpatialNav.setDefaultRouteFocus();
        }
        return;
      }

      // 3. Exit Fullscreen if active
      if (window.YTGamepadSpatialNav && window.YTGamepadSpatialNav.isFullscreen()) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        return;
      }

      // 4. Close any open dialog or popup
      const dialog = document.querySelector('ytd-popup-container yt-confirm-dialog-renderer, ytd-menu-popup-renderer');
      if (dialog) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        return;
      }

      // 5. Navigate back in history if on watch page
      if (window.YTGamepadSpatialNav && window.YTGamepadSpatialNav.isWatchPage()) {
        window.history.back();
      }
    }

    toggleFullscreen() {
      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      if (player && typeof player.toggleFullscreen === 'function') {
        player.toggleFullscreen();
      } else {
        const fsBtn = document.querySelector('.ytp-fullscreen-button');
        if (fsBtn) {
          fsBtn.click();
        } else {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', keyCode: 70, bubbles: true }));
        }
      }
    }

    /**
     * Y / Triangle (3): JUMP TO HEADER SHORTCUT
     * Instantly teleports focus directly to YouTube's search bar from anywhere on the page.
     */
    jumpToHeaderSearch() {
      const searchInput = document.querySelector(
        '#search-form input, input#search, input[name="search_query"], ytd-searchbox input, #ytd-searchbox input'
      );

      if (searchInput) {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        if (window.YTGamepadSpatialNav) {
          window.YTGamepadSpatialNav.setFocus(searchInput, false);
        }
        searchInput.focus();
        if (typeof searchInput.select === 'function') {
          searchInput.select();
        }
        if (window.YTGamepadHUD) {
          window.YTGamepadHUD.showToast('Search Teleport', 'Header search bar focused', '🔍', 2000);
        }
      }
    }

    togglePlayPause() {
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      const player = document.getElementById('movie_player');

      if (player && typeof player.getPlayerState === 'function') {
        const state = player.getPlayerState();
        if (state === 1) {
          player.pauseVideo();
        } else {
          player.playVideo();
        }
        return;
      }

      if (video) {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
      } else {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', keyCode: 75, bubbles: true }));
      }
    }

    skipVideoTime(seconds) {
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      const player = document.getElementById('movie_player');

      if (player && typeof player.seekBy === 'function') {
        player.seekBy(seconds);
        return;
      }

      if (video) {
        video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
      } else {
        const key = seconds > 0 ? 'l' : 'j';
        const code = seconds > 0 ? 'KeyL' : 'KeyJ';
        const keyCode = seconds > 0 ? 76 : 74;
        window.dispatchEvent(new KeyboardEvent('keydown', { key, code, keyCode, bubbles: true }));
      }
    }

    adjustVolume(delta) {
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      const player = document.getElementById('movie_player');

      let currentVol = 1.0;
      let isMuted = false;

      if (video) {
        if (video.muted && delta > 0) {
          video.muted = false;
        }
        currentVol = Math.max(0, Math.min(1, video.volume + delta));
        video.volume = currentVol;
        isMuted = video.muted;
      } else if (player && typeof player.getVolume === 'function') {
        let playerVol = player.getVolume() + delta * 100;
        playerVol = Math.max(0, Math.min(100, playerVol));
        player.setVolume(playerVol);
        currentVol = playerVol / 100;
        isMuted = player.isMuted();
      }

      if (window.YTGamepadHUD) {
        window.YTGamepadHUD.showVolume(currentVol * 100, isMuted);
      }
    }

    toggleMute() {
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      const player = document.getElementById('movie_player');

      let isMuted = false;
      let vol = 100;

      if (video) {
        video.muted = !video.muted;
        isMuted = video.muted;
        vol = video.volume * 100;
      } else if (player && typeof player.isMuted === 'function') {
        if (player.isMuted()) {
          player.unMute();
          isMuted = false;
        } else {
          player.mute();
          isMuted = true;
        }
        vol = player.getVolume();
      } else {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', keyCode: 77, bubbles: true }));
      }

      if (window.YTGamepadHUD) {
        window.YTGamepadHUD.showVolume(vol, isMuted);
      }
    }

    // ------------------------------------------------------------------------
    // 2. DEBOUNCED AD-SKIPPER & SINGLE-TOAST ENGINE
    // ------------------------------------------------------------------------
    isElementVisible(el) {
      if (!el || !el.isConnected) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    handleAutoAdSkip(isManual = false) {
      const skipButton = document.querySelector(
        '.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button, button.ytp-ad-skip-button-container, .ytp-ad-skip-button-slot, .ytp-ad-overlay-close-button, .ytp-skip-ad-button-text'
      );

      if (skipButton && this.isElementVisible(skipButton)) {
        // Perform the click immediately
        try {
          skipButton.click();
          const opts = { bubbles: true, cancelable: true, view: window };
          skipButton.dispatchEvent(new PointerEvent('pointerdown', opts));
          skipButton.dispatchEvent(new MouseEvent('mousedown', opts));
          skipButton.dispatchEvent(new PointerEvent('pointerup', opts));
          skipButton.dispatchEvent(new MouseEvent('mouseup', opts));
        } catch (e) {
          // Fail-safe
        }

        // Trigger HUD notification ONCE per ad event with 4-second cooldown lock
        if (!this.isAdSkipToastOnCooldown || isManual) {
          this.isAdSkipToastOnCooldown = true;
          if (window.YTGamepadHUD) {
            window.YTGamepadHUD.showToast('Ad Auto-Skipped', 'Playback resumed', '⏩', 2500);
          }

          // Set a 4-second cooldown lock to prevent spamming while the ad transitions out
          setTimeout(() => {
            this.isAdSkipToastOnCooldown = false;
          }, 4000);
        }
        return true;
      }

      return false;
    }

    startAutomaticAdSkipper() {
      // 1. Run 150ms continuous polling interval
      this.adPollInterval = setInterval(() => {
        if (this.settings.autoSkipAds) {
          this.handleAutoAdSkip(false);
        }
      }, 150);

      // 2. Run MutationObserver scanning for instantaneous skip button detection
      this.adObserver = new MutationObserver(() => {
        if (this.settings.autoSkipAds) {
          this.handleAutoAdSkip(false);
        }
      });

      const target = document.body || document.documentElement;
      if (target) {
        this.adObserver.observe(target, {
          childList: true,
          subtree: true
        });
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body) {
            this.adObserver.observe(document.body, { childList: true, subtree: true });
          }
        });
      }
    }
  }

  // Initialize and attach to window
  window.YTGamepadContent = new GamepadController();
})();
