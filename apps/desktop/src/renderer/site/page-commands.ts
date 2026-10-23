import type { SiteDoc } from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";
import type { CommandRegistry } from "../shell/commands.js";

/** The page list as the palette shows it: each page's id, title and file name, in order. */
const listOf = (site: SiteDoc) =>
  JSON.stringify(
    site.pageOrder.map((id) => [id, site.pages[id]?.title ?? "", site.pages[id]?.slug ?? ""]),
  );

/**
 * The command palette's *Go to page* group (F-ED-26, UX-11): one command for each of the site's
 * pages, by its title (its file name found too), that shows the page. Kept in step with the
 * pages, but only re-registered when a title, file name or the order changes, not on every edit.
 * Showing a page is never an undo step (U6). Returns a function that removes them.
 */
export function registerPageCommands(
  registry: CommandRegistry,
  session: Pick<EditorSession, "history" | "showPage">,
): () => void {
  const { document } = session.history;
  let shown = "";
  let removers: (() => void)[] = [];
  const update = () => {
    const site = document.getState();
    const list = listOf(site);
    if (list === shown) return;
    shown = list;
    for (const remove of removers) remove();
    removers = site.pageOrder.flatMap((id) => {
      const page = site.pages[id];
      return page === undefined
        ? []
        : [
            registry.register({
              id: `page.goto.${id}`,
              label: page.title,
              palette: "pages",
              keywords: [page.slug],
              run: () => session.showPage(id),
            }),
          ];
    });
  };
  update();
  const stop = document.subscribe(update);
  return () => {
    stop();
    for (const remove of removers) remove();
  };
}
