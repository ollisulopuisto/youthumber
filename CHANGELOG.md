# Changelog

All notable changes to Pix3lCover will be documented in this file.

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
