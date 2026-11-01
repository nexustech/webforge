import type { HistoryManager } from "@webforge/history";
import type { SiteDoc } from "@webforge/model";
// AbortSignal, as the renderer and Node both have it.
import type {} from "./web-globals.js";

/**
 * The D7 confirmation an AI app's change waits for, already translated, as Webforge's site-wide
 * question asks it: a change to more than one page, or to where visitors' money or details go.
 */
export type Confirmation = {
  /** The question, as the dialog's title: "Allow Claude to change the Header?". */
  readonly action: string;
  /** More about it, before the pages it changes: "Payment link: from pay.example to …" (S18). */
  readonly description?: string;
  /** The button that allows it: "Allow". */
  readonly confirm: string;
  /** How many pages it changes, which the dialog states. */
  readonly affectedPages: number;
};

/**
 * What the commands run against (F-AI-1): the open site's history, and the editor around it. The
 * renderer gives it; tests give their own.
 */
export type CommandHost = {
  /** The site, and whether a gesture (a drag, a slider) is open. */
  readonly history: Pick<HistoryManager<SiteDoc, unknown>, "document" | "state">;
  /** The one way a command changes the site: one undo step labelled `label`, of `kind`. */
  readonly run: (label: string, recipe: (draft: SiteDoc) => void, kind: ChangeKind) => void;
  /**
   * Whether the person is busy otherwise: typing in a text on the canvas (a text session, D1), or
   * answering a question that a change of their own asked.
   */
  readonly editing: () => boolean;
  /** The editing mode: Content mode allows content edits only (1.26). */
  readonly mode: () => "design" | "content";
  /**
   * Shows `confirmation` in Webforge and resolves with whether the person allowed the change.
   * `signal` aborts when the question has waited too long: the dialog closes, and it's declined.
   */
  readonly confirm: (confirmation: Confirmation, signal: AbortSignal) => Promise<boolean>;
};

/** What kind of change a command makes, in the editor's words for its own (`EditKind`). */
export type ChangeKind = "insert" | "move" | "remove" | "text" | "props";

/** Who asks: the AI app, by the name the person gave it when pairing (4.9). */
export type Actor = { readonly app: string };

/** Why a command changed nothing, for the AI app to read. */
export type Refusal =
  /** The input isn't what the command takes. */
  | "invalid"
  /** A page, element or shared section it names isn't there. */
  | "not-found"
  /** Not allowed: a structural change in Content mode, Custom Code, a place a component can't go. */
  | "refused"
  /** The person is in the middle of a drag, a slider or typing: try again shortly. */
  | "busy"
  /** The person didn't allow a change to more than one page, or didn't answer within a minute. */
  | "declined";

/** What came of a command: done, as one undo step, or refused and nothing changed. */
export type CommandResult =
  | {
      readonly status: "done";
      /** The undo step's label: "AI (Claude): Added Hero". */
      readonly label: string;
      /** What it made: the new element's or page's id. */
      readonly id?: string;
    }
  | { readonly status: Refusal; readonly message: string };
