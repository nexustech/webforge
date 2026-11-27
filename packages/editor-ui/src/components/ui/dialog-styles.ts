/**
 * Overlay and panel classes shared with AlertDialog. The panel is centred across the window and
 * hangs from its top edge, a little below the title bar (`--dialog-top`, theme.css), so a change of
 * its height moves only its bottom edge and nothing jumps under the pointer (#1441). It's no taller
 * than the room below that (`--dialog-fit-height`), so the window's own controls are never over it
 * (#1411); a taller one scrolls, its rows kept at their own height rather than squashed (a
 * template's preview over its caption). A dialog with a fixed height sets it as `--dialog-height`
 * (`[--dialog-height:min(44rem,var(--dialog-max-height))] h-(--dialog-height)`), and rises as far
 * as it must to fit, up to 1rem under the title bar. One that sets a height without it is only
 * shortened to fit.
 */
export const dialogStyles = {
  overlay:
    "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  content:
    "fixed top-[min(var(--dialog-top),calc(100dvh-1rem-var(--dialog-height,0px)))] left-1/2 z-50 grid max-h-[max(var(--dialog-fit-height),var(--dialog-height,0px))] auto-rows-max w-full max-w-[calc(100%-2rem)] -translate-x-1/2 gap-3 overflow-y-auto rounded-lg border border-border-strong bg-card p-4 text-card-foreground shadow-xl outline-none sm:max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  header: "flex flex-col gap-1",
  footer: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
  title: "text-lg font-semibold",
  description: "text-sm text-muted-foreground",
} as const;
