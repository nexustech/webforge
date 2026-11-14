import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useMenuDialog,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { BrushCleaningIcon, HistoryIcon, MoreHorizontalIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { mediaImageUrl } from "../../shared/ipc/media.js";
import type { VersionSummary } from "../../shared/ipc/versions.js";
import { reportFailure } from "../log.js";
import { fileSizeLabel } from "../media/index.js";
import type { VersionActions } from "./version-actions.js";
import type { VersionListState } from "./version-list.js";
import { versionDate, versionName, versionPublished } from "./version-words.js";

/** Props of {@link VersionHistoryPanel}. */
export type VersionHistoryPanelProps = {
  readonly state: VersionListState;
  readonly actions: Pick<
    VersionActions,
    "preview" | "restore" | "republish" | "remove" | "openAsNewSite" | "cleanUp"
  >;
  /** Save Version…: asks for the version's name. */
  readonly onSave: () => void;
  /** How dates are written; the computer's way when left out. */
  readonly locale?: string;
};

/** A question before what a version's menu does. */
type Asked = { readonly kind: "restore" | "delete"; readonly version: VersionSummary };

/** What a version's menu opens once it has closed: a question, or Publish's destinations. */
type MenuChoice = Asked | { readonly kind: "republish"; readonly version: VersionSummary };

/**
 * Version History (F-SITE-4, 4.6): the site's versions, newest first, each with a picture of the
 * canvas, its name (or why {appName} saved it), when, and where and when it was last published;
 * Save Version…; and for each, Preview, Restore…, Republish…, Open as New Site… and Delete…,
 * Restore and Delete asked about first. Beside Undo History in the left column's bottom (A21), with
 * the space the versions use.
 */
export function VersionHistoryPanel({ state, actions, onSave, locale }: VersionHistoryPanelProps) {
  const [asked, setAsked] = useState<Asked | null>(null);
  const [busy, setBusy] = useState(false);
  // Opened once the menu has closed, so the dialog keeps the focus.
  const menuDialog = useMenuDialog<MenuChoice>((choice) => {
    if (choice.kind === "republish") actions.republish(choice.version);
    else setAsked(choice);
  });

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    // Each action says itself what went wrong; the panel only waits for it, and logs a failure
    // by its code (#990).
    void work()
      .catch((error: unknown) => reportFailure("versions.action", error))
      .then(() => setBusy(false));
  };
  const answer = () => {
    const question = asked;
    setAsked(null);
    if (question === null) return;
    run(() =>
      question.kind === "restore"
        ? actions.restore(question.version)
        : actions.remove(question.version),
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-2 py-1.5">
        <Button variant="outline" size="sm" onClick={onSave} disabled={busy}>
          <SaveIcon aria-hidden />
          {t("versionHistory.save")}
        </Button>
      </div>
      {/* A plain scroller: ScrollArea's table-like content box would stop long names being cut short. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status !== "ready" ? (
          <p className="m-0 p-3 text-xs text-muted-foreground" role="status">
            {state.status === "loading"
              ? t("versionHistory.loading")
              : t("versionHistory.loadFailed")}
          </p>
        ) : state.versions.length === 0 ? (
          <p className="m-0 p-3 text-xs text-muted-foreground">{t("versionHistory.empty")}</p>
        ) : (
          <ol aria-label={t("versionHistory.list")} className="flex flex-col gap-0.5 p-1">
            {state.versions.map((version) => {
              const name = versionName(version);
              const published = versionPublished(version, locale);
              return (
                <li
                  key={version.id}
                  className="version-history__version flex items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-hover"
                >
                  {version.thumbnailHash === undefined ? (
                    <span
                      aria-hidden
                      className="flex h-9 w-14 shrink-0 items-center justify-center rounded-xs border bg-muted text-muted-foreground"
                    >
                      <HistoryIcon className="size-4" />
                    </span>
                  ) : (
                    <img
                      src={mediaImageUrl({ hash: version.thumbnailHash }, "original")}
                      alt=""
                      className="h-9 w-14 shrink-0 rounded-xs border bg-muted object-cover object-top"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-xs font-medium">{name}</p>
                    <p className="m-0 truncate text-xs text-muted-foreground">
                      {versionDate(version, locale)}
                      {version.reason === "manual" ? null : ` · ${t("versionHistory.automatic")}`}
                    </p>
                    {published === undefined ? null : (
                      // Cut short in a narrow panel: the whole of it on hover.
                      <p className="m-0 truncate text-xs text-muted-foreground" title={published}>
                        {published}
                      </p>
                    )}
                  </div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("versionHistory.actions", { name })}
                        title={t("versionHistory.actions", { name })}
                        disabled={busy}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onCloseAutoFocus={menuDialog.onCloseAutoFocus}>
                      <DropdownMenuItem onSelect={() => run(() => actions.preview(version))}>
                        {t("versionHistory.preview")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => menuDialog.choose({ kind: "restore", version })}
                      >
                        {t("versionHistory.restore")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => menuDialog.choose({ kind: "republish", version })}
                      >
                        {t("versionHistory.republish")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => run(() => actions.openAsNewSite(version))}>
                        {t("versionHistory.openAsNewSite")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => menuDialog.choose({ kind: "delete", version })}
                      >
                        {t("versionHistory.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {state.status === "ready" ? (
        // The space the versions use, and Clean up (P3).
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <span className="truncate text-xs text-muted-foreground">
            {state.versions.length > 0
              ? t("versionHistory.space", { size: fileSizeLabel(state.bytes) })
              : null}
          </span>
          <Button
            variant="ghost"
            size="sm"
            title={t("versionHistory.cleanUpHelp")}
            onClick={() => run(() => actions.cleanUp())}
            disabled={busy}
          >
            <BrushCleaningIcon aria-hidden />
            {t("versionHistory.cleanUp")}
          </Button>
        </div>
      ) : null}
      <AlertDialog
        open={asked !== null}
        onOpenChange={(open) => {
          if (!open) setAsked(null);
        }}
      >
        {asked === null ? null : (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(
                  asked.kind === "restore"
                    ? "versionHistory.restore.title"
                    : "versionHistory.delete.title",
                  { name: versionName(asked.version) },
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  asked.kind === "restore"
                    ? "versionHistory.restore.description"
                    : "versionHistory.delete.description",
                  { date: versionDate(asked.version, locale) },
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("versionHistory.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant={asked.kind === "delete" ? "destructive" : "default"}
                onClick={answer}
              >
                {t(
                  asked.kind === "restore"
                    ? "versionHistory.restore.confirm"
                    : "versionHistory.delete.confirm",
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
