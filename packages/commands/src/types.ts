import type { HistoryManager } from "@webforge/history";
import type { PageId, SiteDoc } from "@webforge/model";
// AbortSignal, as the renderer and Node both have it.
import type {} from "./web-globals.js";

/**
 * The D7 confirmation an AI app's change waits for, already translated, as Webforge's site-wide
 * question asks it: a change to more than one page, or to where visitors' money or details go.
 */
export type Confirmation = {
  /** The question, as the dialog's title: "Allow Claude to Change the Header?". */
  readonly action: string;
  /** More about it, before the pages it changes: "Payment link: from pay.example to …" (S18). */
  readonly description?: string;
  /** The button that allows it: "Allow". */
  readonly confirm: string;
  /** How many pages it changes, which the dialog states. */
  readonly affectedPages: number;
  /**
   * The name of the version saved once it's allowed, when "Before: Allow" wouldn't say what it was
   * before: "Before Claude's changes: Build the site" (a plan, S26).
   */
  readonly version?: string;
  /**
   * It names where visitors' money or details go (S18), or changes Site Settings: a plan says it
   * before anything else, set apart, however long the plan (S30, #795).
   */
  readonly first?: true;
  /**
   * Asked even of an app the person lets work without asking (5.35, UA-2): where visitors' money or
   * details go (S18), and Site Settings it names from what they were to what they'd be (a web
   * address, a phone, an email, a social profile, search engines' permission).
   */
  readonly alwaysAsk?: true;
};

/**
 * How a change is to be allowed (5.35, UA-2): `unasked`, made without a question, as the app works
 * without asking; else asked, offering with `offerUnasked` to let the app work without asking.
 */
export type ConfirmOptions = {
  readonly unasked?: boolean;
  readonly offerUnasked?: (() => void) | undefined;
};

/**
 * What the commands run against (F-AI-1): the open site's history, and the editor around it. The
 * renderer gives it; tests give their own.
 */
export type CommandHost = {
  /** The site, and whether a gesture (a drag, a slider) is open. */
  readonly history: Pick<HistoryManager<SiteDoc, unknown>, "document" | "state">;
  /**
   * The one way a command changes the site: one undo step labelled `label`, of `kind`. A step that
   * deletes pages `removesPages` shows the Home page instead if one of them was shown, as the person's
   * own *Delete Page* does (4.11).
   */
  readonly run: (
    label: string,
    recipe: (draft: SiteDoc) => void,
    kind: ChangeKind,
    removesPages?: readonly PageId[],
  ) => void;
  /**
   * Whether the person is busy otherwise: typing in a text on the canvas (a text session, D1), or
   * answering a question that a change of their own asked.
   */
  readonly editing: () => boolean;
  /** The editing mode: Content mode allows content edits only (1.26). */
  readonly mode: () => "design" | "content";
  /**
   * Whether the open site has been published: a page an AI app renames then keeps its old address
   * working, as the person's own rename does (#925).
   */
  readonly published: () => boolean;
  /**
   * Shows `confirmation` in Webforge and resolves with whether the person allowed the change.
   * `signal` aborts when the asker gives up: the question closes. Made `unasked` (5.35), it resolves
   * true once what goes before a site-wide change has run, with no question.
   */
  readonly confirm: (
    confirmation: Confirmation,
    signal: AbortSignal,
    options?: ConfirmOptions,
  ) => Promise<boolean>;
};

/** What kind of change a command makes, in the editor's words for its own (`EditKind`). */
export type ChangeKind = "insert" | "move" | "remove" | "text" | "props";

/** Who asks: the AI app, by the name the person gave it when pairing (4.9). */
export type Actor = {
  readonly app: string;
  /**
   * The asker giving up: a question it's waiting on closes unanswered, which is no decline (5.34,
   * UA-1).
   */
  readonly signal?: AbortSignal | undefined;
  /** Called as the command asks the person, and waits on their answer with no time limit (5.34). */
  readonly onAsking?: (() => void) | undefined;
  /**
   * The person lets this app work without asking (5.35, UA-2): a change that only reaches every
   * page (D7) is made unasked; one that {@link Confirmation.alwaysAsk} is still asked.
   */
  readonly unasked?: boolean | undefined;
  /** Lets this app work without asking, offered in a question it asks (5.35). */
  readonly offerUnasked?: (() => void) | undefined;
};

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
      /** Its undo step's id in the history, which _Undo these changes_ goes back past (6.9b). */
      readonly entryId?: string;
      /** The page, and the element on it, that it changed, for the assistant's _Show_ (6.9b). */
      readonly target?: CommandTarget;
    }
  | { readonly status: Refusal; readonly message: string };

/** A page, and an element on it, that a command changed. */
type CommandTarget = { readonly pageId: string; readonly nodeId?: string };
