/**
 * How Webforge's page and Puck's view stay in step (R8, ADR 0004): which page Puck shows, and
 * whose change is under way, so neither side takes the other's echo for a change of its own.
 * - The app's pages are numbered: Puck shows the latest once it has been sent all of it.
 * - While Webforge dispatches to Puck (`apply`), what Puck reports back is that change's echo.
 * - While Puck runs its `onAction` (`handleAction`), inside its own store update, a dispatch would
 *   be lost: it waits until Puck is done.
 * - While the app takes over an edit Puck reported (`report`), the page it hands back through
 *   `applyChange` is that edit's echo: Puck shows it already.
 */
export type CanvasSync = {
  /** The app gave the canvas a page Puck doesn't show yet. */
  changed(): void;
  /** Puck now shows the app's latest page. */
  shown(): void;
  /** Whether Puck shows the app's latest page. */
  isShown(): boolean;
  /** Puck was remounted: it shows whatever it was last rendered with, none of the app's pages. */
  forget(): void;
  /** Runs `run`, Webforge's own dispatch to Puck: what Puck reports while it runs is its echo. */
  apply<T>(run: () => T): T;
  /** Whether Puck's report is the echo of Webforge's own dispatch. */
  isEcho(): boolean;
  /** Runs `run`, Puck's `onAction`: inside Puck's store update. */
  handleAction<T>(run: () => T): T;
  /** Whether Puck is inside its store update, where a dispatch would be lost. */
  inAction(): boolean;
  /** Runs `run`, which reports Puck's edit to the app. */
  report<T>(run: () => T): T;
  /** Whether a change the app hands back is the echo of the edit being reported. */
  isReporting(): boolean;
};

/** A new {@link CanvasSync}: Puck shows the app's first page, nothing under way. */
export function createCanvasSync(): CanvasSync {
  let revision = 0;
  let shownRevision = 0;
  let applying = false;
  let inAction = false;
  let reporting = false;
  /** Runs `run` with a flag set, cleared after it however it ends. */
  const during = <T>(set: (on: boolean) => void, run: () => T): T => {
    set(true);
    try {
      return run();
    } finally {
      set(false);
    }
  };
  return {
    changed: () => {
      revision++;
    },
    shown: () => {
      shownRevision = revision;
    },
    isShown: () => shownRevision === revision,
    forget: () => {
      shownRevision = -1;
    },
    apply: (run) =>
      during((on) => {
        applying = on;
      }, run),
    isEcho: () => applying,
    handleAction: (run) =>
      during((on) => {
        inAction = on;
      }, run),
    inAction: () => inAction,
    report: (run) =>
      during((on) => {
        reporting = on;
      }, run),
    isReporting: () => reporting,
  };
}
