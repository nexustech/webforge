# Bootstrap Studio Research

First research task from [`ideas.md`](../../ideas.md): how does Bootstrap Studio work internally, what is its stack, and how does it store projects?

Investigated on 2026-10-19 by unpacking the app on this machine. No web docs were needed for the internals, because the main-process source ships unminified and the developers shipped an architecture note (`CLAUDE.md`) inside the package by mistake.

## Answers to the key questions

**Is it an Electron application?**
Yes. The current version is Bootstrap Studio **8.0.1 on Electron 37 / Chromium 138**, packaged with electron-builder and updated with electron-updater.

**What is the technology stack?**
Plain JavaScript with **jQuery and hand-written component classes (no React/Vue)**, bundled by **esbuild** into a single 19 MB file. Other pieces:
- CodeMirror 5 for code editing
- Dart Sass, PostCSS, clean-css, terser and htmlparser2 for building output
- ssh2 for SFTP publishing
- The Vercel AI SDK for the new AI Assistant

The same codebase also builds Mail Studio. Details: [01-tech-stack.md](01-tech-stack.md)

**How does it work internally?**
Each page is a **typed component tree**. Each component declares its own options and knows how to render itself. The same tree renders through different contexts: Design canvas, Preview, Export and Screenshot.

A thin Node main process handles files, Sass, the preview HTTP server, SSE live reload, SFTP and updates. **Preview never touches disk**: the HTTP server asks the editor to render each requested URL from memory and pushes reloads over Server-Sent Events, so it also works on phones on the same Wi-Fi. Details: [02-architecture.md](02-architecture.md)

**How does it manage project files and configuration?**
- A design is a single **`.bsdesign` file, which is gzipped JSON** containing the component trees, a structured CSS AST, JS source and **all images/fonts as base64**. It is versioned (format v87 in 8.0) with migration converters.
- App settings live in `%APPDATA%\bstudio`, mostly in Chromium localStorage plus a few JSON files.
- Automatic backups go to `%USERPROFILE%\Bootstrap Studio Backups`.

Details: [03-project-file-format.md](03-project-file-format.md)

**Key features:** [04-key-features.md](04-key-features.md)

**What it means for Webforge:** [05-lessons-for-webforge.md](05-lessons-for-webforge.md)

**Version 9.0 (Oct 2026), competitor review:** [06-bootstrap-studio-9.md](06-bootstrap-studio-9.md). This covers the new CMS, components, editor and AI changes, and records the MVP and v1.1 decisions (BS9-1…10). The notes above describe v8.0.1.

## What was examined

| Location | Finding |
|---|---|
| `C:\Program Files\Bootstrap Studio` | **Legacy v4 shell from 2017** (Electron 1.7.9; the `version` file is the Electron version). It loaded the whole editor from `https://bootstrapstudio.io/app/?shell=4`. Probably safe to uninstall |
| `C:\Users\jabz_\AppData\Roaming\Bootstrap Studio` | userData of that legacy shell; almost empty |
| `C:\Users\jabz_\AppData\Local\Programs\bstudio` | **Current v8.0.1 install** (found during the investigation). `resources/app.asar` (226 MB) unpacked and analysed |
| `C:\Users\jabz_\AppData\Roaming\bstudio` | userData of the current app |
| `C:\Users\jabz_\Bootstrap Studio Backups` | Four backups of your "Cadence" and "K2" designs (May 2023, format v75), decompressed and parsed |

Methods: an asar extractor (Python), reading the main-process JS, fingerprinting `node_modules/...` paths and strings in the minified renderer bundle, and parsing the design JSON. Nothing on your machine was modified; extracted copies were kept in a temporary workspace.

## Confidence
- **High**: Electron/Chromium versions, main-process behaviour, file format, preview/live-reload mechanism, update/installer tooling, bundled libraries (all read directly from shipped code).
- **Medium**: internal source-tree layout (component classes, contexts, OT-based history). This comes from the developers' CLAUDE.md and is consistent with the minified bundle, but the source itself isn't shipped.
- Feature list: from the in-app docs index, UI strings, and the [v8.0 release announcement](https://forum.bootstrapstudio.io/t/version-8-0-is-out/12646).

## Sources
- Local files listed above
- [Bootstrap Studio 8.0 release announcement (forum)](https://forum.bootstrapstudio.io/t/version-8-0-is-out/12646)
- [Bootstrap Studio releases](https://bootstrapstudio.io/pages/releases)
- [Bootstrap Studio AI Assistant docs](https://bootstrapstudio.io/academy/advanced/ai-assistant/)
