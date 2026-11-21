# ReadmeWeb

A clean, modern, and lightweight Markdown viewer and editor on the web.

Built with **React 18**, **TypeScript**, and **Vite**.

## Features

- **Local Markdown Files**: Open and read `.md` and `.markdown` files directly from your computer without uploading to any server (100% Client-Side & Private).
- **Direct Save & Save As**: Direct in-place file editing using the File System Access API (Chrome/Edge/Opera) with automatic fallback for other browsers.
- **Server Documents**: Recursive multi-folder scanning, full-text document search, and direct reading/saving for documents hosted on your server.
- **Rich Markdown Preview**:
  - LaTeX Math formulas via KaTeX (`$...$` and `$$...$$`).
  - Interactive Mermaid diagrams (flowcharts, sequence, class, state, Gantt, ER) with full-screen zoom, pan, and PNG export.
  - Syntax highlighted code blocks with one-click copy.
  - Tables, task lists, footnotes, subscripts, superscripts, marks, definition lists, abbreviations, emoji shortcodes.
- **CodeMirror 6 Editor**: Line numbers, markdown syntax highlighting, search & replace, undo/redo, auto-indent.
- **Live Split-View**: Real-time synchronized two-way scrolling between editor and preview with adjustable split ratio.
- **Outline Navigation**: Collapsible heading tree with scroll-spy (auto-sliding drawer overlay on mobile).
- **Auto-save & Recovery**: Untitled drafts are automatically saved in IndexedDB and restored on restart.
- **Multi-format Export**: Export to standalone HTML, PDF (print-optimized), and PNG.
- **PWA & Offline Ready**: Installable as a desktop or mobile application; works completely offline.
- **16 Languages**: English, Vietnamese, Japanese, Chinese, Spanish, French, German, and more.

## Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Acknowledgements & Credits

ReadmeWeb is based on and ported from the open-source Markdown desktop application [Moji](https://github.com/alexishida/Moji) by [Alex Ishida](https://github.com/alexishida).

The codebase has been refactored, customized, and extended for the web platform with significant architectural changes and new capabilities:
- **Web & Shared Hosting Support**: Converted from an Electron desktop application into a standalone high-performance Web Single Page Application (SPA).
- **Server Documents**: Recursive multi-folder scanning, full-text file search, and direct server-side document reading & saving.
- **Dual-Backend Architecture**: Integrated Vite middleware for local development and native PHP 8.x + LiteSpeed/Apache configuration (`.htaccess`) for web hosting (e.g., Hostinger).
- **Full Responsive Design**: Seamless adaptive layout across mobile, tablet, and desktop viewports with sliding outline drawer overlay and compact toolbar.
- **Standalone Node.js Server**: Zero-dependency production server (`server.js`) for VPS and Docker environments.
