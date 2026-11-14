import { type PageId, pageEntryOf, type SiteDoc } from "@webforge/model";
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
  /** The pages it deletes: the window shows the Home page instead, if it showed one of them. */
  readonly removesPages?: readonly PageId[];
};

/**
 * What a command is planned with besides the site: what the window knows of it. Left out, the site
 * counts as never published.
 */
export type PlanContext = {
  /**
   * Whether the site has been published (the window's `lastPublishedAt`): a page's new address
   * then keeps its old one working, as the person's own rename does (#862, #925).
   */
  readonly published: boolean;
};

/** Planned with a site never published. */
export const UNPUBLISHED: PlanContext = { published: false };

/** Why a command can't be planned. */
export type Failure = { readonly status: Refusal; readonly message: string };

/** A {@link Failure}. */
export const fail = (status: Refusal, message: string): Failure => ({ status, message });

/** Whether a planning step failed. */
export const failed = (value: object): value is Failure => "status" in value;

/**
 * What a plan does, for its one question (D7): counted and named. Each command adds what it does
 * to it with its own `summarize` (#981).
 */
export type PlanSummary = {
  readonly pagesAdded: string[];
  readonly pagesRemoved: string[];
  /** Pages renamed, by their titles before and after. */
  readonly pagesRenamed: { readonly from: string; readonly to: string }[];
  readonly pagesMoved: Set<string>;
  /** Pages whose Page Settings change, besides their title. */
  readonly pagesSet: Set<string>;
  theme: boolean;
  elements: { added: number; changed: number; moved: number; removed: number };
  /** The questions its commands would each have asked: the question, and what it names. */
  readonly asks: string[];
  /** Those that name where visitors' money or details go, or change Site Settings (S30). */
  readonly asksFirst: string[];
};

/** Page `pageId`'s title, as a summary names it: none for a page that isn't there. */
export const pageTitleOf = (site: SiteDoc, pageId: string): string =>
  pageEntryOf(site.pages, pageId)?.title ?? "";

/** Page `pageId` renamed `to`, in `summary`, when that's another title than its own. */
export function summarizeRename(
  summary: PlanSummary,
  site: SiteDoc,
  pageId: string,
  to: string | undefined,
): void {
  const page = pageEntryOf(site.pages, pageId);
  if (page !== undefined && to !== undefined && to.trim() !== page.title) {
    summary.pagesRenamed.push({ from: page.title, to: to.trim() });
  }
}
