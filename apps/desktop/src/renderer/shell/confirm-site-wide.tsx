import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useRef, useSyncExternalStore } from "react";

/** An action that changes more than the page shown, to confirm first (D7, F-ED-14). */
export type SiteWideAction = {
  /** What will happen, as the dialog's title: "Delete page 'About'?". */
  readonly action: string;
  /** More about it, before the impact: "This removes the page and its content." */
  readonly description?: string;
  /** The confirm button: "Delete Page". */
  readonly confirm: string;
  /** How many pages it changes, which the dialog states ("This changes 6 pages."). */
  readonly affectedPages: number;
};

/** Runs before every confirmed site-wide action; Version History (4.6) saves a version here. */
export type BeforeSiteWideAction = (action: SiteWideAction) => void | Promise<void>;

/**
 * The window's site-wide confirmations: asked by any part of the editor (the App hands it to the
 * editor and the panels), shown by one {@link SiteWideConfirmDialog}.
 */
export type SiteWideConfirm = {
  /**
   * Asks the person to confirm `action`, saying how many pages it changes. Resolves `true` once
   * they confirm and {@link BeforeSiteWideAction} has run, `false` if they cancel. The action
   * itself stays one undo step, as any edit. One question at a time: asking again while one is
   * open cancels the first.
   */
  confirmSiteWide(action: SiteWideAction): Promise<boolean>;
  /** Sets what runs before every confirmed action (nothing until Version History); returns undo. */
  setBeforeSiteWideAction(hook: BeforeSiteWideAction): () => void;
  /** The question shown, if any; for the dialog. */
  current(): SiteWideAction | null;
  subscribe(listener: () => void): () => void;
  /** The person's answer; for the dialog. */
  answer(confirmed: boolean): void;
};

const nothingBefore: BeforeSiteWideAction = () => undefined;

/** Creates the window's site-wide confirmations; show them with {@link SiteWideConfirmDialog}. */
export function createSiteWideConfirm(): SiteWideConfirm {
  let open: { action: SiteWideAction; settle: (confirmed: boolean) => void } | null = null;
  let before = nothingBefore;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    confirmSiteWide(action) {
      open?.settle(false);
      return new Promise<boolean>((resolve) => {
        const asked = {
          action,
          settle: (confirmed: boolean) => {
            if (open === asked) {
              open = null;
              changed();
            }
            if (!confirmed) {
              resolve(false);
              return;
            }
            void Promise.resolve(before(action)).then(
              () => resolve(true),
              // A failed hook (a version not saved) never blocks the person's action.
              () => resolve(true),
            );
          },
        };
        open = asked;
        changed();
      });
    },
    setBeforeSiteWideAction(hook) {
      before = hook;
      return () => {
        if (before === hook) before = nothingBefore;
      };
    },
    current: () => open?.action ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    answer(confirmed) {
      open?.settle(confirmed);
    },
  };
}

/** The dialog that asks {@link SiteWideConfirm}'s questions, stating how many pages change. */
export function SiteWideConfirmDialog({ confirm }: { readonly confirm: SiteWideConfirm }) {
  const asked = useSyncExternalStore(confirm.subscribe, confirm.current, confirm.current);
  // The last question stays shown while the dialog fades out.
  const last = useRef<SiteWideAction | null>(null);
  if (asked !== null) last.current = asked;
  const action = asked ?? last.current;
  return (
    <AlertDialog
      open={asked !== null}
      onOpenChange={(open) => {
        if (!open) confirm.answer(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action?.action}</AlertDialogTitle>
          <AlertDialogDescription>
            {action?.description === undefined ? "" : `${action.description} `}
            {action === null
              ? ""
              : action.affectedPages === 1
                ? t("confirm.siteWide.affectsOne")
                : t("confirm.siteWide.affectsMany", { count: action.affectedPages })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("confirm.siteWide.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => confirm.answer(true)}>
            {action?.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
