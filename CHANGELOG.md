# Changelog

All notable changes to YouThumber will be documented in this file.

## [26.09.23.72] - 2026-09-23

### Added
- Sharper cutouts with BiRefNet: fingers and hair now match Pixelcut. A one-time 973 MB model download (button above the speaker cards, checked against a pinned SHA-256, deleted if it doesn't match), then about 10–14 s per full-HD cutout on the CPU. Apple Vision still decides what is the person, so the mic stand and chair stay out
- "Keep objects (mic, stand, chair)" toggle under Mask Refinement: switches to the full cutout instantly, without re-running the model
- `/matting-model` and `/matting-model/download` engine endpoints

### Fixed
- Background removal blocked the engine while it ran; it now runs in a worker thread, so health checks keep answering

## [26.09.23.71] - 2026-09-23

### Fixed
- Background removal deleted a raised hand whose arm leaves the frame: it isn't joined to the body in the picture, so the stray-object cleanup treated it like a floating mic. Apple Vision's hand detector now marks hands, and pieces holding one are kept
- A dark rim of the studio wall around fingers and edges: Vision's mask runs a pixel or two past the person, so the edge is now pulled in slightly (about 3 px at 1080p)

## [26.09.23.70] - 2026-09-23

### Fixed
- Video scans longer than 60 seconds failed with "Load failed" and nothing in the log: the desktop window's WebKit drops any request after 60 s, while the scan finished unseen in the engine. A scan is now a background job the page polls, so it works at any length

### Added
- Scan progress bar with percentage

## [26.09.23.69] - 2026-09-23

### Added
- CI job on a macOS runner (pushes to main) that runs the backend tests with the Apple frameworks present, so Vision/AVFoundation/Core Image tests fail instead of skipping

## [26.09.23.68] - 2026-09-23

### Fixed
- On machines without AVFoundation (CI's Linux runner), the video endpoints answered "needs macOS" before "file not found"; a missing file is now reported first everywhere. Their tests now run both ways on every platform

## [26.09.23.67] - 2026-09-23

### Added
- GPU texture backgrounds made with Apple Core Image (Metal) on the local engine: Film grain, Smoke, Sunbeams, Light halo, Stained glass, Hex tiles, Halftone and Bokeh. Pick two colours, preview all eight live, Shuffle for new variations, click to use one at 1920×1080. It becomes the background photo, so blur, darken and vignette apply to it
- `/textures` and `/texture` engine endpoints

### Fixed
- CI had failed on every push since 26.09.23.60 at the `ruff format --check` step, so it never reached the Python tests; the code is now formatted
- Parallel requests on a freshly started engine could fail: PyObjC loads Quartz functions lazily and that isn't thread-safe; texture renders now run one at a time
- An unexpected texture error showed in the page as "Failed to fetch" (the error response had no CORS headers); it now reports the actual error

## [26.09.23.66] - 2026-09-23

### Added
- Font picker with 28 headline fonts in four groups (Bold & condensed, Sans-serif, Serif, Fun), each shown in its own typeface; adds Inter, League Spartan, Bangers and Luckiest Guy
- Regular / Bold / Black weight buttons, limited to the weights each font actually has
- Background: 16 gradient presets (including radial Spotlight, Studio Blue, Warm Glow), a custom gradient (two colours, angle, linear or radial), photo blur and darken, one-click "blurred speaker photo" backgrounds, and a vignette
- Show presets keep photo blur, darken and vignette

### Fixed
- Layout presets asked for Montserrat 900 but only 400/700 were loaded, so the browser faked the black weight; 800/900 are loaded now (a test checks every offered font and weight is loaded)
- The font list offered Inter, which was never loaded and silently fell back
- A newly picked font could draw in the fallback font until something else redrew the canvas; the headline now redraws once the font has loaded
- Gradient swatches drew at a different angle from the canvas (CSS measures 0° as up, the canvas as left-to-right)
- The Layers/Properties strip was a fixed 208px; it now grows with its content

## [26.09.23.65] - 2026-09-23

### Added
- Video picker sorts by **Best quality**, **Most expressive** or **Gesturing**, without rescanning. Expression is scored from Apple Vision face landmarks (smile, open mouth, raised eyebrows); gestures from hand pose (hand raised to chest height or above, most of all a pointing index finger). Hands are credited to their owner through body pose, so an arm reaching across the frame counts for the right person
- Picker thumbnails are head-and-shoulders crops, so hands in front of the chest are visible
- "No gestures/expressions found" note when a person has none, instead of an arbitrary order

### Changed
- The scan samples a frame every 5 seconds instead of every 30, since smiles and gestures only last a second or two. About 0.4 s per sampled frame on this Mac — roughly 5 minutes per hour of video
- Face grouping clusters a sample of up to 300 faces and assigns the rest, so the ~10x more faces from denser sampling don't make it take hours
- The scan request runs in a worker thread, so the app stays responsive during a scan

## [26.09.23.64] - 2026-09-23

### Fixed
- Background removal cut away a microphone touching the host, leaving a hole in their shirt where the mic had been. Objects touching the person are kept again; only pieces floating free of the body are removed, and edges still fade smoothly

## [26.09.23.63] - 2026-09-23

### Fixed
- Gritty, stair-stepped cutout edges: the stray-object cleanup (added in .62) cut soft edges along the blocky outline of a 4x-downscaled mask. It now fades the cut out smoothly; the worst jump between neighbouring edge pixels went from 156 to 24
- Hard to select or move layers on the canvas: a click always went to the topmost object, even on transparent parts of a cutout and even when another layer was already selected. Cutouts are now hit-tested per pixel, and the selected layer keeps clicks that land on it

## [26.09.23.62] - 2026-09-23

### Added
- 1–4 speakers per project, with a layout per speaker count (Solo Centre, the three existing two-speaker layouts, Panel of Three, Panel of Four). New layouts are one entry in `src/modules/thumbnail/layouts.ts`
- Speaker cards show position + editable name ("Left · Olli") and ← → buttons to swap positions; auto-frame re-fits cutouts to their new slots
- Video picker: scan once, choose how many people are in the video, see up to 12 frames per person, click a frame to view it large (← → to browse), and put it on any speaker position. The scan is remembered, so filling the next speaker doesn't rescan
- Show presets save and restore speaker count and names

### Fixed
- The per-speaker "Scan Video" always returned the same (largest) face whichever slot it was opened from; it now opens the same per-person picker
- Canvas was cut off at the top and bottom in short windows; it now fits both width and height and always gets at least half the window
- Background removal kept semi-transparent objects touching the person (a microphone came out as a grey blob); only the main body and its soft edge are kept now

### Changed
- Projects and show presets saved by earlier versions are converted automatically on load
- Removed the old single-person `/scan-video` endpoint; `/scan-video-speakers` returns `frames` per person and takes `framesPerPerson`, sampling every 30s by default

## [26.09.23.61] - 2026-09-23

### Fixed
- Scan Video for All Speakers split a real two-person render into 6 "people". Faces are now grouped into exactly the number of speakers (2) by average-linkage clustering instead of a fixed similarity threshold, with a tighter face crop for identity and each person's thumbnail picked from the core of their group so a stray face can't become it
- Export did nothing in the desktop app (pywebview disables downloads); it now opens a native Save dialog, defaulting to Downloads, and confirms the saved path

### Changed
- Speaker picker buttons say "Left (Host)" / "Right (Guest)" to match the speaker cards
- `/scan-video-speakers` takes `numPeople` (default 2) instead of `maxPeople`

## [26.09.23.60] - 2026-09-23

### Added
- Scan Video for All Speakers: pick one final-render video, detect every face per sampled frame, group faces by identity (Vision `VNGenerateImageFeaturePrintRequest`), and assign each detected person to a speaker slot (`/scan-video-speakers`, `MultiSpeakerScanModal`)
- Scan Video for Best Frame per speaker slot: sample a video every 60s and rank frames by Vision face capture quality + sharpness (`/scan-video`, `/grab-frame`, `VideoScanModal`)
- Native macOS video file picker exposed to the frontend via pywebview `js_api` (desktop app only)
- Auto-Frame: after background removal, size and position each speaker from the cutout's alpha bounds (left/right thirds, headroom for the headline)
- Gradient background presets in Background Properties
- 1920×1080 export option alongside 1280×720
- `ROADMAP.md`

### Changed
- New dependencies (macOS only): `pyobjc-framework-AVFoundation`, `pyobjc-framework-CoreMedia`
- Show presets now save and restore gradient backgrounds

## [26.09.12.59] - 2026-09-12

### Added
- Automated GitHub Actions binary build & release workflow (`.github/workflows/build-binaries.yml`)
- Standalone packaging build script (`scripts/build_binaries.py`) generating native macOS `.app` and compressed `.zip` releases
- Dedicated PyInstaller desktop launcher (`launcher.py`) with support for frozen bundle resource resolution via `sys._MEIPASS`
- Convenience npm scripts for desktop execution (`npm run desktop`, `npm run desktop:dev`, `npm run build:binaries`)

## [26.09.12.58] - 2026-09-12

### Security
- Hardened `.gitignore` to explicitly ignore sensitive configuration and credentials (`config.yaml`, `access.json`, private keys) prior to public release

## [26.09.12.57] - 2026-09-12

### Added
- Core ML status indicator badge in Toolbar with live `/health` check and visual status dot
- Automatic backend auto-detection (`autoDetectBestRemover`) to seamlessly default to Apple Neural Engine acceleration when available
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) with Node.js 24 runtime, linting, tests, and Python quality checks via `uv`

### Changed
- Enhanced removal engine dropdown with engine icons and dynamic `(Online)` / `(Offline)` availability tags

## [26.09.12.56] - 2026-09-12

### Documentation
- Updated README with desktop GUI instructions (`uv run youthumber`) and options
- Configured Vite reverse proxy to backend service on port 5055 for dev hot-reloading

## [26.09.12.55] - 2026-09-12

### Added
- Native macOS desktop GUI architecture (`Approach A` based on `autoraffkat` pattern)
- Standalone CLI command `uv run youthumber` launching native desktop window via `pywebview`
- Embedded FastAPI server hosting both the compiled React Studio and Apple Silicon Core ML APIs
- Headless and developer flags (`--no-gui`, `--dev`, `--debug`, `--port`, `--host`)
- Automatic origin detection in `LocalCoreMLRemover` for seamless desktop and browser execution
- Full Python test suite covering backend endpoints and static asset delivery

## [26.09.12.54] - 2026-09-12

### Added
- Real Apple Vision (`VNGeneratePersonSegmentationRequest`) person segmentation in `scripts/apple_silicon_remover.py`
- Apple Neural Engine / Metal hardware acceleration on macOS for sub-second offline segmentation
- Dedicated `pyproject.toml` configuration with `uv` dependencies and dev tooling
- Full support for returning both segmented cutout PNG and binary alpha mask data URLs

## [26.09.12.53] - 2026-09-12

### Added
- Live Mask Refinement UI in Properties Panel (`feather`, `threshold`/choke-expand, `opacity`, and `invert`)
- Instant re-compositing of speaker cutouts with custom feathering and edge thresholding
- Unit test suite for mask refinement edge choke, feathering, and option preservation

## [26.09.12.52] - 2026-09-12

### Changed
- Set default development server port to standard Vite 5173
- Verify active live server running for local interactive testing

## [26.09.12.51] - 2026-09-12

### Changed
- Rename application to **YouThumber** and repository / package identifier to `youthumber`
- Update HTML title, toolbar branding, and project documentation
- Update git remote origin URL to `youthumber.git`

## [26.09.12.50] - 2026-09-12

### Added
- Per-show saved preferences system (`showPreferences.ts`)
- Configurable speaker count (1 vs 2 speakers) with auto-centering layout
- Show-specific background presets (colors/images) and typography styles (fonts, fills, strokes, shadows)
- `ShowPresetModal` UI for saving current thumbnail composition as a recurring show preset
- Toolbar quick show switcher and 1/2 speaker toggle button

## [26.09.12.49] - 2026-09-12

### Added
- Focused MVP UI with 1280x720 canvas preview and direct export
- Preset composition templates (Dual Debate, Host & Guest, Dramatic Clash)
- Toolbar with model backend switcher, template selector, and project management
- Interactive Layers panel supporting reordering and visibility toggles
- Dedicated Properties panel for selected text, speakers, and background
- Bottom Assets dock for Speaker 1, Speaker 2, and Background slots with progress bars
- Project Gallery modal for saving, loading, duplicating, and JSON import/export

## [26.09.12.48] - 2026-09-12

### Added
- LocalCoreMLRemover adapter targeting Apple Silicon Metal / Apple Neural Engine
- Local Apple Silicon Core ML HTTP service script (`scripts/apple_silicon_remover.py`)
- Automated health check and fallback handling between local Core ML and WebAssembly

## [26.09.12.47] - 2026-09-12

### Added
- Core thumbnail data model with fixed 1280x720 canvas
- Dual speaker slots (Speaker 1, Speaker 2) preserving source image, mask, and cutout
- Composition template support to swap assets while maintaining layout
- Local-first project persistence and JSON import/export utilities

## [26.09.12.46] - 2026-09-12

### Changed
- Isolate background removal into service layer with BackgroundRemover abstraction
- Decouple UploadPanel component from direct @imgly/background-removal library dependency
- Add alpha mask extraction and compositing utilities
- Add CachedBackgroundRemover with key hashing and MockBackgroundRemover for tests

## [26.09.12.45] - 2026-09-12

### Added
- Established test suite baseline with Vitest and jsdom
- Added TypeScript configuration for strict modules and tests

### Fixed
- Resolved ESLint unused variable errors and prop-types configuration


### Added
- **Background Removal**: AI-powered background removal running entirely in browser
  - Uses @imgly/background-removal (no server, no API costs)
  - Progress indicator during processing
  - Works offline after initial model download
- **Multiple Layers**: Support for overlay images on canvas
  - Add multiple PNG/JPG images as overlay layers
  - Drag, resize, and rotate layers on canvas
  - Reorder layers with up/down controls
  - Layer positions saved with project
- **Crop Tool**: Integrated image cropping
  - Crop images before adding to canvas
  - Drag to move, resize with corner handle
  - Preview of crop area in real-time
- **Grid & Guides**: Alignment aids for precise positioning
  - Toggle grid overlay (20px spacing)
  - Toggle snap-to-grid functionality
  - Center lines (dashed) for easy alignment
  - Snap to center when moving objects
- **Custom Templates**: Save and reuse your own templates
  - Save current layout as custom template
  - Custom templates shown in sidebar
  - Delete custom templates when no longer needed

### Changed
- Schema version updated to 4 (automatic migration)
- Upload panel now shows Crop and Remove BG buttons
- Canvas controls reorganized with grid/snap toggles

### Dependencies
- Added: @imgly/background-removal ^1.7.0

## [1.2.0] - 2026-01-29

### Added
- **Third Text Line**: Optional extra text field for additional information below subtitle
  - Uses subtitle font with slightly smaller size (85%)
  - Fully draggable on canvas like title and subtitle
- **Keyboard Shortcuts**: Productivity shortcuts for power users
  - Ctrl+S: Quick save (prompts for name if new project)
  - Ctrl+E: Quick export (JPEG 90% quality)
  - Delete: Remove selected canvas object
  - Ctrl+Z/Ctrl+Shift+Z: Undo/Redo (global, even outside input fields)
- **Image Filters**: Real-time image adjustments
  - Brightness (-100 to +100)
  - Contrast (-100 to +100)
  - Saturation (-100 to +100)
  - Blur (0 to 10)
  - Reset button to restore defaults
  - Filters apply only to background image
- **Canvas Zoom**: Zoom controls for detail editing
  - Zoom in/out buttons (50% to 200%)
  - Click percentage to reset to 100%
  - Canvas scrollable when zoomed

### Changed
- Schema version updated to 3 (automatic migration from older versions)

## [1.1.2] - 2026-01-29

### Added
- **Undo/Redo**: History stack for editing actions
  - Ctrl+Z to undo, Ctrl+Shift+Z or Ctrl+Y to redo
  - Visual buttons in header with disabled state indicators
  - Debounced state tracking (500ms) to avoid excessive history entries
- **Duplicate Project**: One-click project duplication in gallery view
  - Creates copy with "(Copy)" suffix in name
  - Available in both grid and list views
- **Error Boundaries**: React error boundary wrapping the app
  - Graceful error display instead of white screen
  - "Try Again" and "Reload App" recovery options
- **Data Migration System**: Automatic schema versioning for backward compatibility
  - Projects now include `schemaVersion` field
  - Automatic migration of old projects on load
  - Ensures user data is preserved across app updates

### Changed
- Header now includes undo/redo buttons next to auto-save indicator

## [1.1.1] - 2026-01-29

### Added
- **Image Compression**: Automatic image compression on upload using browser-image-compression (max 500KB, JPEG conversion)
- **Storage Indicator**: Visual progress bar in sidebar showing localStorage usage with color-coded warnings (green/amber/red)
- **Export/Import JSON**: Backup and restore all projects as JSON files
  - Export downloads all projects as `pix3lcover-backup-YYYY-MM-DD.json`
  - Import supports merge (add new, skip duplicates) and replace modes

### Changed
- Sidebar now displays storage usage at the bottom with project count
- Upload panel shows compression progress spinner during image processing

## [1.1.0] - 2026-01-28

### Added
- **Video Frame Extraction**: Upload video files (MP4, WebM, MOV, OGG, M4V, AVI) and extract any frame as thumbnail background
- Mini video player with timeline slider for precise frame selection
- "Use This Frame" button to extract and use selected frame

## [1.0.0] - 2026-01-28

### Added
- **14 Professional Templates**: Classic Blues, Gritty Guitar, Electric Neon, Vintage Vinyl, Smoky Stage, Cinematic Box, Neon Glow, Minimal Clean, Vintage Film, Bold Impact, Gradient Fade, Split Screen, Corner Badge, Polaroid
- **23 Google Fonts**: Including luxury fonts (EB Garamond, Bodoni Moda, DM Serif Display) and modern fonts (Poppins, Space Grotesk, Archivo Black)
- **Dual Format Support**: 16:9 landscape (1920x1080) and 9:16 portrait (1080x1920) for YouTube Shorts
- **Full HD Export**: Export thumbnails at 1920x1080 or 1080x1920 resolution
- **Project Gallery**: Visual gallery with thumbnails, grid/list view, search, and format filters
- **Auto-save**: Automatic project saving every 30 seconds with restore on load
- **Storage Warning**: Dismissible banner about localStorage limitations
- **Image Upload**: Drag & drop, file upload, or paste from clipboard (Ctrl+V)
- **Text Editing**: Title and subtitle with customizable fonts, colors, and effects
- **Color Picker**: Custom color selection for title and subtitle text
- **Interactive Canvas**: Drag and resize elements with persistent positions
- **AI Generated Badge**: 4 styles with transparent or custom background
- **Pix3lTools Branding**: Footer links to website and X profile
