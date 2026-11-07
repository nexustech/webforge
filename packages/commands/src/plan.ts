import type { PageId, SiteDoc } from "@webforge/model";
import type { ChangeKind, Confirmation, Refusal } from "./types.js";

/** What a command will do: one undo step, and the confirmation it waits for, if any (D7). */
export type Plan = {
  /** The step's action, before the app's name: "Added Hero". */
  readonly action: string;
  /** Changes the page's structure: refused in Content mode (1.26). */
  readonly structural: boolean;
  /** What kind of change it is, as the editor's own are: a removal offers Undo in a toast (D4). */
  readonly kind: ChangeKind;
  /** Asked first, for a change to more than one page (D7); `{app}` is the app's name. */
  readonly confirm?: ((app: string) => Confirmation) | undefined;
  readonly recipe: (draft: SiteDoc) => void;
  /** What it makes: a new element's or page's id. */
  readonly id?: string;
  /** The page it deletes: the window shows the Home page instead, if it showed this one. */
  readonly removesPage?: PageId;
};

/** Why a command can't be planned. */
export type Failure = { readonly status: Refusal; readonly message: string };

/** A {@link Failure}. */
export const fail = (status: Refusal, message: string): Failure => ({ status, message });

/** Whether a planning step failed. */
export const failed = (value: object): value is Failure => "status" in value;
