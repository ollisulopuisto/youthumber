# YouThumber (`youthumber`)

A focused, local-first YouTube thumbnail editor for creators.

Compose 1280×720 thumbnails (or 1080×1920 for Shorts) from speaker photos with on-device background removal, show presets for recurring formats, and direct export as JPG or PNG. Everything runs on your machine: no account, no upload.

## Features

### Speakers and layouts

- **1 to 4 speakers**: pick the count in the toolbar. Each speaker has a photo, a name and a position on the canvas.
- **Layouts for each count**: landscape (16:9) layouts such as Side by Side, Host & Guest Spotlight, Dramatic Clash, Panel of Three and Panel of Four, plus portrait (9:16) layouts for Shorts.
- **Show presets**: three ready-made setups (Dual Speaker Debate, Solo Deep Dive, Interview Spotlight) that set the layout, speakers and text for a recurring format. Manage them with **Manage Shows**.
- **Photo upload and video scan**: add a still, or scan an uploaded video for well-framed frames of a speaker and use one.
- **Background removal**: runs in the browser with an on-device model. Choose the model in the toolbar; the sharper, larger model downloads once when you pick it.
- **Auto-framing and mask reset**: frame a speaker automatically after removing the background, and reset the mask or position at any time.

### Text, graphics and logos

- **Headline and extra text layers**: edit the headline, add more text layers, and pick a look for each (for example Neon Pop, Banner, Sunburst or Brush).
- **Fonts**: 28 studio fonts, grouped by style, with size, weight, alignment and colour controls.
- **Elements**: 38 recolourable vector elements (banners, frames, underlines, reactions, debate and podcast badges) that fit themselves to the headline.
- **Graphics layer**: rays, bursts, splats, brush strokes and other decorative shapes, placed behind or in front of the text.
- **Logo layer**: add an image as a logo, with flip and duplicate.
- **Background**: a gradient or your own photo, with blur and darken controls.

### Editing

- **Direct manipulation**: drag, resize and rotate objects on the canvas.
- **Layers panel**: show or hide, reorder and select every layer. Keys bring the selection forward or back.
- **Selection bar**: a small bar appears above the selected object with its most common actions. **More…** opens the full properties.
- **Right-click menu**: right-click an object on the canvas for the same actions as a list.
- **Command palette**: press **Ctrl/⌘K** (or the **Commands** button) and type part of a command's name. Enter runs it.
- **Undo and redo**: a bounded history of your edits.
- **Keyboard shortcuts**: see the list below. Press **?** (or the **?** button in the toolbar) for the full sheet. Every button shows its shortcut in its tooltip.

### Keyboard shortcuts

Ctrl and ⌘ both work on every platform, so the shortcuts below are the same everywhere.

| Action | Keys |
| --- | --- |
| Undo / redo | Ctrl/⌘ Z, Ctrl/⌘ Shift Z, Ctrl/⌘ Y |
| Save project | Ctrl/⌘ S |
| Export thumbnail | Ctrl/⌘ E |
| Open projects | Ctrl/⌘ O |
| Duplicate selected text, logo or element | Ctrl/⌘ D |
| Delete selected text, logo or element | Delete or Backspace |
| Move selection 1 px / 10 px | Arrow keys / Shift + arrow keys |
| Bring forward / send backward | Ctrl/⌘ ] / Ctrl/⌘ [ |
| Deselect | Esc |
| Command palette | Ctrl/⌘ K |
| Keyboard shortcuts sheet | ? |

### Export and projects

- **Export**: JPG or PNG at 1280×720 (HD) or 1920×1080 (Full HD).
- **Saved projects**: projects are kept in the browser's IndexedDB. Changes are saved automatically a moment after each edit, and **Save** writes the project explicitly. The desktop app keeps this storage between launches.
- **Projects window**: open or delete saved projects.
- **JSON export and import**: back up a project to a JSON file, or load one back in.
- **Older projects** are migrated to the current format when they are opened.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Canvas**: Fabric.js 5
- **Background removal**: @imgly/background-removal (in-browser AI)
- **Storage**: IndexedDB (projects), localStorage (small preferences)
- **Desktop app**: Python, with pywebview for the native macOS window and FastAPI with Uvicorn as the embedded server
- **Deployment**: Vercel (web version)

## Getting Started

### Download the Mac app

Download the latest macOS release from the
[releases page](https://github.com/ollisulopuisto/youthumber/releases/latest) (Apple Silicon Macs)
and move `YouThumber.app` to Applications.

**The app isn't signed with an Apple Developer ID, so macOS blocks it the first time**
("Apple could not verify YouThumber is free of malware"). To open it anyway:

- **macOS 15 Sequoia and later:** try to open it once and dismiss the warning. Then go
  to System Settings → Privacy & Security, scroll down to the message about YouThumber,
  click **Open Anyway** and confirm with your password.
- **macOS 14 and earlier:** right-click (Control-click) the app → **Open** → **Open**.
- **Or, in Terminal** (any version): `xattr -dr com.apple.quarantine /Applications/YouThumber.app`

You only need to do this once per downloaded version.

### Installation (from source)

```bash
npm install
```

### Desktop app (from source)

```bash
uv run youthumber
```

This starts the embedded server and opens YouThumber in a native window via `pywebview`.

Options:

- `uv run youthumber`: native desktop window
- `uv run youthumber --dev`: native window attached to the Vite dev server (`http://localhost:5173`)
- `uv run youthumber --no-gui`: headless local server on `http://127.0.0.1:8731/`
- `uv run youthumber --debug`: enable the WebKit web inspector

**App launcher (Dock, ⌘-Tab, Spotlight):** `uv run youthumber` runs as a plain Python process, so
macOS shows a generic icon. To get a named app for this checkout, run once:

```bash
uv run python scripts/make_launcher.py
```

It creates `~/Applications/YouThumber.app`, which runs `uv run youthumber` in this repo. The first
time you open it, macOS may ask whether YouThumber can access your Documents folder: allow it.
Output goes to `~/Library/Logs/YouThumber.log`. Run the script again after moving the repo.

### Web development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build, test and lint

```bash
npm run build      # production build
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript check
npm run lint       # ESLint
```

Python tests run with `uv run pytest`.

## How to Use

1. **Choose the speaker count** (1 to 4) and a layout. Pick a show preset to start from one.
2. **Add the speakers**: upload a photo, or scan a video for a frame.
3. **Remove the background** and frame each speaker.
4. **Write the headline** and any extra text, and pick a look and a font.
5. **Add elements, graphics or a logo** if you want them.
6. **Export** as JPG or PNG at HD or Full HD.

### Tips

- Use JPG for smaller files, which suits YouTube.
- Press **?** at any time to see the shortcut sheet.
- Select an object and press **Ctrl/⌘ K** to find any command by name.
- Right-click an object to act on it from the canvas.

## Project Structure

```
src/
├── App.jsx                       # Editor state, command context, keyboard handling
├── components/
│   └── ThumbnailEditor/          # Toolbar, canvas, panels, modals, selection bar, menu, palette
├── data/                         # Fonts, elements, text looks, background gradients
├── hooks/                        # Undo/redo history
├── modules/
│   ├── commands/                 # The command registry shared by keys, bar, menu and palette
│   ├── shortcuts/                # Shortcut definitions and matching
│   ├── shows/                    # Show presets
│   └── thumbnail/                # Layouts, project storage and migration, canvas helpers
├── services/                     # Video scan and other async work
├── test/                         # Vitest unit tests
└── main.jsx                      # Entry point

youthumber/                       # Python: desktop window (pywebview) and embedded server
launcher.py                       # Desktop app entry point
scripts/                          # Build, icon and launcher helpers
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Author

**[Pix3lTools](https://www.pix3ltools.com/)** - Professional tools for content creators.

- Website: [pix3ltools.com](https://www.pix3ltools.com/)
- GitHub: [github.com/Pix3ltools-lab](https://github.com/Pix3ltools-lab)
