# RRF Web Editor

A browser-based G-code editor for **RepRapFirmware (RRF)**, built on Monaco Editor.  
It provides RRF-specific syntax highlighting, object model completion, hover documentation, and syntax validation — no installation required.

## Features

- **Syntax highlighting** — switchable between `gcode-fdm` and `gcode-cnc` modes (for RRFv3.6)
- **Object model completion** — type `{move.axes[0].` and get property suggestions
- **Hover documentation** — hover over any G/M/T code to see its parameters and description
- **Syntax validation** — unknown G/M codes are marked with warning indicators
- **File operations** — new, open, save, and drag-and-drop support
- **Theme toggle** — light and dark themes
- **Keyboard shortcuts** — Ctrl+S to save, Ctrl+N for new file

## Usage

### Online

The editor is published via GitHub Pages and automatically deployed on every push to `main`.

### Run locally

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

Static files are output to the `dist/` folder.

## Tech Stack

| | Version |
|---|---|
| Vite | 8 |
| TypeScript | 6 |
| Monaco Editor | 0.55 |
| @duet3d/monacotokens | 3.6 |
| @duet3d/objectmodel | 3.7.0-alpha |

## License

See [LICENSE](LICENSE).
