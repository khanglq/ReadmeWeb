# ReadmeWeb

A clean, modern, and lightweight Markdown viewer and editor on the web.

Built with **React 18**, **TypeScript**, and **Vite**.

## Features

- **Local Markdown Files**: Open and read `.md` and `.markdown` files directly from your computer without uploading to any server (100% Client-Side & Private).
- **Direct Save & Save As**: Direct in-place file editing using the File System Access API (Chrome/Edge/Opera) with automatic fallback for other browsers.
- **Rich Markdown Preview**:
  - LaTeX Math formulas via KaTeX (`$...$` and `$$...$$`).
  - Interactive Mermaid diagrams (flowcharts, sequence, class, state, Gantt, ER) with full-screen zoom, pan, and PNG export.
  - Syntax highlighted code blocks with one-click copy.
  - Tables, task lists, footnotes, subscripts, superscripts, marks, definition lists, abbreviations, emoji shortcodes.
- **CodeMirror 6 Editor**: Line numbers, markdown syntax highlighting, search & replace, undo/redo, auto-indent.
- **Live Split-View**: Real-time synchronized two-way scrolling between editor and preview with adjustable split ratio.
- **Outline Navigation**: Collapsible heading tree with scroll-spy.
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
