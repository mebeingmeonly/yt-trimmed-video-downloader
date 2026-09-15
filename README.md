# AudioCut — YouTube to MP3 Timestamp Cutter

A minimalist, high-performance web application styled with the **Vercel Geist black & white design system**, optimized mobile-first for quick audio snippet extraction from YouTube videos.

---

## Features

- **Geist Monochrome Aesthetic**: Deep jet black surfaces (`#000000`, `#0a0a0a`), crisp hairline borders, tight typography, tactile buttons, and high contrast.
- **Mobile-First Responsive UX**: Designed for thumb ergonomics with large touch targets, sticky actions, fluid layout, and bottom sheet history.
- **Exact Timestamp Trimming**:
  - **Till Timestamp**: Download from beginning (`00:00`) up to your chosen timestamp (e.g. `00:45`, `01:30`).
  - **Custom Range**: Freely adjust both Start and End timestamps.
  - Interactive tactile slider scrubber with instant format updates (`MM:SS` and `HH:MM:SS`).
  - Quick jump chips (`15s`, `30s`, `1m`, `1.5m`, `2m`, `Full Track`).
- **Audio Quality Presets**: MP3 encoding in 320 kbps (Studio), 192 kbps (High - Recommended), or 128 kbps (Light).
- **In-Browser Audio Player**: Preview the exact trimmed audio cut before downloading.
- **Recent Cuts History**: Saved to browser storage (`localStorage`) for one-tap re-downloading on mobile.
- **Universal Engine**:
  - Works with `yt-dlp` and `ffmpeg` when installed for live YouTube audio downloading and trimming.
  - Features an embedded preview generator that ensures full interactive functionality, audio playback, and file downloads are testable immediately even in sandboxed/offline environments.

---

## Quick Start

### 1. Start the Server
```bash
node server.js
```
Or with custom port:
```bash
PORT=3008 node server.js
```

Open [http://localhost:3008](http://localhost:3008) in your desktop or mobile browser.

### 2. Live YouTube Extraction (Optional)
To enable live YouTube downloading on macOS:
```bash
# Install ffmpeg and yt-dlp via Homebrew
brew install yt-dlp ffmpeg

# Or install yt-dlp via Python pip
python3 -m pip install yt-dlp
```
Once installed, `AudioCut` automatically detects `yt-dlp` and `ffmpeg` in your PATH and uses them for audio extraction.

### 3. Running Automated Tests
```bash
node test.js
```

---

## File Structure

```
kind-kepler/
├── server.js              # Native HTTP server with static file & REST API handling
├── downloader.js          # YouTube metadata extractor & MP3 trimming engine
├── test.js                # Unit tests for URL parsing, timestamps, and audio generation
├── package.json           # Project metadata & npm scripts
├── public/
│   ├── index.html         # Mobile-first semantic UI
│   ├── css/
│   │   └── style.css      # Geist monochrome design system
│   └── js/
│       └── app.js         # Client-side state machine, slider & audio player logic
└── downloads/             # Temporary cut MP3 files (auto-cleaned periodically)
```
