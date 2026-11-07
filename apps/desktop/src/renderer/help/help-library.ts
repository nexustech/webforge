import {
  type HelpContentsGroup,
  type HelpPage,
  parseHelpContents,
  parseHelpPage,
} from "@webforge/help";

/** The help pages, read from `docs/help/` (5.4b, HP-6). */
export type HelpLibrary = {
  /** Every page, by id. */
  readonly pages: ReadonlyMap<string, HelpPage>;
  /** The pages in the contents' order, then any the contents leave out, for search. */
  readonly ordered: readonly HelpPage[];
  /** The Help window's contents, from the README's groups. */
  readonly contents: readonly HelpContentsGroup[];
};

/**
 * The help library in `files` (each file's path, ending in its name, and its text) and `readme`.
 * A page that can't be read is left out: `pnpm help-check` fails on one, so none ships.
 */
export function helpLibraryOf(
  files: Readonly<Record<string, string>>,
  readme: string,
): HelpLibrary {
  const pages = new Map<string, HelpPage>();
  for (const [path, text] of Object.entries(files)) {
    if (path.endsWith("/README.md")) continue;
    try {
      const page = parseHelpPage(text);
      pages.set(page.id, page);
    } catch {
      // Left out; help-check names it.
    }
  }
  const contents = parseHelpContents(readme)
    .map((group) => ({ ...group, pages: group.pages.filter((id) => pages.has(id)) }))
    .filter((group) => group.pages.length > 0);
  const listed = contents.flatMap((group) => group.pages);
  const ordered = [
    ...listed.flatMap((id) => pages.get(id) ?? []),
    ...[...pages.values()].filter((page) => !listed.includes(page.id)),
  ];
  return { pages, ordered, contents };
}

/**
 * The pages in `docs/help/`, bundled with the Help window at build time (HP-6): nothing is read
 * from disk or the network at run time. Read once, the first time it's asked for.
 */
let bundled: HelpLibrary | undefined;
export function bundledHelpLibrary(): HelpLibrary {
  if (bundled === undefined) {
    const files = import.meta.glob<string>("../../../../../docs/help/*.md", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const readme = Object.entries(files).find(([path]) => path.endsWith("/README.md"))?.[1] ?? "";
    bundled = helpLibraryOf(files, readme);
  }
  return bundled;
}
