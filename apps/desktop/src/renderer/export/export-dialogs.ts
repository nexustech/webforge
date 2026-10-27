import type { ExportChoices } from "../../shared/ipc/site.js";

/** How the person answered "Add your site's web address?" (X3); `cancel` closes it unanswered. */
type WebAddressAnswer = "add" | "skip" | "skip-always" | "cancel";

/** What the export report shows (07), already translated where it's text. */
export type ExportReport = {
  readonly format: "folder" | "zip";
  /** The folder's or ZIP file's name. */
  readonly name: string;
  /** "Pages: 3 · Files: 16 · Size: 2.4 MB". */
  readonly summary: string;
  /** Each problem found, by its page ("On “About”, a link goes to…"). */
  readonly issues: readonly string[];
  /** How many more there were than `issues` lists. */
  readonly more: number;
  /** The site has no web address (X3: the prompt was skipped). */
  readonly noWebAddress: boolean;
};

/** The dialog the export flow has open, and how it answers. */
export type ExportDialogShown =
  | { readonly kind: "web-address"; readonly answer: (answer: WebAddressAnswer) => void }
  | {
      readonly kind: "options";
      readonly initial: ExportChoices;
      /** Advanced mode: *Include developer files* is offered (T2, X6). */
      readonly advanced: boolean;
      readonly answer: (choices: ExportChoices | undefined) => void;
    }
  | { readonly kind: "report"; readonly report: ExportReport };

/**
 * The export's dialogs (3.3): the web address prompt, the options and the report, one at a time.
 * The flow asks; the window draws whichever is shown (ExportDialogs.tsx).
 */
export type ExportDialogs = {
  shown(): ExportDialogShown | null;
  subscribe(listener: () => void): () => void;
  askWebAddress(): Promise<WebAddressAnswer>;
  /** The person's choices for this export, starting from `initial`; `undefined` if cancelled. */
  chooseOptions(initial: ExportChoices, advanced: boolean): Promise<ExportChoices | undefined>;
  showReport(report: ExportReport): void;
  /** Closes the report. */
  close(): void;
};

/** Creates the export's dialogs, none shown. */
export function createExportDialogs(): ExportDialogs {
  let shown: ExportDialogShown | null = null;
  const listeners = new Set<() => void>();
  const show = (next: ExportDialogShown | null) => {
    shown = next;
    for (const listener of listeners) listener();
  };
  return {
    shown: () => shown,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    askWebAddress: () =>
      new Promise((resolve) =>
        show({
          kind: "web-address",
          answer: (answer) => {
            show(null);
            resolve(answer);
          },
        }),
      ),
    chooseOptions: (initial, advanced) =>
      new Promise((resolve) =>
        show({
          kind: "options",
          initial,
          advanced,
          answer: (choices) => {
            show(null);
            resolve(choices);
          },
        }),
      ),
    showReport: (report) => show({ kind: "report", report }),
    close: () => show(null),
  };
}
