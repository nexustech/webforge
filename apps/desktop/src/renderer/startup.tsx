import { ErrorFallback } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Preferences } from "../shared/ipc/prefs.js";

/**
 * Shows the editor in `theme`, and puts it in the page's address (`?theme=`), where the start-up
 * screen reads it before the first paint (public/startup-theme.js, #887): a reload, as opening a
 * site from the start screen does, then starts in the theme the person has now.
 */
export function applyTheme(
  theme: Preferences["theme"],
  page: { readonly document: Document; readonly location: Location; readonly history: History },
): void {
  page.document.documentElement.dataset.theme = theme;
  const address = new URL(page.location.href);
  if (address.searchParams.get("theme") === theme) return;
  address.searchParams.set("theme", theme);
  page.history.replaceState(page.history.state, "", address.href);
}

/**
 * Marks `webforge:first-render` in the window's performance timeline when React's first render
 * replaces the start-up screen in `container`: a stage of a start-up's timing (#891), which
 * `e2e/perf/cold-start.perf.ts` reads with the page's own paint and navigation timings.
 */
export function markFirstRender(container: Node): void {
  const observer = new MutationObserver(() => {
    observer.disconnect();
    performance.mark("webforge:first-render");
  });
  observer.observe(container, { childList: true });
}

/** How long loading the editor's code may wait for the start screen to be idle (#945). */
export const EDITOR_PRELOAD_TIMEOUT_MS = 2_000;

/**
 * Loads the editor's code with `load` once the start screen has drawn and the window is idle
 * (#945). The start screen needs none of it (#896), so it draws without it. But opening a site from
 * it reloads the window, and the editor's chunk compiled on the opening's path cost it about 1 CPU-s
 * more on CI's runners; loaded here first, the reloaded window compiles it again for a fraction of
 * that, and the editor shows sooner. A load that fails is left to the opening, which loads it again
 * and says if it can't.
 */
export function preloadEditorWhenIdle(
  load: () => Promise<unknown>,
  idle: (work: () => void, options: IdleRequestOptions) => unknown = requestIdleCallback,
): void {
  idle(
    () => {
      load().catch(() => undefined);
    },
    { timeout: EDITOR_PRELOAD_TIMEOUT_MS },
  );
}

/**
 * What replaces the start-up screen when the editor couldn't start (#887), such as the site not
 * being read: the error is reported as a crash report, and *Try again* reloads the window.
 */
export function StartFailed({ onRetry }: { readonly onRetry: () => void }) {
  // Under the start-up screen's title bar, so the window still moves.
  return (
    <div className="startup">
      <div className="startup__title-bar" />
      <div className="min-h-0 flex-1">
        <ErrorFallback
          message={t("app.startFailed.message")}
          actionLabel={t("app.startFailed.reload")}
          onAction={onRetry}
        />
      </div>
    </div>
  );
}
