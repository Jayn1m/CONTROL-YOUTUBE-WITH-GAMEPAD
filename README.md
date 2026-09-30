# YouTube Gamepad TV 🎮📺

> **Turn desktop YouTube into a Fire TV / console leanback experience with gamepad spatial navigation and controller media keys.**

A production-ready, zero-dependency **Manifest V3** browser extension for Google Chrome, Brave, and Chromium-based browsers.

---

## 🌟 Key Features

- **🎮 Universal Gamepad Support:** Works seamlessly with Xbox, PlayStation (DualShock / DualSense), Nintendo Switch Pro, and standard generic XInput/DirectInput controllers.
- **📺 Card-Level Container Engine (10-Foot Console UX):**
  - **Outer Container Targeting:** Targets the outer video card containers (`ytd-rich-item-renderer`, `ytd-video-renderer`, `ytd-grid-video-renderer`, `ytd-reel-item-renderer`, `ytd-compact-video-renderer`) treating each video as a complete Fire TV tile.
  - **Bulletproof Bounding-Box Visibility:** Verifies `rect.width > 10 && rect.height > 10`, computed visibility, and real screen viewport boundaries (`-200px` to `innerHeight + 200px`), eliminating false negative filters.
  - **Direct Tile-to-Tile Navigation:** D-Pad and Left Stick jump directly from **Video Card 1 → Video Card 2 → Video Card 3** without getting stuck in sub-elements.
  - **Single Action Activation:** Pressing `A / Cross` automatically resolves the primary video link or action inside the focused container.
- **🧭 Universal Spatial Navigation:** Full page control across all major sections:
  - **Top Header Bar:** Search input, Search button, Notifications, Profile avatar.
  - **Left Navigation Drawer:** Guide entries (`ytd-guide-entry-renderer`, `ytd-mini-guide-entry-renderer`).
  - **Watch Page Action Buttons:** Subscribe/Join, Like/Dislike, Share/Download.
  - **Comments Section:** Primary comment box (`ytd-commentbox`) and main comment threads (`ytd-comment-thread-renderer`).
  - **Video Player:** Full play/pause and fullscreen control.
  - **Safe Fallback:** Dynamic fallback for non-standard pages.
- **📐 Weighted Manhattan Distance Math:** Calculates optimal directional jumps using:
  $$\text{Score} = \Delta \text{PrimaryAxis} + (2.5 \times \Delta \text{SecondaryAxis})$$
  Heavily penalizes diagonal drift, keeping spatial movement strictly aligned to rows, columns, and logical TV grids.
- **⚡ Shortcut Teleport (`Y` / `Triangle`):** Instantly teleports focus from anywhere on the screen directly to YouTube's search bar (`input#search`).
- **⏩ Debounced Ad-Skipper & Single-Toast Engine:**
  - Continuous dual-engine (`MutationObserver` + `150ms` poll) scans for skip buttons and clicks them immediately.
  - **4-Second State Lock & Single-Toast Engine:** Prevents duplicate notification spam while the video ad transitions out. Shows a single, sleek top-right HUD alert: **"⏩ Ad Auto-Skipped"**.
- **✨ Glowing YouTube-Red Focus Ring:**
  - `outline: 3.5px solid #ff0000 !important;`
  - `outline-offset: 3px !important;`
  - `box-shadow: 0 0 14px rgba(255, 0, 0, 0.9) !important;`
  - Smooth center auto-scrolling with `element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })`.
- **📺 Fire TV-Style HUD:**
  - On-screen toasts when controllers connect or disconnect.
  - TV volume bar overlay.
  - Fullscreen controller legend guide modal (press `Select` / `View` at any time).
- **⚙️ Configuration Panel:** Custom popup to adjust deadzone (0.10 - 0.50), toggle extension, auto-skip ads, and toasts.

---

## 🕹️ Controller Mapping Reference

| Controller Button | Primary Action | Context Override |
| :--- | :--- | :--- |
| **D-Pad / Left Stick** | Universal Spatial Navigation across Header $\leftrightarrow$ Left Drawer $\leftrightarrow$ Video Cards $\leftrightarrow$ Watch Controls $\leftrightarrow$ Comments $\leftrightarrow$ Sidebar | Fullscreen: Left/Right (±5s Seek), Up/Down (Volume) |
| **A / ✕ (Cross)** | Select / Click / Open Video | Video Player: Play / Pause (`K`) |
| **B / ○ (Circle)** | Back / Close Modals / Exit Fullscreen | Unfocus Search Input / History Back (`Escape`) |
| **X / □ (Square)** | Toggle Fullscreen (`F`) | Enters or exits native fullscreen mode |
| **Y / △ (Triangle)** | **JUMP TO HEADER SHORTCUT** | Instantly teleports focus directly to `input#search` |
| **LB / L1** | Skip 10s Backward (`J`) | Rewinds playback 10 seconds |
| **RB / R1** | Skip 10s Forward (`L`) | Advances playback 10 seconds |
| **LT / L2** | Volume Down (-5%) | Lowers audio and displays TV volume HUD |
| **RT / R2** | Volume Up (+5%) | Raises audio and displays TV volume HUD |
| **START / Menu** | Toggle Mute (`M`) | Mutes or unmutes audio |
| **SELECT / View** | Toggle Controller Legend Modal | Opens/dismisses the on-screen Fire TV mapping cheat sheet |
| **R3 (Right Stick Click)** | Quick Manual Ad Skip | Manually triggers ad-skip click |
| **L3 (Left Stick Click)** | Reset Focus | Re-centers focus to top/primary candidate |

---

## 🚀 How to Install in Chrome / Brave

1. Open your browser and navigate to the Extensions page:
   - **Chrome:** `chrome://extensions`
   - **Brave:** `brave://extensions`
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the directory:
   ```
   C:\Users\Jayn1m\Projects\youtube-gamepad-tv
   ```
5. Navigate to [youtube.com](https://www.youtube.com).
6. Connect your controller via USB or Bluetooth and **press any button** to wake the browser Gamepad API.
7. Enjoy your leanback YouTube console experience!

---

## 📂 Architecture Overview

```
youtube-gamepad-tv/
├── manifest.json       # Manifest V3 metadata, permissions, content scripts
├── content.js          # Core Gamepad API polling loop, debounce, shortcut teleport, debounced ad-skipper
├── spatial-nav.js      # Card-Level Container Navigation Engine & weighted Manhattan math
├── hud.js              # Single-toast engine, on-screen toasts, TV volume bar, legend modal
├── styles.css          # Glowing red focus ring, card container tile styles, modal styles
├── popup.html          # Extension settings interface
├── popup.js            # Settings persistence via chrome.storage.local & gamepad detector
├── icons/              # Extension icons (16px, 48px, 128px)
└── README.md           # Documentation and user guide
```

---

## 🛠️ Browser Gamepad API Note

Under modern browser security specifications, the Gamepad API does not report connected controllers to web pages until the user **presses at least one button** on the controller while the tab has focus. This prevents background device fingerprinting. Once any button is pressed, the on-screen toast will appear and full navigation activates immediately.
