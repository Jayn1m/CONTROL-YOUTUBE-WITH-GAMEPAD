/**
 * YouTube Gamepad TV - Card-Level Container Navigation Engine (spatial-nav.js)
 * Implements clean 10-foot Fire TV / console spatial grid navigation.
 * Uses Card-Level Container Targeting and bulletproof bounding box visibility filtering.
 */

(function () {
  'use strict';

  class CardLevelSpatialNavEngine {
    constructor() {
      this.currentFocusedElement = null;
      this.focusClass = 'yt-gamepad-focused';
      this.mutationObserver = null;

      this.init();
    }

    init() {
      this.setupObserver();
      this.bindEvents();
    }

    setupObserver() {
      this.mutationObserver = new MutationObserver(() => {
        if (this.currentFocusedElement && !this.currentFocusedElement.isConnected) {
          this.recoverFocus();
        }
      });

      if (document.body) {
        this.mutationObserver.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body) {
            this.mutationObserver.observe(document.body, { childList: true, subtree: true });
          }
        });
      }
    }

    bindEvents() {
      // Sync focus with pointer interactions
      document.addEventListener(
        'pointerdown',
        (e) => {
          const target = e.target;
          if (
            target &&
            !target.closest('#yt-gamepad-toast-container') &&
            !target.closest('#yt-gamepad-legend-overlay') &&
            !target.closest('#yt-gamepad-volume-hud')
          ) {
            const card = target.closest(
              'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-compact-video-renderer, #movie_player, #search-form input, #search-icon-legacy, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-subscribe-button-renderer button, segmented-like-dislike-button-view-model button, ytd-menu-renderer button#button, ytd-commentbox, ytd-comment-thread-renderer'
            );
            if (card && card !== this.currentFocusedElement && this.isNavigable(card)) {
              this.setFocus(card, false);
            }
          }
        },
        { passive: true }
      );

      // On YouTube SPA navigation finish
      window.addEventListener('yt-navigate-finish', () => {
        this.clearFocus();
        setTimeout(() => {
          this.setDefaultRouteFocus();
        }, 350);
      });
    }

    // ------------------------------------------------------------------------
    // Route & Context Helpers
    // ------------------------------------------------------------------------
    isWatchPage() {
      return window.location.pathname.startsWith('/watch');
    }

    isShortsPage() {
      return window.location.pathname.startsWith('/shorts');
    }

    isFullscreen() {
      return Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.querySelector('.html5-video-player.ytp-fullscreen')
      );
    }

    getVideoElement() {
      return document.querySelector('video.html5-main-video') || document.querySelector('video');
    }

    getPlayerElement() {
      return document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    }

    // ------------------------------------------------------------------------
    // 1. CARD-LEVEL CONTAINER ENGINE: Primary Target Selectors
    // ------------------------------------------------------------------------
    getCandidates() {
      const PRIMARY_SELECTORS = [
        // 1. Homepage / Subscriptions / Channel Feeds (Top-Level Video Cards)
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-grid-video-renderer',

        // 2. Shorts Shelves / Carousels
        'ytd-reel-item-renderer',
        'ytd-rich-shelf-renderer ytd-reel-item-renderer',

        // 3. Watch Page Recommendations Sidebar
        'ytd-compact-video-renderer',

        // 4. Video Player on Watch Page
        '#movie_player',

        // 5. Top Header Bar
        '#search-form input',
        '#search-icon-legacy',
        'ytd-notification-topbar-button-renderer',
        '#avatar-btn',

        // 6. Left Navigation Drawer
        'ytd-guide-entry-renderer',
        'ytd-mini-guide-entry-renderer',

        // 7. Watch Page Primary Action Bar
        'ytd-subscribe-button-renderer button',
        'segmented-like-dislike-button-view-model button',
        'ytd-menu-renderer button#button',
        '#top-level-buttons-computed button',

        // 8. Comments Section
        'ytd-commentbox',
        'ytd-comment-thread-renderer'
      ];

      const rawElements = [];
      const selectorString = PRIMARY_SELECTORS.join(', ');

      try {
        const found = document.querySelectorAll(selectorString);
        for (let i = 0; i < found.length; i++) {
          rawElements.push(found[i]);
        }
      } catch (err) {
        // Fail-safe
      }

      const filtered = this.filterNavigable(rawElements);

      // Safe Fallback (For non-standard pages if no primary cards are on screen)
      if (filtered.length === 0) {
        const fallbackElements = [];
        try {
          const fallbackFound = document.querySelectorAll('a[href], button:not([disabled])');
          for (let i = 0; i < fallbackFound.length; i++) {
            fallbackElements.push(fallbackFound[i]);
          }
        } catch (err) {
          // Fail-safe
        }
        return this.filterNavigable(fallbackElements);
      }

      return filtered;
    }

    // ------------------------------------------------------------------------
    // Bulletproof Bounding Box & Visibility Filter
    // ------------------------------------------------------------------------
    isNavigable(el) {
      if (!el || !el.isConnected) return false;

      // Ignore extension HUD overlays
      if (el.closest('#yt-gamepad-toast-container, #yt-gamepad-legend-overlay, #yt-gamepad-volume-hud')) {
        return false;
      }

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      // Ensure the card has actual size and is visible
      const hasSize = rect.width > 10 && rect.height > 10;
      const isVisible = style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';

      // Must be roughly within or near the current viewport
      const inViewport = rect.bottom >= -200 && rect.top <= (window.innerHeight + 200);

      return hasSize && isVisible && inViewport;
    }

    filterNavigable(elements) {
      const visible = [];
      const seenRects = new Set();

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!this.isNavigable(el)) continue;

        const rect = el.getBoundingClientRect();

        // Coordinate deduplication to prevent duplicate stacked targets
        const rectKey = `${Math.round(rect.left)}_${Math.round(rect.top)}_${Math.round(rect.width)}_${Math.round(rect.height)}`;
        if (seenRects.has(rectKey)) {
          continue;
        }
        seenRects.add(rectKey);

        visible.push(el);
      }

      return visible;
    }

    // ------------------------------------------------------------------------
    // Geometric Vector & Weighted Manhattan Distance Engine
    // ------------------------------------------------------------------------
    move(direction) {
      if (this.isFullscreen()) {
        return false;
      }

      // If nothing is focused, establish initial route focus
      if (!this.currentFocusedElement || !this.currentFocusedElement.isConnected) {
        return this.setDefaultRouteFocus();
      }

      const candidates = this.getCandidates();
      if (!candidates || candidates.length === 0) return false;

      const currentRect = this.currentFocusedElement.getBoundingClientRect();
      const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2
      };

      let bestCandidate = null;
      let minScore = Infinity;

      for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        if (cand === this.currentFocusedElement) continue;

        // Skip nested child elements if focusing outer card
        if (this.currentFocusedElement.contains(cand) || cand.contains(this.currentFocusedElement)) {
          continue;
        }

        const candRect = cand.getBoundingClientRect();
        const candCenter = {
          x: candRect.left + candRect.width / 2,
          y: candRect.top + candRect.height / 2
        };

        const score = this.calculateManhattanScore(direction, currentRect, currentCenter, candRect, candCenter);
        if (score !== null && score < minScore) {
          minScore = score;
          bestCandidate = cand;
        }
      }

      if (bestCandidate) {
        this.setFocus(bestCandidate, true);
        return true;
      }

      return false;
    }

    /**
     * Weighted Manhattan distance formula:
     * Score = Delta PrimaryAxis + (2.5 * Delta SecondaryAxis)
     * Heavily penalizes diagonal jumps to keep navigation strictly aligned to rows and columns.
     */
    calculateManhattanScore(direction, curR, curC, candR, candC) {
      let deltaPrimary = 0;
      let deltaSecondary = 0;

      switch (direction) {
        case 'down': {
          // Candidate center must be strictly below current center
          if (candC.y <= curC.y + 1) return null;

          deltaPrimary = candC.y - curC.y;
          deltaSecondary = Math.abs(candC.x - curC.x);
          break;
        }

        case 'up': {
          // Candidate center must be strictly above current center
          if (candC.y >= curC.y - 1) return null;

          deltaPrimary = curC.y - candC.y;
          deltaSecondary = Math.abs(candC.x - curC.x);
          break;
        }

        case 'right': {
          // Candidate center must be strictly to the right of current center
          if (candC.x <= curC.x + 1) return null;

          deltaPrimary = candC.x - curC.x;
          deltaSecondary = Math.abs(candC.y - curC.y);
          break;
        }

        case 'left': {
          // Candidate center must be strictly to the left of current center
          if (candC.x >= curC.x - 1) return null;

          deltaPrimary = curC.x - candC.x;
          deltaSecondary = Math.abs(candC.y - curC.y);
          break;
        }

        default:
          return null;
      }

      return deltaPrimary + (2.5 * deltaSecondary);
    }

    // ------------------------------------------------------------------------
    // Focus Ring Manager & Smooth Auto-Scrolling
    // ------------------------------------------------------------------------
    setFocus(element, shouldScroll = true) {
      if (!element) return;

      if (this.currentFocusedElement && this.currentFocusedElement !== element) {
        this.currentFocusedElement.classList.remove(this.focusClass);
      }

      this.currentFocusedElement = element;
      element.classList.add(this.focusClass);

      if (shouldScroll) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }

    clearFocus() {
      if (this.currentFocusedElement) {
        this.currentFocusedElement.classList.remove(this.focusClass);
        this.currentFocusedElement = null;
      }
    }

    getCurrentFocus() {
      return this.currentFocusedElement;
    }

    recoverFocus() {
      this.clearFocus();
      this.setDefaultRouteFocus();
    }

    setDefaultRouteFocus() {
      if (this.isWatchPage()) {
        const player = this.getPlayerElement();
        if (player && this.isNavigable(player)) {
          this.setFocus(player, true);
          return true;
        }
      }

      const candidates = this.getCandidates();
      if (candidates && candidates.length > 0) {
        this.setFocus(candidates[0], true);
        return true;
      }

      return false;
    }

    // ------------------------------------------------------------------------
    // Action / Click Simulation for Card Containers
    // ------------------------------------------------------------------------
    activateCurrentFocus() {
      const el = this.currentFocusedElement;
      if (!el) {
        if (this.isWatchPage()) {
          const video = this.getVideoElement();
          if (video) {
            if (video.paused) video.play();
            else video.pause();
            return true;
          }
        }
        return false;
      }

      // Case 1: Video Player focused -> Play / Pause
      if (el.id === 'movie_player' || el.classList.contains('html5-video-player')) {
        const video = this.getVideoElement();
        if (video) {
          if (video.paused) video.play();
          else video.pause();
        } else {
          el.click();
        }
        return true;
      }

      // Case 2: Video Card Containers -> Find and click primary video link/thumbnail
      if (
        el.matches(
          'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer'
        )
      ) {
        const link = el.querySelector(
          'a#thumbnail, a#thumbnail-anchor, a#video-title-link, a#video-title, h3 a, a.yt-simple-endpoint, a[href]'
        );
        if (link) {
          this.simulateClick(link);
          return true;
        }
      }

      // Case 3: Left Navigation Drawer Entries -> Find and click endpoint link
      if (el.matches('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')) {
        const link = el.querySelector('a[href], tp-yt-paper-item, #endpoint') || el;
        this.simulateClick(link);
        return true;
      }

      // Case 4: Comments Thread Container -> click comment or author
      if (el.matches('ytd-comment-thread-renderer')) {
        const commentTarget = el.querySelector('ytd-comment-view-model, #content-text, #author-text') || el;
        this.simulateClick(commentTarget);
        return true;
      }

      // Case 5: Standard interactive element (button, link, input)
      this.simulateClick(el);
      return true;
    }

    simulateClick(element) {
      if (!element) return;

      const opts = { bubbles: true, cancelable: true, composed: true, view: window };
      element.dispatchEvent(new PointerEvent('pointerdown', opts));
      element.dispatchEvent(new MouseEvent('mousedown', opts));
      element.dispatchEvent(new PointerEvent('pointerup', opts));
      element.dispatchEvent(new MouseEvent('mouseup', opts));
      element.click();

      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.focus();
        if (typeof element.select === 'function') {
          element.select();
        }
      }
    }
  }

  // Attach to window namespace
  window.YTGamepadSpatialNav = new CardLevelSpatialNavEngine();
})();
