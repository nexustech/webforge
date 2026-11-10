import { RICH_TEXT_PAGE_LINK, type SiteDoc } from "@webforge/model";

/**
 * Points every link to a page in `targets` at the home page: in props, menus and rich text. Each
 * page goes to its section's anchor, or to the top of the home page when it has none. A link that
 * named a section of the page keeps it when `keeps` says that section came along with it.
 */
export function retargetLinks(
  site: SiteDoc,
  targets: ReadonlyMap<string, string | undefined>,
  keeps: (pageId: string, anchor: string) => boolean = () => false,
): void {
  if (targets.size === 0) return;
  const home = site.homePageId;
  const where = (pageId: string, anchor: string | undefined): string | undefined =>
    anchor !== undefined && keeps(pageId, anchor) ? anchor : targets.get(pageId);
  const ids = [...targets.keys()].map((id) => id.replace(/[^\w-]/g, "")).join("|");
  const inRichText = new RegExp(`${RICH_TEXT_PAGE_LINK}(${ids})(?:#([^"]*))?"`, "g");
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.replace(inRichText, (_link, pageId: string, anchor: string | undefined) => {
        const to = where(pageId, anchor);
        return `${RICH_TEXT_PAGE_LINK}${home}${to === undefined ? "" : `#${to}`}"`;
      });
    }
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) value[index] = visit(item);
      return value;
    }
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      if (
        record.kind === "page" &&
        typeof record.pageId === "string" &&
        targets.has(record.pageId)
      ) {
        const to = where(
          record.pageId,
          typeof record.anchor === "string" ? record.anchor : undefined,
        );
        record.pageId = home;
        if (to === undefined) delete record.anchor;
        else record.anchor = to;
      }
      for (const [key, item] of Object.entries(record)) record[key] = visit(item);
    }
    return value;
  };
  for (const page of Object.values(site.pages)) visit(page.doc);
  visit(site.layout);
  visit(site.sharedSections);
  visit(site.menu);
}
