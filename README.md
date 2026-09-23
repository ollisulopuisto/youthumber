# YouThumber (`youthumber`)

A focused, local-first YouTube thumbnail editor for creators.

Compose stunning 1280×720 thumbnails from dual speaker photos (1920×1080) with local background removal, customizable show presets, and direct export.

## Features

### Implemented (Working)

- **Image Upload**: Drag & drop, file upload, or paste from clipboard (Ctrl+V) with automatic compression
- **Video Frame Extraction**: Upload a video (MP4, WebM, MOV) and extract any frame as thumbnail background
- **Dual Format Support**: 16:9 landscape (1920x1080) and 9:16 portrait (1080x1920) for YouTube Shorts
- **14 Professional Templates**: Including Neon Glow, Minimal Clean, Vintage Film, Bold Impact, Gradient Fade, Split Screen, Corner Badge, and Polaroid
- **Text Editing**: Title and subtitle with customizable fonts, colors, and effects
- **Font Selector**: Choose from 23 Google Fonts (including luxury fonts: EB Garamond, Bodoni Moda, Cormorant, DM Serif Display) with size controls
- **Color Picker**: Custom color selection for title and subtitle text with preset colors
- **Interactive Canvas**: Drag and resize elements, format-aware positioning with persistent positions
- **AI Generated Badge**: 4 styles, transparent or custom background, smart positioning across formats
- **Project Gallery**: Visual gallery with thumbnails, grid/list view, search, and format filters
- **Export System**: Download as JPG (80-100% quality) or PNG with Full HD resolution
- **Auto-save**: Automatic project saving every 30 seconds with restore on load
- **Storage Warning**: Dismissible banner informing users about localStorage limitations
- **Storage Indicator**: Visual progress bar showing localStorage usage with color-coded warnings
- **Export/Import JSON**: Backup and restore all projects as JSON files for local storage
- **Undo/Redo**: History stack with Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts
- **Duplicate Project**: Create copies of existing projects with one click
- **Error Boundaries**: Graceful error handling to prevent app crashes
- **Data Migration**: Automatic schema migration ensures user data is preserved across app updates
- **Third Text Line**: Optional extra text field below subtitle for additional information
- **Keyboard Shortcuts**: Ctrl+S save, Ctrl+E export, Delete remove object, Ctrl+Z/Y undo/redo
- **Image Filters**: Real-time brightness, contrast, saturation, and blur adjustments
- **Canvas Zoom**: Zoom controls (50%-200%) for detail editing
- **Background Removal**: AI-powered background removal running entirely in browser (no API costs)
- **Multiple Layers**: Add overlay images with drag, resize, rotate, and reorder support
- **Crop Tool**: Interactive image cropping with real-time preview
- **Grid & Guides**: Toggle grid overlay (20px), snap-to-grid, and center alignment guides
- **Custom Templates**: Save your current layout as a reusable template
- **Pix3lTools Branding**: Header link to the Pix3lTools website

## Tech Stack

- **Frontend**: React 18 + Vite 6
- **Styling**: Tailwind CSS 3.4
- **Canvas**: Fabric.js 5.3
- **Image Compression**: browser-image-compression
- **Background Removal**: @imgly/background-removal (client-side AI)
- **Fonts**: Google Fonts (23 total)
- **Storage**: LocalStorage (project persistence)
- **Deployment**: Vercel

## Getting Started

### Installation

```bash
npm install
```

### Development & Desktop App

#### 1. Native Desktop GUI (Recommended — autoraffkat style)

Launch the standalone desktop application in a native macOS window:

```bash
uv run youthumber
```

This starts the embedded FastAPI backend and opens YouThumber in a native WebKit window via `pywebview`.

Options:
* `uv run youthumber` — Launch native macOS desktop window
* `uv run youthumber --dev` — Open native window attached to local Vite dev server (`http://localhost:5173`)
* `uv run youthumber --no-gui` — Run as headless local server on `http://127.0.0.1:8731/`
* `uv run youthumber --debug` — Enable WebKit developer tools / web inspector

**App launcher (Dock, ⌘-Tab, Spotlight):** `uv run youthumber` is a plain `python`
process, so macOS shows a generic icon and the name "python". To get a real app for this
checkout, run once:

```bash
uv run python scripts/make_launcher.py
```

It creates `~/Applications/YouThumber.app` with the YouThumber name and icon, which runs
`uv run youthumber` in this repo. The first time you open it, macOS asks whether
YouThumber may access your Documents folder (if the repo is there): allow it. Output goes
to `~/Library/Logs/YouThumber.log`. Re-run the script after moving the repo.

#### 2. Web Development Mode (Vite)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view in your browser.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## How to Use

1. **Start the dev server**: `npm run dev`
2. **Choose format**: Select 16:9 (landscape) or 9:16 (portrait/Shorts)
3. **Upload an image**: Drag & drop, click to browse, or paste (Ctrl+V)
4. **Select a template**: Choose from 14 professional designs
5. **Add text**: Enter title (auto-uppercase) and optional subtitle
6. **Customize fonts**: Choose from 23 Google Fonts with size controls
7. **Customize colors**: Use color picker for custom title/subtitle colors
8. **Position elements**: Drag text and badge to desired positions (positions are saved!)
9. **Save project**: Name and save your project (auto-saves every 30 seconds)
10. **Export**: Choose format (JPG/PNG), adjust quality, and download at Full HD resolution

### Tips
- Use JPG format for smaller file sizes (recommended for YouTube)
- Quality 90% is optimal balance between size and quality
- Projects auto-save every 30 seconds - look for the indicator in the header
- Use the Project Gallery to browse saved projects with visual thumbnails
- Filter projects by format (16:9 / 9:16) or search by name
- Canvas elements are fully interactive - click and drag to reposition

## Project Structure

```
src/
├── components/         # React components
│   ├── Canvas/        # Canvas-related components
│   │   └── ThumbnailCanvas.jsx  # Main Fabric.js canvas with grid/zoom
│   ├── Sidebar/       # Sidebar panels
│   │   ├── UploadPanel.jsx      # Image upload + crop + bg removal
│   │   ├── TemplateSelector.jsx # Template selection + custom templates
│   │   ├── FontSelector.jsx     # Font customization
│   │   ├── TextColorPicker.jsx  # Text color picker
│   │   ├── BadgeEditor.jsx      # AI badge editor
│   │   ├── FilterPanel.jsx      # Image filter controls
│   │   ├── LayerPanel.jsx       # Overlay layers management
│   │   ├── ProjectGallery.jsx   # Project gallery with thumbnails
│   │   └── ExportPanel.jsx      # Export settings
│   ├── CropModal.jsx            # Image crop dialog
│   ├── StorageWarning.jsx       # localStorage warning banner
│   ├── StorageIndicator.jsx     # Storage usage indicator
│   ├── ErrorBoundary.jsx        # Error handling wrapper
│   └── AutoSaveIndicator.jsx    # Auto-save status indicator
├── hooks/             # Custom React hooks
│   ├── useAutoSave.js # Auto-save functionality
│   └── useHistory.js  # Undo/redo history management
├── utils/             # Utility functions
│   ├── exportUtils.js # Export canvas to image
│   └── storageUtils.js# localStorage management
├── data/              # Static data
│   ├── templates.js   # 14 thumbnail templates
│   ├── fonts.js       # 23 Google Fonts
│   └── badgeStyles.js # Badge style definitions
├── styles/            # Global styles
├── App.jsx            # Main app component
└── main.jsx           # Entry point
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Author

**[Pix3lTools](https://www.pix3ltools.com/)** - Professional tools for content creators.

- Website: [pix3ltools.com](https://www.pix3ltools.com/)
- GitHub: [github.com/Pix3ltools-lab](https://github.com/Pix3ltools-lab)
