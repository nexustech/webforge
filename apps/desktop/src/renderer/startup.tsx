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
