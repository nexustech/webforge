import { cn } from "@webforge/editor-ui";
import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { ChevronRightIcon } from "lucide-react";
import { useEffect } from "react";
import { selectionPath } from "./breadcrumbs.js";
import type { EditorSession } from "./editor-session.js";
import { sameValue } from "./same-value.js";
import { useDocument, useUi } from "./use-document.js";

/** Props of {@link CanvasBreadcrumbs}. */
export type CanvasBreadcrumbsProps = {
  readonly session: EditorSession;
  readonly engine: CanvasEngine | null;
};

/**
 * The breadcrumb bar under the canvas toolbar (1.30, UX-9): where the selected element is, as
 * Page › Section › … › Element. A click selects that step (the page: nothing), and the pointer or
 * focus on one outlines it on the canvas.
 */
export function CanvasBreadcrumbs({ session, engine }: CanvasBreadcrumbsProps) {
  const pageId = useUi(session, (ui) => ui.pageId);
  const nodeId = useUi(session, (ui) => ui.nodeId);
  // Redrawn when a step's title changes, not on every keystroke in the page.
  const crumbs = useDocument(
    session,
    (site) => selectionPath(site, pageId, nodeId, session.library),
    sameValue,
  );
  const outline = (id: string | null) => engine?.outline(id);
  // A step under the pointer can go without the pointer leaving it (Esc, Delete or Undo while it
  // is there): its outline goes with the selection or page it belonged to, or with the bar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new selection or page runs the cleanup.
  useEffect(() => () => engine?.outline(null), [engine, pageId, nodeId]);

  return (
    <nav
      aria-label={t("canvas.breadcrumbs")}
      className="flex h-7 shrink-0 items-center border-border border-b px-2"
    >
      <ol className="m-0 flex min-w-0 list-none items-center gap-0.5 p-0 text-xs">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.id ?? "page"} className="flex min-w-0 items-center gap-0.5">
              {index === 0 ? null : (
                <ChevronRightIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              )}
              <button
                type="button"
                aria-current={last ? "location" : undefined}
                className={cn(
                  "max-w-48 truncate rounded-sm px-1.5 py-0.5 outline-none",
                  "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
                  last ? "font-medium text-foreground" : "text-muted-foreground",
                )}
                onClick={() => session.select(crumb.id)}
                onPointerEnter={() => outline(crumb.id)}
                onPointerLeave={() => outline(null)}
                onFocus={() => outline(crumb.id)}
                onBlur={() => outline(null)}
              >
                {crumb.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
