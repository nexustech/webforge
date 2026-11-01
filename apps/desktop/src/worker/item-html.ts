import { itemHtml } from "@webforge/pipeline";
import { siteLibrary } from "@webforge/site-components";
import type { ItemHtmlJob, ItemHtmlOutcome } from "../shared/export-worker-protocol.js";

/**
 * Answers the CSS tab's job (3.14) in the canvas styles worker: the item as the export writes it.
 * Never throws: a failure is `item-html-failed`, with no details, as the item is site content.
 */
export function itemHtmlFor(job: ItemHtmlJob): ItemHtmlOutcome {
  try {
    const html = itemHtml(
      job.snapshot,
      siteLibrary,
      new Map(Object.entries(job.sizes)),
      job.pageId,
      job.nodeId,
    );
    return { type: "item-html", html: html ?? null };
  } catch {
    return { type: "item-html-failed" };
  }
}
