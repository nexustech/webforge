import type { EditorSession } from "../editor/editor-session.js";
import { type PageListEntry, pageListOf, samePages } from "../editor/use-document.js";
import type { CommandRegistry } from "../shell/commands.js";

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
  let shown: readonly PageListEntry[] | undefined;
  let removers: (() => void)[] = [];
  const update = () => {
    const list = pageListOf(document.getState());
    if (shown !== undefined && samePages(list, shown)) return;
    shown = list;
    for (const remove of removers) remove();
    removers = list.map((page) =>
      registry.register({
        id: `page.goto.${page.id}`,
        label: page.title,
        palette: "pages",
        keywords: [page.slug],
        run: () => session.showPage(page.id),
      }),
    );
  };
  update();
  const stop = document.subscribe(update);
  return () => {
    stop();
    for (const remove of removers) remove();
  };
}
