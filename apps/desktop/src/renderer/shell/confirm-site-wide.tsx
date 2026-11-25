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
import type { HistoryCommand } from "@webforge/engine";
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
  /** How many pages it changes, which the dialog states ("6 pages of your site will change."). */
  readonly affectedPages: number;
  /** The version's name, saved once confirmed, if not "Before: {confirm}" (an AI app's plan). */
  readonly version?: string;
  /**
   * An AI app's question offers to let it work without asking (5.35, UA-2): chosen, this is called,
   * and the change is allowed.
   */
  readonly allowAlways?: () => void;
  /**
   * Pictures the change would show, small, each with what it would be (an AI app's new logo or site
   * icon, UA-8), so the person sees what they allow.
   */
  readonly pictures?: readonly { readonly label: string; readonly src: string }[];
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
   *
   * Confirmed, the caller makes the change as this resolves, with nothing awaited between: the
   * keys pressed meanwhile run in the next task (see {@link SiteWideConfirm.afterChange}), and
   * would land before a change made later.
   */
  confirmSiteWide(action: SiteWideAction): Promise<boolean>;
  /** Sets what runs before every confirmed action (nothing until Version History); returns undo. */
  setBeforeSiteWideAction(hook: BeforeSiteWideAction): () => void;
  /**
   * Runs the {@link BeforeSiteWideAction} for a change to every page that asks no question first
   * (a theme control's, 4.6), before the change is made. Resolves once it has run; a failed hook
   * never blocks the change. As with {@link SiteWideConfirm.confirmSiteWide}, the caller makes the
   * change as this resolves, with nothing awaited between.
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
  /**
   * Runs `action` once no answered change waits for its {@link BeforeSiteWideAction}, after that
   * change is made; at once while none waits. What the person pressed meanwhile (Undo, #1344)
   * comes after the change, as they pressed it, rather than being lost. Returns what drops
   * `action` if it hasn't run yet: the editor it was pressed in has closed.
   */
  afterChange(action: () => void): () => void;
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
  // What runs once they have been (`afterChange`).
  let after: (() => void)[] = [];
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  /**
   * Runs what waits for the changes, once none waits any more. In a task of its own: each change is
   * made as its promise resolves, in the microtasks after the hook, so all of them come first.
   */
  const runAfter = () => {
    setTimeout(() => {
      if (waiting > 0) return;
      const actions = after;
      after = [];
      for (const action of actions) action();
    }, 0);
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
      if (waiting === 0 && after.length > 0) runAfter();
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
    afterChange(action) {
      if (waiting === 0) {
        action();
        return () => undefined;
      }
      after.push(action);
      return () => {
        after = after.filter((each) => each !== action);
      };
    },
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
 * Runs Undo, Redo or Esc's cancel pressed on the editor's keys with `run`, minding `confirm`:
 * - while it asks a question, nothing: the keys are the dialog's;
 * - while an answered change waits for its version (4.6), Undo and Redo once it's made, so they
 *   never land before it and aren't lost either (#1344); Esc has nothing to cancel then;
 * - otherwise at once.
 *
 * A command held back is in `held` until it runs: what drops it, for whoever stops listening to
 * the keys before then (the editor closing as the version saves). Returns what `run` returns, or
 * true for a command it holds back.
 */
export function historyCommandMindingQuestions(
  confirm: Pick<SiteWideConfirm, "busy" | "current" | "afterChange">,
  command: HistoryCommand,
  run: (command: HistoryCommand) => boolean,
  held: Set<() => void>,
): boolean {
  if (!confirm.busy()) return run(command);
  if (confirm.current() !== null || command === "cancel") return false;
  // Set before `afterChange` can run the action: one that runs it at once has nothing to hold.
  let ran = false;
  let drop: () => void = () => undefined;
  drop = confirm.afterChange(() => {
    ran = true;
    held.delete(drop);
    run(command);
  });
  if (!ran) held.add(drop);
  return true;
}

/** Drops every command `held` holds back (see {@link historyCommandMindingQuestions}). */
export function dropHeld(held: Set<() => void>): void {
  for (const drop of held) drop();
  held.clear();
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
      {/* Never taller than the window: a long question scrolls, and the buttons stay (S30). */}
      <AlertDialogContent className="flex flex-col">
        <AlertDialogHeader className="min-h-0">
          <AlertDialogTitle>{action?.action}</AlertDialogTitle>
          {/*
           * An AI app's question names whole web addresses, which wrap anywhere (S18), and a plan's
           * comes in paragraphs. It scrolls, reachable from the keyboard.
           */}
          <AlertDialogDescription
            // A region that scrolls takes focus, so the keyboard can scroll it (axe).
            tabIndex={0}
            className="min-h-0 overflow-y-auto whitespace-pre-line [overflow-wrap:anywhere]"
          >
            {action?.description === undefined
              ? ""
              : // After a plan's paragraphs, the pages it changes are one of their own.
                `${action.description}${action.description.includes("\n") ? "\n\n" : " "}`}
            {action === null
              ? ""
              : action.affectedPages === 1
                ? t("confirm.siteWide.affectsOne")
                : t("confirm.siteWide.affectsMany", { count: action.affectedPages })}
          </AlertDialogDescription>
          {action?.pictures === undefined || action.pictures.length === 0 ? null : (
            <div className="flex flex-wrap gap-3">
              {action.pictures.map(({ label, src }) => (
                <figure key={`${label} ${src}`} className="m-0 flex flex-col items-center gap-1">
                  {/* As Site Settings shows it (`ImageField`); named by its caption and the question. */}
                  <img
                    src={src}
                    alt=""
                    className="size-16 rounded-md border border-border bg-input object-contain"
                  />
                  <figcaption className="text-muted-foreground text-xs">{label}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("confirm.siteWide.cancel")}</AlertDialogCancel>
          {action?.allowAlways === undefined ? null : (
            <AlertDialogAction
              // Quieter than Allow: the change asked about is the one to weigh (5.35).
              variant="outline"
              onClick={() => {
                action.allowAlways?.();
                confirm.answer(true);
              }}
            >
              {t("confirm.siteWide.allowAlways")}
            </AlertDialogAction>
          )}
          <AlertDialogAction variant="destructive" onClick={() => confirm.answer(true)}>
            {action?.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
