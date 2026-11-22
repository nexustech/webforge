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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { SiteCheckToFixNote } from "../site-check/index.js";
import type { LivePublish } from "./publish-flow.js";

/** The dialog a publish has open: *Your site is live*, or whether to replace another site. */
type Shown =
  | {
      readonly kind: "live";
      readonly live: LivePublish;
      /** How many things Site Check listed to fix as it went live (#1171). */
      readonly toFix: number;
      /** Its visitors get Netlify's log-in page, as checked once it went live (4.4b). */
      readonly protected?: true;
    }
  | {
      readonly kind: "replace";
      readonly destination: string;
      readonly answer: (replace: boolean) => void;
    };

/** The publish's dialogs, one at a time: the flow asks, the window draws them. */
export type PublishOutcomes = {
  readonly state: StoreApi<{ readonly shown: Shown | null }>;
  /** Whether to replace the site in `destination`'s folder; false once closed unanswered. */
  askReplace(destination: string): Promise<boolean>;
  /** *Your site is live*, with how many things Site Check lists to fix (#1171). */
  showLive(live: LivePublish, toFix?: number): void;
  /**
   * Says on *Your site is live* that publish `operationId`'s Netlify site keeps visitors out, if
   * it's still the one shown (4.4b, ADR 0006 decision 6).
   */
  markProtected(operationId: string): void;
  /** Closes what's shown: whether to replace, answered no, or *Your site is live*. */
  close(): void;
};

/** Creates the publish's dialogs, none shown. */
export function createPublishOutcomes(): PublishOutcomes {
  const state = createStore<{ readonly shown: Shown | null }>(() => ({ shown: null }));
  return {
    state,
    askReplace: (destination) =>
      new Promise((resolve) => {
        // Answered once: Replace It closes the dialog too, which would answer again.
        let answered = false;
        state.setState({
          shown: {
            kind: "replace",
            destination,
            answer: (replace) => {
              if (answered) return;
              answered = true;
              state.setState({ shown: null });
              resolve(replace);
            },
          },
        });
      }),
    showLive: (live, toFix = 0) => state.setState({ shown: { kind: "live", live, toFix } }),
    markProtected: (operationId) => {
      const { shown } = state.getState();
      if (shown?.kind === "live" && shown.live.operationId === operationId) {
        state.setState({ shown: { ...shown, protected: true } });
      }
    },
    close: () => {
      const { shown } = state.getState();
      if (shown?.kind === "replace") shown.answer(false);
      else state.setState({ shown: null });
    },
  };
}

export type PublishOutcomeDialogsProps = {
  readonly state: PublishOutcomes["state"];
  /** Opens the site where publish `operationId` went live. */
  readonly openLive: (operationId: string) => void;
  readonly copyLink: (url: string) => void;
  /** Shows the Site Check panel (#1171). Left out, the count has no button. */
  readonly showSiteCheck?: () => void;
};

/**
 * What became of a publish (4.5, F-PB-2): *Your site is live*, with its address, Open Site and Copy
 * Link and what the live check found; a version that couldn't be kept is said quietly, never as a
 * failure. Or, before anything is replaced, whether to replace the site another publish left in
 * the folder (A8).
 */
export function PublishOutcomeDialogs({
  state,
  openLive,
  copyLink,
  showSiteCheck = () => undefined,
}: PublishOutcomeDialogsProps) {
  const { shown } = useStore(state);
  const close = () => state.setState({ shown: null });
  const live = shown?.kind === "live" ? shown.live : undefined;
  const replace = shown?.kind === "replace" ? shown : undefined;
  return (
    <>
      <Dialog open={live !== undefined} onOpenChange={(next) => (next ? undefined : close())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("publish.live.title")}</DialogTitle>
            <DialogDescription className="break-all">
              {live === undefined || live.url === ""
                ? t("publish.live.noAddress")
                : t("publish.live.at", { url: live.url })}
            </DialogDescription>
          </DialogHeader>
          {shown?.kind === "live" && shown.protected === true && (
            <div
              role="alert"
              className="space-y-1 rounded-md border border-warning bg-warning/10 p-3 text-sm"
            >
              <p className="font-medium">{t("publish.netlify.protected.title")}</p>
              <p>{t("publish.netlify.protected.body")}</p>
            </div>
          )}
          {live !== undefined && (
            <div className="space-y-2 text-sm">
              {(live.check === "different" || live.check === "unreachable") && (
                <p>{t(`publish.live.check.${live.check}`)}</p>
              )}
              <p className="text-muted-foreground">
                {live.restored === true
                  ? t("publish.live.restored")
                  : t("publish.live.summary", {
                      uploaded: live.uploaded,
                      unchanged: live.unchanged,
                      removed: live.removed,
                    })}
              </p>
              {!live.versionSaved && (
                <p className="text-muted-foreground">{t("publish.live.versionNotSaved")}</p>
              )}
              {shown?.kind === "live" && (
                <SiteCheckToFixNote
                  count={shown.toFix}
                  onShow={() => {
                    close();
                    showSiteCheck();
                  }}
                />
              )}
            </div>
          )}
          <DialogFooter>
            {live !== undefined && live.url !== "" && (
              <>
                <Button variant="outline" onClick={() => copyLink(live.url)}>
                  {t("publish.live.copy")}
                </Button>
                <Button variant="outline" onClick={() => openLive(live.operationId)}>
                  {t("publish.live.open")}
                </Button>
              </>
            )}
            <Button onClick={close}>{t("publish.live.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={replace !== undefined}
        onOpenChange={(next) => (next ? undefined : replace?.answer(false))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("publish.replace.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("publish.replace.body", { name: replace?.destination ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("publish.replace.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => replace?.answer(true)}>
              {t("publish.replace.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
