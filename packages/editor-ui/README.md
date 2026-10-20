# @webforge/editor-ui

The editor's look (UI1, [research/product/04-editor-look-and-feel.md](../../research/product/04-editor-look-and-feel.md)): theme tokens for a dark default and a light theme, compact density, and shadcn/ui components on Radix with Lucide icons.

## Public API
- `@webforge/editor-ui/theme.css`: Tailwind v4 plus the tokens. Import it from the app's stylesheet and set `data-theme="dark"` or `"light"` on `<html>`. Apps add their own `@source` so Tailwind sees their classes.
- Components (compact: 28 px controls, 24 px menu rows, 32 px tab strips, 3–4 px corners): `Button`, `Tabs`, `ToggleGroup`, `Tooltip`, `ScrollArea`, `ResizablePanelGroup`/`ResizablePanel`/`ResizableHandle`, `Dialog`, `AlertDialog`, `DropdownMenu`, `ContextMenu`, `Menubar`, `Command`, `Toaster` + `toast`.
- `cn(...classes)`: joins class names and resolves Tailwind conflicts.

```tsx
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@webforge/editor-ui";

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" aria-label={t("editor.undo")}>
      <Undo2Icon />
    </Button>
  </TooltipTrigger>
  <TooltipContent>{t("editor.undo")}</TooltipContent>
</Tooltip>;
```

## Tokens
Colours are CSS variables with shadcn's names (`--background`, `--primary`, `--ring`…) plus Webforge's own (`--panel`, `--panel-group`, `--tabs`, `--titlebar`, `--toolbar`, `--selection-outline`, `--success`, `--warning`, `--info`, `--publish`, `--save-status`…). Tailwind gets them as colours (`bg-panel`, `text-publish`). Text sizes: `text-2xs` 11 px, `text-xs` 12 px, `text-sm`/`text-base` 13 px, `text-lg` 15 px.

`src/contrast.test.ts` checks every text pair for at least 4.5:1 and every control, icon and outline for at least 3:1 (WCAG AA) in both themes. A few UI1 values were adjusted to pass; `theme.css` says which.

## Conventions
- The components in `src/components/ui/` are shadcn/ui code, copied and adapted. They keep shadcn's layout: one kebab-case file per primitive, holding its parts (`DialogContent`, `DialogTitle`…).
- No hard-coded UI text: labels come from `t()` (`pnpm ui-strings` checks this).
- The canvas iframe never gets these styles (`syncHostStyles: false`).

## Boundaries
- Renderer code only: no Node, no Electron. Only `editor-ui` and the desktop renderer import Radix (dependency-cruiser).
