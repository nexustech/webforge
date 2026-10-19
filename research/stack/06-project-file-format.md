# Project File Format and Versions

**Status:** Researched 2026-10-19. Spike done: SQLite confirmed, findings in [ADR 0003](../../docs/adr/0003-wforge-sqlite-storage.md) (packaging, rollback journal, sync folders, untrusted files); product decisions recorded in [Decisions](#decisions-2026-10-19)
**Recommendation:** a **single-file project (`.wforge`) that is an SQLite database** containing JSON documents and binary assets, stored **content-addressed** so **named versions (snapshots)** are cheap. Offer **"Export as .zip"** (plain JSON + asset files) for backup and interchange. **Fallback:** a ZIP container (Sketch-style) if SQLite causes problems in the spike.

## Requirements (from discussion)

| # | Requirement | Notes |
|---|---|---|
| F1 | **One file per project** that users can copy, email and back up | Like `.bsdesign`, `.sketch`, `.docx` |
| F2 | **Our own controlled format**, versioned | Format version + migrations (Bootstrap Studio is on v87 with converters) |
| F3 | **Assets included** (images, fonts, custom code) | No base64-in-JSON bloat (Bootstrap Studio's weakness) |
| F4 | **Versions / snapshots the user can roll back to**, e.g. try a redesign, then go back | Must be cheap enough to take often |
| F5 | Crash-safe saves; never a half-written project | Atomic writes |
| F6 | Fast open and save even with many images | Don't rewrite 200 MB to change one word |
| — | Git-friendly | **Not required** |

## Options compared

| Option | Example | F3 Assets | F4 Versions | F5 Crash-safe | F6 Fast save with big assets | Readable / inspectable | Verdict |
|---|---|---|---|---|---|---|---|
| **Gzipped JSON** | Bootstrap Studio `.bsdesign` | ⚠️ base64 inside JSON (+33% size, all in memory) | ⚠️ Each version = full copy incl. assets | ✅ with temp + rename | ❌ Whole file rewritten | ⚠️ After gunzip | ❌ Doesn't scale with assets/versions |
| **ZIP container** (JSON + asset files) | Sketch `.sketch`, `.docx`, EPUB | ✅ Real files | ✅ Versions folder; assets can be shared by hash | ✅ with temp + rename | ❌ **Whole archive rewritten on every save** | ✅ Unzip and read | ✅ Good fallback |
| **SQLite database** | Recommended by SQLite as an "application file format"; used by many desktop apps | ✅ BLOBs, deduplicated by hash | ✅ **Snapshots share unchanged content: near-free** | ✅ **Transactional by design** | ✅ **Only changed pages written; continuous autosave** | ⚠️ Needs a SQLite viewer (mitigated by Export as .zip) | ⭐ **Recommended** |
| Folder of files | — | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ❌ Not one file (F1) |

### Why SQLite over ZIP
- **Incremental, atomic writes:** changing a heading rewrites a few KB, not the whole project. A crash or power cut mid-save can't corrupt the file. A ZIP must be rewritten in full each save, which gets slow and risky as images and versions accumulate.
- **Versions are cheap:** with content-addressed storage, a snapshot just records *which* blobs make up the project. Unchanged pages and images are shared, so 50 versions of a site with 100 MB of images might add only a few MB.
- **Autosave becomes trivial** (write each history commit in a transaction), and **persisting undo history across restarts** (decision D6, optional) becomes "one more table".
- **Fast open:** load only the current page and the asset list, not the whole project.
- SQLite's file format has been stable and backward compatible since 2004.

### Risks and mitigations
| Risk | Mitigation |
|---|---|
| Native module (`better-sqlite3`, MIT, v13) must be rebuilt for each Electron upgrade | Prebuilt binaries + `@electron/rebuild` in CI; unpack from asar. **Alternative:** Node's built-in `node:sqlite` (no native module; unflagged since Node 22.13; release candidate as of Node 25.7). Electron 44 ships Node 24, so **verify availability and stability in the spike** |
| Cloud-sync folders (OneDrive, Dropbox) copying a database while open | Use `journal_mode=DELETE` (no `-wal`/`-shm` side files), hold the file only while open, and checkpoint on close. Detect sync folders and show a gentle warning |
| Not human-readable | **File > Export as .zip** (JSON + assets), documented format; also a debug "inspect" command |
| Opening untrusted project files | Enable SQLite's defensive settings, validate schema on open; custom scripts already off by default in the editor |

## Proposed structure

**File:** `MySite.wforge` = SQLite DB with `PRAGMA application_id` set to a Webforge magic number, so tools can recognise it.

```sql
-- Metadata
meta(key TEXT PRIMARY KEY, value TEXT)
  -- format_version, app_version, project_id, created_at, name

-- Content-addressed storage: every JSON doc and asset lives here once
blobs(hash TEXT PRIMARY KEY,          -- sha-256 of content
      kind TEXT,                       -- 'json' | 'image' | 'font' | 'code' | 'thumb'
      mime TEXT, size INTEGER,
      compression TEXT,                -- 'none' (images) | 'gzip'/'zstd' (JSON, code)
      data BLOB)

-- The working copy: what the editor shows now
documents(id TEXT PRIMARY KEY,         -- e.g. page:home, layout:header, layout:footer,
                                        --      theme, settings, code:custom.js
          kind TEXT, name TEXT, sort INTEGER,
          blob_hash TEXT REFERENCES blobs(hash))
assets(id TEXT PRIMARY KEY, path TEXT,  -- e.g. img/hero.webp (export path)
       blob_hash TEXT REFERENCES blobs(hash), meta TEXT)

-- Versions (snapshots)
versions(id TEXT PRIMARY KEY, name TEXT, note TEXT,
         kind TEXT,                     -- 'manual' | 'auto' | 'before-restore'
         created_at TEXT, format_version INTEGER,
         manifest TEXT,                 -- JSON: {documents:{id:hash}, assets:{id:hash}}
         thumb_hash TEXT)

-- Optional (D6): persisted undo history for the working copy
history(seq INTEGER PRIMARY KEY, entry TEXT)   -- labelled patch entries
```

- **Saving** = update `blobs` + `documents` rows in one transaction.
- **Taking a version** = write one `versions` row with a manifest of current hashes (milliseconds).
- **Garbage collection** (on close or on demand): delete blobs not referenced by the working copy, any version, or history; then `VACUUM`.

## Versions: user experience

| Feature | Behaviour |
|---|---|
| **Save version…** | Named snapshot at any time, e.g. *"Before redesign"*, with an optional note and an automatic thumbnail |
| **Automatic versions** | On first open each day, before restoring a version, and before site-wide actions that need confirmation (D7: theme switch, page delete…). Last **20** kept by default, configurable (P3) |
| **Versions panel** | List with thumbnails, name, date, kind. **Preview** opens a read-only canvas of that version |
| **Restore** | Takes an automatic *"Before restore"* version of the current state first, then replaces the working copy. Recorded as **one undo step**: *"Restored version 'Before redesign'"* |
| **Prototype alternatives** | **"Open version as new project"** (or *Duplicate project from version*) to explore a different design without touching the main one |
| **Relationship to undo** | Undo/redo = fine-grained, in-session steps. Versions = coarse, named, permanent checkpoints that survive restarts |

## Format versioning (F2)
- `meta.format_version` (integer) is bumped on any model change, with a **migration chain** (`migrate_3_to_4`…) run on open, like Bootstrap Studio's converters.
- Each version records the `format_version` it was saved with. Older snapshots are **migrated lazily** when previewed or restored, so old versions never become unreadable.
- Opening a file from a *newer* Webforge: refuse with a clear "Please update Webforge" message (never open it read-write).
- **Backups:** periodic copies via SQLite's online backup API to a backups folder (keep the last N), like Bootstrap Studio's auto backups.

## Spike (1–2 days)
1. ✅ **Driver decided 2026-10-19: `better-sqlite3`.** Spike verifies it inside Electron 44: load, transaction write, backup; packaging (asar unpack) and `@electron/rebuild` on Windows + macOS.
2. Save/open a 5-page project with 50 images (≈100 MB). Measure open time, single-edit save time, and file size after 20 versions.
3. Kill the app mid-save and confirm the file still opens.
4. Put the file in a OneDrive folder, edit, close and reopen.
5. Export as .zip, then import the .zip back. Round trip must be lossless.

## Decisions (2026-10-19)

| # | Topic | Decision | Details |
|---|---|---|---|
| P1 | **File extension** | **`.wforge`** | Registered as a file association by the installer (Windows + macOS), with its own document icon. Double-clicking opens it in Webforge (single-instance handoff) |
| P2 | **Saving model** | **Periodic autosave** | Save ~2 s after editing pauses, at most every 30 s while editing continues, plus immediately on window blur, page switch, export and close. Each save is one SQLite transaction. Title bar shows *"Saved"* / *"Saving…"* instead of an "unsaved" dot. **Ctrl/Cmd+S** = "Save now" (reassurance for users with the habit). **Save version…** is a separate command (menu + Ctrl/Cmd+Alt+S). Interval configurable in Settings |
| P3 | **Automatic version retention** | Keep the **last 20 automatic versions** by default; **configurable** (e.g. 5–100, or "keep for N days") | Applies only to *automatic* versions (daily, before-restore, before site-wide actions). **Manual (named) versions are never auto-deleted**; the user deletes them. The Versions panel shows the space used, with a "Clean up" action. Pruning runs garbage collection of unreferenced blobs |
| P4 | **Large videos** | **Deferred to implementation** | — |
| P5 | **Trying alternative designs** | **Start simple: "Open version as new project"** (and "Duplicate project from version"). No in-project page variants for now | Revisit in-project variants (e.g. "Home A / Home B") only if user feedback asks for it |

**Effect on earlier decisions:** with autosave, undo/redo requirement **U9** ("modified" marker clears when undoing back to the saved point) no longer applies. The project is always saved within seconds. Undo history continues across autosaves.

## Remaining open questions
1. **Large videos:** stored in the project or linked from a folder next to it (deferred, P4).

## Sources
- [SQLite as an application file format](https://www.sqlite.org/appfileformat.html)
- [Node.js `node:sqlite` docs](https://nodejs.org/api/sqlite.html) (release candidate as of v25.7; unflagged since v22.13)
- [Sketch file format (ZIP of JSON + images)](https://developer.sketch.com/file-format) · [spec](https://developer.sketch.com/file-format/spec)
- npm: `better-sqlite3` 13.0.3 (MIT), `@electron/rebuild` 4.2.1 (MIT), `yazl`/`yauzl` (MIT), `fflate` 0.8.3 (MIT), `jszip` (MIT or GPL, use under MIT), checked 2026-10-19
- Bootstrap Studio `.bsdesign` analysis: [../bootstrap-studio/03-project-file-format.md](../bootstrap-studio/03-project-file-format.md)
