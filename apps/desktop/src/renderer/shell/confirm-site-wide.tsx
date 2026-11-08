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
import { useSyncExternalStore } from "react";
import type { CommandRegistry } from "./commands.js";

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
  /** The version's name, saved once confirmed, if not "Before: {confirm}" (an AI app's plan). */
  readonly version?: string;
};

/**
 * Runs before every confirmed site-wide action, and before a change to every page that asks no
 * question (`asked` false, {@link SiteWideConfirm.beforeUnaskedChange}): Version History (4.6) saves
 * a version here.
 */
type BeforeSiteWideAction = (
  action: SiteWideAction,
  options: { readonly asked: boolean },
) => void | Promise<void>;

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
  /**
   * Runs the {@link BeforeSiteWideAction} for a change to every page that asks no question first
   * (a theme control's, 4.6), before the change is made. Resolves once it has run; a failed hook
   * never blocks the change.
   */
  beforeUnaskedChange(action: SiteWideAction): Promise<void>;
  /** The question shown, if any; for the dialog. */
  current(): SiteWideAction | null;
  /**
   * Whether a question is open, or an answered change waits for the {@link BeforeSiteWideAction}
   * to run before it's made (4.6: its version saving). Nothing else, Undo included, may change the
   * site meanwhile: every way in checks this, not {@link SiteWideConfirm.current} alone.
   */
  busy(): boolean;
  /** The last question asked, kept once answered; the dialog shows it while it fades out. */
  last(): SiteWideAction | null;
  subscribe(listener: () => void): () => void;
  /** The person's answer; for the dialog. */
  answer(confirmed: boolean): void;
};

const nothingBefore: BeforeSiteWideAction = () => undefined;

/** Creates the window's site-wide confirmations; show them with {@link SiteWideConfirmDialog}. */
export function createSiteWideConfirm(): SiteWideConfirm {
  let open: { action: SiteWideAction; settle: (confirmed: boolean) => void } | null = null;
  let last: SiteWideAction | null = null;
  let before = nothingBefore;
  // How many changes wait for the hook before they're made.
  let waiting = 0;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  /** Runs the hook for `action`, counted as {@link SiteWideConfirm.busy} until it has. */
  const runBefore = async (action: SiteWideAction, asked: boolean): Promise<void> => {
    waiting += 1;
    changed();
    try {
      await before(action, { asked });
    } catch {
      // A failed hook (a version not saved) never blocks the person's change.
    } finally {
      waiting -= 1;
      changed();
    }
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
            // The change is made as this resolves, before any key the person presses meanwhile.
            void runBefore(action, true).then(() => resolve(true));
          },
        };
        open = asked;
        last = action;
        changed();
      });
    },
    beforeUnaskedChange: (action) => runBefore(action, false),
    setBeforeSiteWideAction(hook) {
      before = hook;
      return () => {
        if (before === hook) before = nothingBefore;
      };
    },
    current: () => open?.action ?? null,
    busy: () => open !== null || waiting > 0,
    last: () => last,
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

/**
 * Pauses `registry`'s commands (Delete, Duplicate, Paste, Undo…) while `confirm` asks a question,
 * and while the answered change waits for its version, so nothing changes the site between the
 * question and the change. Returns a function that stops.
 */
export function pauseCommandsWhileAsking(
  confirm: Pick<SiteWideConfirm, "busy" | "subscribe">,
  registry: Pick<CommandRegistry, "pause">,
): () => void {
  let resume: (() => void) | null = null;
  const follow = () => {
    // Asking, or the answered change still waiting for its version (4.6).
    const asking = confirm.busy();
    if (asking && resume === null) {
      resume = registry.pause();
    } else if (!asking && resume !== null) {
      resume();
      resume = null;
    }
  };
  follow();
  const stop = confirm.subscribe(follow);
  return () => {
    stop();
    resume?.();
  };
}

/** The dialog that asks {@link SiteWideConfirm}'s questions, stating how many pages change. */
export function SiteWideConfirmDialog({ confirm }: { readonly confirm: SiteWideConfirm }) {
  const asked = useSyncExternalStore(confirm.subscribe, confirm.current, confirm.current);
  // The last question stays shown while the dialog fades out.
  const action = useSyncExternalStore(confirm.subscribe, confirm.last, confirm.last);
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
          {/* An AI app's question names whole web addresses, which wrap anywhere (S18). */}
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
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
