# Webforge

A desktop visual website builder for **DIY small-business owners**. Users drag and drop sections, click to edit text, choose a theme, and publish a fast, **self-contained static website** (plain HTML/CSS/JS, no server, no CDN), to a folder/ZIP, FTP/FTPS/SFTP or Netlify.

**Status:** planning complete; Phase 0 (prototype) next.

## Documentation
| Document | What it covers |
|---|---|
| [spec/01-architecture.md](spec/01-architecture.md) | Stack, process model, packages, data model, interfaces, decision register |
| [spec/02-mvp-spec.md](spec/02-mvp-spec.md) | MVP features and acceptance criteria, components, milestones, licensing |
| [spec/03-engineering-standards.md](spec/03-engineering-standards.md) | Toolchain, coding conventions, testing, CI, Definition of Done |
| [research/README.md](research/README.md) | Research notes and the reasoning behind every decision |
| [docs/adr/](docs/adr/) | Architecture decisions made during implementation |
| [ideas.md](ideas.md) | Original brief |

## Getting started
Requires Node 24 and pnpm 12 (`npm install -g pnpm@12`; the exact version is pinned in `package.json`).

```sh
pnpm install   # also installs the git hooks (lefthook)
pnpm dev       # start the desktop app with hot reload
pnpm check     # lint, typecheck, package boundaries, unused code, licences, tests with coverage
```

Repository layout: `apps/desktop` (Electron app) and `packages/*` (model, history, storage, engine, site-components, themes, pipeline, publish, editor-ui, i18n, test-utils). See [architecture §4](spec/01-architecture.md#4-package--module-structure-pnpm-monorepo).

## Stack at a glance
Electron 44 · React 19 + shadcn/ui · Tailwind v4 + daisyUI 5 · Puck (canvas engine) · Zustand + Immer (undo/redo) · SQLite `.wforge` files (better-sqlite3) · TypeScript 7 · pnpm + Turborepo · Biome · Vitest · Playwright · Storybook · electron-builder

## Platforms
Windows 10/11 x64 · macOS 13+ (Apple Silicon)

## Licence
Proprietary. All rights reserved. See [LICENSE](LICENSE).
