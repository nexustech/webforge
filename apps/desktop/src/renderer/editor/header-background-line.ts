import type { EditPanelField } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { expandSharedCopies, type PageId, type SiteDoc } from "@webforge/model";
import { canvasLayout } from "./shared-layout.js";

/** The Hero's type, which shows the line, and the Header's, which holds the setting. */
const HERO = "Hero";
const HEADER = "Header";

/** What a Hero that opens its page says of the Header's **Background** (HH-1). */
export type HeaderBackgroundLine = {
  /** The Header the line selects. */
  readonly header: string;
  /** Whether the Header is on this Hero now, every page following its own first section. */
  readonly joined: boolean;
};

/**
 * The line a Hero that is its page's first section shows (HH-1), leading to the Header's
 * **Background**, which is set on the Header for every page: there is no second switch on the Hero.
 * `undefined` for any other element, a Hero further down, or a page whose Header is hidden.
 */
export function headerBackgroundLine(
  site: SiteDoc,
  pageId: PageId,
  nodeId: string | null | undefined,
): HeaderBackgroundLine | undefined {
  const page = site.pages[pageId];
  if (page === undefined || nodeId == null) return undefined;
  // As the canvas draws the page: a Blog design's sections come between the Header and a post.
  const layout = canvasLayout(site, pageId);
  const at = layout.header.findIndex((node) => node.type === HEADER && node.props.hidden !== true);
  const header = layout.header[at];
  if (header === undefined) return undefined;
  const shown = layout.header
    .slice(at + 1)
    .concat(expandSharedCopies(page.doc.content, site.sharedSections))
    .find((node) => node.props.hidden !== true);
  if (shown?.type !== HERO || shown.props.id !== nodeId) return undefined;
  return { header: header.props.id, joined: header.props.background === "section" };
}

/** Whether two lines say the same: the Edit panel draws again only when they don't. */
export function sameLine(
  a: HeaderBackgroundLine | undefined,
  b: HeaderBackgroundLine | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.header === b.header && a.joined === b.joined;
}

/** {@link headerBackgroundLine}'s line in the Edit panel: what it is now, and a button to change it. */
export function headerBackgroundField(
  line: HeaderBackgroundLine,
  select: (nodeId: string) => void,
): EditPanelField {
  return {
    kind: "action",
    name: "headerBackground",
    group: "style",
    // At the top of the Hero's own options, as the Header's setting is about where it opens.
    optionGroup: { id: "options", label: t("editPanel.optionGroup.options") },
    value: undefined,
    label: t("editPanel.headerBackground"),
    help: t(line.joined ? "editPanel.headerBackground.joined" : "editPanel.headerBackground.own"),
    button: t("editPanel.headerBackground.change"),
    run: () => select(line.header),
  };
}
