import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { AwayApp } from "./while-away.js";

/** Props of {@link WhileAwayDialog}. */
export type WhileAwayDialogProps = {
  readonly open: boolean;
  /** What each app changed while the person was away, by page. */
  readonly apps: readonly AwayApp[];
  /** The app whose **Undo All** is under way, if any. */
  readonly undoing?: string | undefined;
  /** Shows page `pageId`, where its changes are. */
  readonly onShowPage: (pageId: string) => void;
  /** Goes back to the version before `app`'s first change. */
  readonly onUndoAll: (app: string) => void;
  readonly onClose: () => void;
};

/**
 * "While you were away" (5.36, UA-3): what each AI app working without asking changed while the
 * person was away, by page, each page's name showing that page; and for each app, **Undo All**,
 * back to the version saved before its first change. **Keep** closes it.
 */
export function WhileAwayDialog({
  open,
  apps,
  undoing,
  onShowPage,
  onUndoAll,
  onClose,
}: WhileAwayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col">
        <DialogHeader>
          <DialogTitle>{t("ai.away.title")}</DialogTitle>
          <DialogDescription>{t("ai.away.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {apps.map(({ app, pages }) => (
            <section
              key={app}
              aria-label={t("ai.away.app", { app })}
              className="flex flex-col gap-2"
            >
              <h3 className="m-0 text-sm font-semibold">{t("ai.away.app", { app })}</h3>
              {pages.map((page) => (
                <div key={page.pageId ?? ""} className="flex flex-col gap-1">
                  {page.pageId === null ? (
                    <h4 className="m-0 text-sm text-muted-foreground">{page.title}</h4>
                  ) : (
                    <h4 className="m-0 text-sm">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => {
                          if (page.pageId !== null) onShowPage(page.pageId);
                        }}
                      >
                        {t("ai.away.showPage", { page: page.title })}
                      </Button>
                    </h4>
                  )}
                  <ul className="m-0 list-disc pl-5 text-sm">
                    {page.changes.map((change, index) => (
                      // The same change can be made twice on a page.
                      <li key={`${index}:${change}`}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={undoing !== undefined}
                onClick={() => onUndoAll(app)}
              >
                {t("ai.away.undoAll", { app })}
              </Button>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{t("ai.away.keep")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
